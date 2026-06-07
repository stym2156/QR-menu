-- ShopQR 0016: kitchen accept-flow + history tracking
-- Run AFTER 0015.
--
-- New columns on orders to track:
--   accepted_at / accepted_by — when a cook claims a new order
--   completed_at / completed_by — when the order was marked ready (or cancelled)
--
-- These let the kitchen UI show a 2-step flow ("Accept" → "Mark Done")
-- and a history tab that says which staff member handled which order.
--
-- Also backfills restaurant_members.invited_email for owners (the
-- handle_new_user trigger didn't set it for self-signups before).

-- ============================================================
-- 1. orders: workflow timestamps + actor user_ids
-- ============================================================
alter table public.orders
  add column if not exists accepted_at  timestamptz,
  add column if not exists accepted_by  uuid references auth.users(id) on delete set null,
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid references auth.users(id) on delete set null;

create index if not exists orders_completed_at_idx
  on public.orders(restaurant_id, completed_at desc);

-- ============================================================
-- 2. Backfill: restaurant_members.invited_email for owner rows
--    (the auto-create trigger for owner signup never set this column)
-- ============================================================
update public.restaurant_members rm
set invited_email = u.email
from auth.users u
where rm.user_id = u.id
  and rm.invited_email is null;

-- ============================================================
-- 3. Update signup trigger to include email for owner rows too
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

  insert into public.restaurants (user_id, name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'restaurant_name', ''), 'My Restaurant')
  )
  returning id into new_restaurant_id;

  insert into public.restaurant_members (restaurant_id, user_id, role, invited_email)
  values (new_restaurant_id, new.id, 'owner', new.email);

  return new;
end;
$$;

-- ============================================================
-- 4. RPC: look up emails of all members of a restaurant
--    Used by the kitchen History tab to show who handled each order.
--    SECURITY DEFINER + explicit access check so callers can only read
--    emails of restaurants they belong to.
-- ============================================================
create or replace function public.lookup_member_emails(rid uuid)
returns table (user_id uuid, email text)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not has_restaurant_access(rid) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  return query
    select rm.user_id, coalesce(rm.invited_email, u.email)::text as email
    from public.restaurant_members rm
    left join auth.users u on u.id = rm.user_id
    where rm.restaurant_id = rid;
end;
$$;

grant execute on function public.lookup_member_emails(uuid) to authenticated;

notify pgrst, 'reload schema';
