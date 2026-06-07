-- ============================================================
-- ShopQR / QR Menu — Full Database Setup (combined 0001-0022)
-- ============================================================
-- Run ONCE in Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotent: safe to re-run; will not duplicate or break existing data.
--
-- This file is the equivalent of running migrations 0001 through 0022
-- in order. After running this, your database matches the latest schema
-- the application expects.
--
-- After running this file, provision your first platform admin:
--   insert into public.app_admins (user_id)
--   select id from auth.users where email = 'your-admin@example.com'
--   on conflict do nothing;
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- 0001: Core schema (restaurants, tables, menus, orders)
-- ============================================================

do $$ begin
  create type order_status as enum ('pending', 'ready', 'served');
exception when duplicate_object then null; end $$;

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists restaurants_user_id_idx on public.restaurants(user_id);

create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_number int not null,
  qr_url text,
  created_at timestamptz not null default now(),
  unique (restaurant_id, table_number)
);
create index if not exists tables_restaurant_id_idx on public.tables(restaurant_id);

create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  image_url text,
  available boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists menus_restaurant_id_idx on public.menus(restaurant_id);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  items jsonb not null,
  status order_status not null default 'pending',
  total numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists orders_restaurant_id_idx on public.orders(restaurant_id);
create index if not exists orders_table_id_idx on public.orders(table_id);
create index if not exists orders_status_idx on public.orders(status);

-- Realtime (safe: ALTER PUBLICATION won't error if already added in PG 14+)
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;

alter table public.restaurants enable row level security;
alter table public.tables      enable row level security;
alter table public.menus       enable row level security;
alter table public.orders      enable row level security;

-- ============================================================
-- 0002: Categories, payment columns, call-staff requests
-- ============================================================

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists categories_restaurant_id_idx on public.categories(restaurant_id);
create index if not exists categories_sort_idx on public.categories(restaurant_id, sort_order);
alter table public.categories enable row level security;

alter table public.menus
  add column if not exists category_id uuid references public.categories(id) on delete set null;
create index if not exists menus_category_id_idx on public.menus(category_id);

alter table public.orders
  add column if not exists paid boolean not null default false,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_method text;
create index if not exists orders_paid_idx on public.orders(restaurant_id, paid);

create table if not exists public.call_staff_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  reason text,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists call_staff_restaurant_idx on public.call_staff_requests(restaurant_id);
create index if not exists call_staff_pending_idx on public.call_staff_requests(restaurant_id, acknowledged);
alter table public.call_staff_requests enable row level security;

do $$ begin
  alter publication supabase_realtime add table public.call_staff_requests;
exception when duplicate_object then null; end $$;

-- ============================================================
-- 0003: Promotions
-- ============================================================

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.promotions add column if not exists image_url text;
create index if not exists promotions_restaurant_idx on public.promotions(restaurant_id);
create index if not exists promotions_active_idx on public.promotions(restaurant_id, active);
alter table public.promotions enable row level security;

-- ============================================================
-- 0004: Bundle quick-add per menu
-- ============================================================

alter table public.menus
  add column if not exists bundles jsonb not null default '[]'::jsonb;

-- ============================================================
-- 0005: Restaurant settings + operating hours
-- ============================================================

alter table public.restaurants
  add column if not exists accepting_orders boolean not null default true,
  add column if not exists open_time text,
  add column if not exists close_time text;

-- ============================================================
-- 0006: Tables.is_open + feedback channel
-- ============================================================

alter table public.tables
  add column if not exists is_open boolean not null default false;
create index if not exists tables_is_open_idx on public.tables(restaurant_id, is_open);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  email text,
  category text not null default 'general',
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback(created_at desc);
create index if not exists feedback_user_idx on public.feedback(user_id);
alter table public.feedback enable row level security;

drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists feedback_own_read on public.feedback;
create policy feedback_own_read on public.feedback
  for select to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 0007: Service charge + VAT
-- ============================================================

alter table public.restaurants
  add column if not exists service_charge_pct numeric(5, 2) not null default 0,
  add column if not exists vat_pct numeric(5, 2) not null default 0;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'restaurants_service_charge_pct_range'
  ) then
    alter table public.restaurants
      add constraint restaurants_service_charge_pct_range
      check (service_charge_pct >= 0 and service_charge_pct <= 100);
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'restaurants_vat_pct_range'
  ) then
    alter table public.restaurants
      add constraint restaurants_vat_pct_range
      check (vat_pct >= 0 and vat_pct <= 100);
  end if;
