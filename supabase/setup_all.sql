-- ============================================================
-- ShopQR / QR Menu — Full Database Setup (combined 0001-0009)
-- ============================================================
-- Run ONCE in Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotent: safe to re-run; will not duplicate or break existing data.
--
-- This file is the equivalent of running migrations 0001 through 0009
-- in order. After running this, your database matches the latest schema
-- the application expects.
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
-- Reload PostgREST schema cache so new columns are immediately visible
-- ============================================================
notify pgrst, 'reload schema';
