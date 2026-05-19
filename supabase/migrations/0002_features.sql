-- ShopQR 0002: categories, payment, call-staff, item notes
-- Run this AFTER 0001_init.sql in Supabase SQL editor.

-- ============================================================
-- Categories
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

drop policy if exists categories_owner_all on public.categories;
create policy categories_owner_all on public.categories
  for all
  using (restaurant_id in (select id from public.restaurants where user_id = auth.uid()))
  with check (restaurant_id in (select id from public.restaurants where user_id = auth.uid()));

drop policy if exists categories_anon_read on public.categories;
create policy categories_anon_read on public.categories
  for select using (true);

-- Link menus to categories (nullable — uncategorised allowed)
alter table public.menus
  add column if not exists category_id uuid references public.categories(id) on delete set null;

create index if not exists menus_category_id_idx on public.menus(category_id);

-- ============================================================
-- Payment columns on orders
-- ============================================================
alter table public.orders
  add column if not exists paid boolean not null default false,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_method text;

create index if not exists orders_paid_idx on public.orders(restaurant_id, paid);

-- ============================================================
-- Call-staff requests
-- ============================================================
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

drop policy if exists call_staff_owner_all on public.call_staff_requests;
create policy call_staff_owner_all on public.call_staff_requests
  for all
  using (restaurant_id in (select id from public.restaurants where user_id = auth.uid()))
  with check (restaurant_id in (select id from public.restaurants where user_id = auth.uid()));

drop policy if exists call_staff_anon_insert on public.call_staff_requests;
create policy call_staff_anon_insert on public.call_staff_requests
  for insert with check (true);

-- Enable realtime
alter publication supabase_realtime add table public.call_staff_requests;

-- ============================================================
-- Reload PostgREST schema cache
-- ============================================================
notify pgrst, 'reload schema';