end $$;

-- ============================================================
-- 0008: Promotion scheduling
-- ============================================================

alter table public.promotions
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz;
create index if not exists promotions_schedule_idx
  on public.promotions(restaurant_id, active, start_at, end_at);

-- ============================================================
-- 0010: Order cancellation with reason
-- (kitchen marks order as 'cancelled' instead of deleting it)
-- ============================================================

do $$ begin
  alter type order_status add value if not exists 'cancelled';
exception when others then null; end $$;

alter table public.orders
  add column if not exists cancel_reason text;

-- ============================================================
-- 0009: Multi-staff roles (restaurant_members + updated trigger + new RLS)
-- ============================================================

do $$ begin
  create type restaurant_role as enum ('owner', 'staff');
exception when duplicate_object then null; end $$;

create table if not exists public.restaurant_members (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role restaurant_role not null default 'staff',
  invited_email text,
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);
create index if not exists restaurant_members_user_idx
  on public.restaurant_members(user_id);
create index if not exists restaurant_members_restaurant_idx
  on public.restaurant_members(restaurant_id);

-- Backfill: every existing restaurant owner becomes a member with 'owner' role.
insert into public.restaurant_members (restaurant_id, user_id, role)
select id, user_id, 'owner'
from public.restaurants
where user_id is not null
on conflict (restaurant_id, user_id) do nothing;

-- Backfill: every existing auth user who somehow has no restaurant yet
-- (signed up before the trigger existed) gets one created.
insert into public.restaurants (user_id, name)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data->>'restaurant_name', ''), 'My Restaurant')
from auth.users u
left join public.restaurants r on r.user_id = u.id
where r.id is null;

insert into public.restaurant_members (restaurant_id, user_id, role)
select r.id, r.user_id, 'owner'
from public.restaurants r
left join public.restaurant_members m
  on m.restaurant_id = r.id and m.user_id = r.user_id
where m.id is null;

-- Helper functions
create or replace function public.has_restaurant_access(rid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.restaurant_members
    where restaurant_id = rid and user_id = auth.uid()
  );
$$;

create or replace function public.is_restaurant_owner(rid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.restaurant_members
    where restaurant_id = rid and user_id = auth.uid() and role = 'owner'
  );
$$;

-- Auto-create restaurant + owner membership on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  new_restaurant_id uuid;
begin
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RPC: look up user_id by email (for staff invitation flow)
create or replace function public.find_user_id_by_email(email_input text)
returns table (user_id uuid)
language sql security definer stable set search_path = public
as $$
  select id as user_id
  from auth.users
  where lower(email) = lower(email_input)
  limit 1;
$$;

grant execute on function public.find_user_id_by_email(text) to authenticated;

-- ============================================================
-- RLS policies (consolidated, membership-based)
-- ============================================================

-- restaurants
drop policy if exists restaurants_owner_all on public.restaurants;
drop policy if exists restaurants_member_read on public.restaurants;
drop policy if exists restaurants_owner_update on public.restaurants;
drop policy if exists restaurants_owner_delete on public.restaurants;
drop policy if exists restaurants_anon_read on public.restaurants;
create policy restaurants_member_read on public.restaurants
  for select using (has_restaurant_access(id));
create policy restaurants_owner_update on public.restaurants
  for update using (is_restaurant_owner(id))
  with check (is_restaurant_owner(id));
create policy restaurants_anon_read on public.restaurants
  for select using (true);

