-- ShopQR 0012: cook/waiter roles + invite-link signup flow
-- Run AFTER 0011.
--
-- WHY: Previously, staff had to sign up via /signup which required entering
-- a restaurant name, which auto-created a phantom restaurant for them.
-- Now owners generate a single-use invite link; staff sign up via /join/[token]
-- without entering a restaurant name. The token resolves to (restaurant, role)
-- so the new user is attached to the correct restaurant.
--
-- Roles split:
--   owner  — sees everything
--   cook   — kitchen page only
--   waiter — bills page + tables page (open/close only, no add/delete)

-- ============================================================
-- 1. Extend role enum
-- ============================================================
do $$ begin
  alter type restaurant_role add value if not exists 'cook';
exception when others then null; end $$;
do $$ begin
  alter type restaurant_role add value if not exists 'waiter';
exception when others then null; end $$;

-- ============================================================
-- 2. Invites table
-- ============================================================
create table if not exists public.restaurant_invites (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  token text not null unique,
  role restaurant_role not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz,
  constraint invite_role_not_owner check (role in ('cook', 'waiter'))
);

create index if not exists invites_restaurant_idx
  on public.restaurant_invites(restaurant_id);
create index if not exists invites_token_idx
  on public.restaurant_invites(token);

alter table public.restaurant_invites enable row level security;

-- Owners manage their restaurant's invites
drop policy if exists invites_owner_manage on public.restaurant_invites;
create policy invites_owner_manage on public.restaurant_invites
  for all to authenticated
  using (is_restaurant_owner(restaurant_id))
  with check (is_restaurant_owner(restaurant_id));

-- ============================================================
-- 3. RPC to look up invite by token (used by /join/[token] page,
--    callable anonymously so the page can render before signup)
-- ============================================================
create or replace function public.lookup_invite(token_input text)
returns table (
  id uuid,
  restaurant_id uuid,
  restaurant_name text,
  role restaurant_role,
  used_at timestamptz,
  revoked_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select i.id, i.restaurant_id, r.name as restaurant_name, i.role, i.used_at, i.revoked_at
  from public.restaurant_invites i
  join public.restaurants r on r.id = i.restaurant_id
  where i.token = token_input
  limit 1;
$$;

grant execute on function public.lookup_invite(text) to anon, authenticated;

-- ============================================================
-- 4. Updated signup trigger: honor invite_token from user metadata
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  invite_token text;
  invite_row public.restaurant_invites%rowtype;
  new_restaurant_id uuid;
begin
  invite_token := nullif(new.raw_user_meta_data->>'invite_token', '');

  if invite_token is not null then
    -- Invite-based signup: attach to existing restaurant, do NOT create new one.
    select * into invite_row
    from public.restaurant_invites
    where token = invite_token
    limit 1;

    if invite_row.id is null then
      raise exception 'INVITE_NOT_FOUND';
    end if;
    if invite_row.used_at is not null then
      raise exception 'INVITE_ALREADY_USED';
    end if;
    if invite_row.revoked_at is not null then
      raise exception 'INVITE_REVOKED';
    end if;

    insert into public.restaurant_members (restaurant_id, user_id, role, invited_email)
    values (invite_row.restaurant_id, new.id, invite_row.role, new.email)
    on conflict (restaurant_id, user_id) do nothing;

    update public.restaurant_invites
    set used_by = new.id, used_at = now()
    where id = invite_row.id;

    return new;
  end if;

  -- Default: owner signup — create new restaurant
  insert into public.restaurants (user_id, name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'restaurant_name', ''), 'My Restaurant')
  )
  returning id into new_restaurant_id;

  insert into public.restaurant_members (restaurant_id, user_id, role)
  values (new_restaurant_id, new.id, 'owner');

  return new;
end;
$$;

-- ============================================================
-- 5. RPC for accepting an invite when ALREADY logged in
--    (logged-in user clicks invite link → attach to restaurant, don't re-signup)
-- ============================================================
create or replace function public.accept_invite(token_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.restaurant_invites%rowtype;
  caller uuid;
begin
  caller := auth.uid();
  if caller is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into invite_row
  from public.restaurant_invites
  where token = token_input
  limit 1;

  if invite_row.id is null then raise exception 'INVITE_NOT_FOUND'; end if;
  if invite_row.used_at is not null then raise exception 'INVITE_ALREADY_USED'; end if;
  if invite_row.revoked_at is not null then raise exception 'INVITE_REVOKED'; end if;

  insert into public.restaurant_members (restaurant_id, user_id, role, invited_email)
  values (invite_row.restaurant_id, caller, invite_row.role,
          (select email from auth.users where id = caller))
  on conflict (restaurant_id, user_id) do nothing;

  update public.restaurant_invites
  set used_by = caller, used_at = now()
  where id = invite_row.id;

  return invite_row.restaurant_id;
end;
$$;

grant execute on function public.accept_invite(text) to authenticated;

-- ============================================================
-- 6. RLS update: tables — waiter can UPDATE (for open/close toggle),
--    but only owner can INSERT/DELETE.
-- ============================================================
create or replace function public.is_restaurant_waiter(rid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.restaurant_members
    where restaurant_id = rid and user_id = auth.uid() and role = 'waiter'
  );
$$;

drop policy if exists tables_owner_write on public.tables;
drop policy if exists tables_owner_insert on public.tables;
drop policy if exists tables_owner_delete on public.tables;
drop policy if exists tables_member_update on public.tables;

create policy tables_owner_insert on public.tables
  for insert to authenticated
  with check (is_restaurant_owner(restaurant_id));

create policy tables_owner_delete on public.tables
  for delete to authenticated
  using (is_restaurant_owner(restaurant_id));

-- Update: owner OR waiter. (Cook cannot. Application UI enforces that
-- waiter only changes is_open; if waiter calls REST directly to change
-- table_number, that's still acceptable risk for MVP.)
create policy tables_member_update on public.tables
  for update to authenticated
  using (is_restaurant_owner(restaurant_id) or is_restaurant_waiter(restaurant_id))
  with check (is_restaurant_owner(restaurant_id) or is_restaurant_waiter(restaurant_id));

-- ============================================================
-- 7. Ensure existing member-update policies on orders still allow cook+waiter
--    (orders policy from 0009 uses has_restaurant_access which already
--    includes any member — cook/waiter/owner. No change needed.)
-- ============================================================

notify pgrst, 'reload schema';