-- tables
drop policy if exists tables_owner_all on public.tables;
drop policy if exists tables_member_read on public.tables;
drop policy if exists tables_owner_write on public.tables;
drop policy if exists tables_anon_read on public.tables;
create policy tables_member_read on public.tables
  for select using (true);
create policy tables_owner_write on public.tables
  for all
  using (is_restaurant_owner(restaurant_id))
  with check (is_restaurant_owner(restaurant_id));
create policy tables_anon_read on public.tables
  for select using (true);

-- menus
drop policy if exists menus_owner_all on public.menus;
drop policy if exists menus_member_read on public.menus;
drop policy if exists menus_owner_write on public.menus;
drop policy if exists menus_anon_read on public.menus;
create policy menus_member_read on public.menus
  for select using (available = true or has_restaurant_access(restaurant_id));
create policy menus_owner_write on public.menus
  for all
  using (is_restaurant_owner(restaurant_id))
  with check (is_restaurant_owner(restaurant_id));

-- categories
drop policy if exists categories_owner_all on public.categories;
drop policy if exists categories_member_read on public.categories;
drop policy if exists categories_owner_write on public.categories;
drop policy if exists categories_anon_read on public.categories;
create policy categories_member_read on public.categories
  for select using (true);
create policy categories_owner_write on public.categories
  for all
  using (is_restaurant_owner(restaurant_id))
  with check (is_restaurant_owner(restaurant_id));

-- orders
drop policy if exists orders_owner_select on public.orders;
drop policy if exists orders_owner_update on public.orders;
drop policy if exists orders_member_select on public.orders;
drop policy if exists orders_member_update on public.orders;
drop policy if exists orders_member_delete on public.orders;
drop policy if exists orders_anon_insert on public.orders;
create policy orders_member_select on public.orders
  for select using (has_restaurant_access(restaurant_id));
create policy orders_member_update on public.orders
  for update using (has_restaurant_access(restaurant_id))
  with check (has_restaurant_access(restaurant_id));
create policy orders_member_delete on public.orders
  for delete using (has_restaurant_access(restaurant_id));
create policy orders_anon_insert on public.orders
  for insert with check (true);

-- call_staff_requests
drop policy if exists call_staff_owner_all on public.call_staff_requests;
drop policy if exists call_staff_member_all on public.call_staff_requests;
drop policy if exists call_staff_anon_insert on public.call_staff_requests;
create policy call_staff_member_all on public.call_staff_requests
  for all
  using (has_restaurant_access(restaurant_id))
  with check (has_restaurant_access(restaurant_id));
create policy call_staff_anon_insert on public.call_staff_requests
  for insert with check (true);

-- promotions
drop policy if exists promotions_owner_all on public.promotions;
drop policy if exists promotions_member_read on public.promotions;
drop policy if exists promotions_owner_write on public.promotions;
drop policy if exists promotions_anon_read on public.promotions;
create policy promotions_member_read on public.promotions
  for select using (active = true or has_restaurant_access(restaurant_id));
create policy promotions_owner_write on public.promotions
  for all
  using (is_restaurant_owner(restaurant_id))
  with check (is_restaurant_owner(restaurant_id));

-- restaurant_members
alter table public.restaurant_members enable row level security;
drop policy if exists members_read on public.restaurant_members;
create policy members_read on public.restaurant_members
  for select to authenticated
  using (has_restaurant_access(restaurant_id));
drop policy if exists members_owner_manage on public.restaurant_members;
create policy members_owner_manage on public.restaurant_members
  for all to authenticated
  using (is_restaurant_owner(restaurant_id))
  with check (is_restaurant_owner(restaurant_id));

-- ============================================================
-- Storage buckets (menu-images + promotion-images)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

drop policy if exists "menu-images public read" on storage.objects;
create policy "menu-images public read" on storage.objects
  for select using (bucket_id = 'menu-images');

drop policy if exists "menu-images owner write" on storage.objects;
create policy "menu-images owner write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'menu-images');

drop policy if exists "menu-images owner delete" on storage.objects;
create policy "menu-images owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'menu-images' and owner = auth.uid());

insert into storage.buckets (id, name, public)
values ('promotion-images', 'promotion-images', true)
on conflict (id) do nothing;

drop policy if exists "promotion-images public read" on storage.objects;
create policy "promotion-images public read" on storage.objects
  for select using (bucket_id = 'promotion-images');

drop policy if exists "promotion-images owner write" on storage.objects;
create policy "promotion-images owner write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'promotion-images');

drop policy if exists "promotion-images owner delete" on storage.objects;
create policy "promotion-images owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'promotion-images' and owner = auth.uid());

-- ============================================================
-- 0011: Payment QR per restaurant + storage bucket
-- ============================================================

alter table public.restaurants
  add column if not exists payment_qr_url text;

insert into storage.buckets (id, name, public)
values ('payment-qr', 'payment-qr', true)
on conflict (id) do nothing;

drop policy if exists "payment-qr public read" on storage.objects;
create policy "payment-qr public read" on storage.objects
  for select using (bucket_id = 'payment-qr');

drop policy if exists "payment-qr owner write" on storage.objects;
create policy "payment-qr owner write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-qr');

drop policy if exists "payment-qr owner update" on storage.objects;
create policy "payment-qr owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'payment-qr' and owner = auth.uid());

drop policy if exists "payment-qr owner delete" on storage.objects;
create policy "payment-qr owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-qr' and owner = auth.uid());

-- ============================================================
-- 0012: Cook/waiter roles + invite-link signup flow
-- ============================================================

-- Extend role enum
do $$ begin
  alter type restaurant_role add value if not exists 'cook';
exception when others then null; end $$;
do $$ begin
  alter type restaurant_role add value if not exists 'waiter';
exception when others then null; end $$;

-- Invites table
-- NOTE: the original migration 0012 has a CHECK constraint preventing 'owner'
-- role here. We OMIT it in setup_all.sql because Postgres can't reference a
-- freshly-added enum value (cook/waiter from above) inside a CHECK constraint
-- in the same transaction (error 55P04). The app code only ever inserts
-- cook/waiter (see StaffManager.tsx createInvite), so DB-level enforcement
-- is not load-bearing. If you want the constraint, re-run this block in a
-- separate SQL Editor query AFTER the rest of the script has committed:
--   alter table public.restaurant_invites
--     add constraint invite_role_not_owner check (role in ('cook', 'waiter'));
create table if not exists public.restaurant_invites (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  token text not null unique,
  role restaurant_role not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists invites_restaurant_idx
  on public.restaurant_invites(restaurant_id);
create index if not exists invites_token_idx
  on public.restaurant_invites(token);

alter table public.restaurant_invites enable row level security;

drop policy if exists invites_owner_manage on public.restaurant_invites;
create policy invites_owner_manage on public.restaurant_invites
  for all to authenticated
  using (is_restaurant_owner(restaurant_id))
  with check (is_restaurant_owner(restaurant_id));

-- RPC: lookup invite by token (anon callable)
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

-- Updated signup trigger: honor invite_token from user metadata
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

-- RPC: accept invite when ALREADY logged in
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

-- Helper: is_restaurant_waiter
-- NOTE: role::text = 'waiter' (not role = 'waiter') because the 'waiter'
-- enum value was added via ALTER TYPE earlier in this same transaction.
-- A SQL function body is validated at CREATE TIME, so comparing against
-- the literal directly fails with 55P04. Casting to text bypasses the
-- enum resolution.
create or replace function public.is_restaurant_waiter(rid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.restaurant_members
    where restaurant_id = rid and user_id = auth.uid() and role::text = 'waiter'
  );
$$;

-- Tables: waiter can UPDATE; only owner can INSERT/DELETE
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

create policy tables_member_update on public.tables
  for update to authenticated
  using (is_restaurant_owner(restaurant_id) or is_restaurant_waiter(restaurant_id))
  with check (is_restaurant_owner(restaurant_id) or is_restaurant_waiter(restaurant_id));

-- ============================================================
-- 0013: Optional Lao + English names for menus & categories
-- ============================================================

alter table public.menus
  add column if not exists name_lo text,
  add column if not exists name_en text;

alter table public.categories
  add column if not exists name_lo text,
  add column if not exists name_en text;

-- ============================================================
-- 0014: Platform admin role
-- ============================================================

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

drop policy if exists app_admins_self_read on public.app_admins;
create policy app_admins_self_read on public.app_admins
  for select to authenticated
  using (user_id = auth.uid());

create or replace function public.is_app_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = uid);
$$;

grant execute on function public.is_app_admin(uuid) to authenticated;

-- Restaurants: admin can SELECT/UPDATE/DELETE any row
drop policy if exists restaurants_admin_all on public.restaurants;
create policy restaurants_admin_all on public.restaurants
  for all to authenticated
  using (is_app_admin(auth.uid()))
  with check (is_app_admin(auth.uid()));

-- Feedback: admin can SELECT/UPDATE any row
drop policy if exists feedback_admin_read on public.feedback;
create policy feedback_admin_read on public.feedback
  for select to authenticated
  using (is_app_admin(auth.uid()));

drop policy if exists feedback_admin_update on public.feedback;
create policy feedback_admin_update on public.feedback
  for update to authenticated
  using (is_app_admin(auth.uid()))
  with check (is_app_admin(auth.uid()));

-- ============================================================
-- 0015: Admin can reply to owner feedback
-- ============================================================

alter table public.feedback
  add column if not exists admin_reply text,
  add column if not exists replied_at timestamptz;

-- ============================================================
-- 0016: Kitchen accept-flow + history tracking
-- ============================================================

alter table public.orders
  add column if not exists accepted_at  timestamptz,
  add column if not exists accepted_by  uuid references auth.users(id) on delete set null,
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid references auth.users(id) on delete set null;

create index if not exists orders_completed_at_idx
  on public.orders(restaurant_id, completed_at desc);

-- Backfill: restaurant_members.invited_email for owner rows (handle_new_user
-- never set it for self-signups before this migration).
update public.restaurant_members rm
set invited_email = u.email
from auth.users u
where rm.user_id = u.id
  and rm.invited_email is null;

-- Update trigger so future owner signups also get invited_email set.
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

-- RPC: look up emails of all members of a restaurant.
-- Used by the kitchen History tab to show who handled which order.
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

-- ============================================================
-- 0017: Member phone numbers (captured at signup)
-- ============================================================

alter table public.restaurant_members
  add column if not exists phone text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  invite_token text;
  invite_row public.restaurant_invites%rowtype;
  new_restaurant_id uuid;
  phone_val text;
begin
  invite_token := nullif(new.raw_user_meta_data->>'invite_token', '');
  phone_val := nullif(new.raw_user_meta_data->>'phone', '');

  if invite_token is not null then
    select * into invite_row
    from public.restaurant_invites
    where token = invite_token
    limit 1;

    if invite_row.id is null then raise exception 'INVITE_NOT_FOUND'; end if;
    if invite_row.used_at is not null then raise exception 'INVITE_ALREADY_USED'; end if;
    if invite_row.revoked_at is not null then raise exception 'INVITE_REVOKED'; end if;

    insert into public.restaurant_members
      (restaurant_id, user_id, role, invited_email, phone)
    values
      (invite_row.restaurant_id, new.id, invite_row.role, new.email, phone_val)
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

  insert into public.restaurant_members
    (restaurant_id, user_id, role, invited_email, phone)
  values
    (new_restaurant_id, new.id, 'owner', new.email, phone_val);

  return new;
end;
$$;

-- ============================================================
-- 0018: Kitchen ticket print width per restaurant
-- ============================================================

alter table public.restaurants
  add column if not exists kitchen_print_width int not null default 58;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'restaurants_kitchen_print_width_range'
  ) then
    alter table public.restaurants
      add constraint restaurants_kitchen_print_width_range
      check (kitchen_print_width in (58, 76, 80));
  end if;
end $$;

-- ============================================================
-- 0019: Audit log
-- ============================================================

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_restaurant_idx
  on public.audit_logs (restaurant_id, created_at desc);
create index if not exists audit_logs_action_idx
  on public.audit_logs (restaurant_id, action, created_at desc);
create index if not exists audit_logs_target_idx
  on public.audit_logs (target_id);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_read on public.audit_logs;
create policy audit_logs_read on public.audit_logs
  for select using (has_restaurant_access(restaurant_id));

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs
  for insert with check (
    has_restaurant_access(restaurant_id)
    and (actor_user_id is null or actor_user_id = auth.uid())
  );

-- No update / delete policies: audit logs are append-only by RLS.

-- ============================================================
-- 0020: Table zones
-- ============================================================

create table if not exists public.table_zones (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create index if not exists table_zones_restaurant_idx
  on public.table_zones(restaurant_id, sort_order, name);

alter table public.table_zones enable row level security;

drop policy if exists table_zones_read on public.table_zones;
drop policy if exists table_zones_owner_write on public.table_zones;

create policy table_zones_read on public.table_zones
  for select using (true);

create policy table_zones_owner_write on public.table_zones
  for all to authenticated
  using (is_restaurant_owner(restaurant_id))
  with check (is_restaurant_owner(restaurant_id));

insert into public.table_zones (restaurant_id, name, sort_order)
select r.id, 'Main', 0
from public.restaurants r
where not exists (
  select 1 from public.table_zones z where z.restaurant_id = r.id
)
on conflict do nothing;

alter table public.tables
  add column if not exists zone_id uuid references public.table_zones(id) on delete restrict;

update public.tables t
set zone_id = z.id
from public.table_zones z
where z.restaurant_id = t.restaurant_id
  and z.sort_order = 0
  and t.zone_id is null;

alter table public.tables
  alter column zone_id set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'tables_restaurant_id_table_number_key'
      and conrelid = 'public.tables'::regclass
  ) then
    alter table public.tables drop constraint tables_restaurant_id_table_number_key;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tables_restaurant_zone_table_number_key'
      and conrelid = 'public.tables'::regclass
  ) then
    alter table public.tables
      add constraint tables_restaurant_zone_table_number_key
      unique (restaurant_id, zone_id, table_number);
  end if;
end $$;

create index if not exists tables_zone_id_idx on public.tables(zone_id);

-- ============================================================
-- 0021: Performance indexes for customer menu and order flows
-- ============================================================

create index if not exists menus_restaurant_available_created_idx
  on public.menus(restaurant_id, available, created_at desc);

create index if not exists orders_table_open_created_idx
  on public.orders(restaurant_id, table_id, paid, created_at);

create index if not exists orders_restaurant_status_created_idx
  on public.orders(restaurant_id, status, created_at);

create index if not exists orders_restaurant_paid_status_created_idx
  on public.orders(restaurant_id, paid, status, created_at);

create index if not exists orders_restaurant_paid_paid_at_idx
  on public.orders(restaurant_id, paid, paid_at desc);

create index if not exists call_staff_pending_created_idx
  on public.call_staff_requests(restaurant_id, acknowledged, created_at);

create index if not exists promotions_active_sort_created_idx
  on public.promotions(restaurant_id, active, sort_order, created_at desc);

-- ============================================================
-- 0022: Short table QR codes (/t/{code})
-- ============================================================

alter table public.tables
  add column if not exists short_code text;

create or replace function public.generate_table_short_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  code text;
begin
  loop
    code := upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 8));
    exit when not exists (
      select 1 from public.tables where short_code = code
    );
  end loop;
  return code;
end;
$$;

alter table public.tables
  alter column short_code set default public.generate_table_short_code();

update public.tables
set short_code = public.generate_table_short_code()
where short_code is null;

alter table public.tables
  alter column short_code set not null;

create unique index if not exists tables_short_code_key
  on public.tables(short_code);

create index if not exists tables_restaurant_short_code_idx
  on public.tables(restaurant_id, short_code);

-- ============================================================
-- Reload PostgREST schema cache so new columns are immediately visible
-- ============================================================
notify pgrst, 'reload schema';
