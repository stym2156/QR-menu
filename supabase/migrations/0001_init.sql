-- ShopQR initial schema
-- Run this in Supabase SQL editor after creating the project.

create extension if not exists "pgcrypto";

-- Order status
do $$ begin
  create type order_status as enum ('pending', 'ready', 'served');
exception when duplicate_object then null; end $$;

-- restaurants: one per owner
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists restaurants_user_id_idx on public.restaurants(user_id);

-- tables: dining tables with QR codes
create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_number int not null,
  qr_url text,
  created_at timestamptz not null default now(),
  unique (restaurant_id, table_number)
);

create index if not exists tables_restaurant_id_idx on public.tables(restaurant_id);

-- menus: menu items
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

-- orders: customer orders, items stored as jsonb [{ menu_id, qty }]
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

-- Enable realtime on orders
alter publication supabase_realtime add table public.orders;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.restaurants enable row level security;
alter table public.tables      enable row level security;
alter table public.menus       enable row level security;
alter table public.orders      enable row level security;

-- restaurants: owners manage their own; anonymous can read (customer needs restaurant name)
drop policy if exists restaurants_owner_all on public.restaurants;
create policy restaurants_owner_all on public.restaurants
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists restaurants_anon_read on public.restaurants;
create policy restaurants_anon_read on public.restaurants
  for select using (true);

-- tables: owner full access; anonymous can read (customer needs to validate table)
drop policy if exists tables_owner_all on public.tables;
create policy tables_owner_all on public.tables
  for all
  using (restaurant_id in (select id from public.restaurants where user_id = auth.uid()))
  with check (restaurant_id in (select id from public.restaurants where user_id = auth.uid()));

drop policy if exists tables_anon_read on public.tables;
create policy tables_anon_read on public.tables
  for select using (true);

-- menus: owner full access; anonymous read of available items
drop policy if exists menus_owner_all on public.menus;
create policy menus_owner_all on public.menus
  for all
  using (restaurant_id in (select id from public.restaurants where user_id = auth.uid()))
  with check (restaurant_id in (select id from public.restaurants where user_id = auth.uid()));

drop policy if exists menus_anon_read on public.menus;
create policy menus_anon_read on public.menus
  for select using (available = true);

-- orders: owner reads/updates their restaurant's orders; anonymous can insert
drop policy if exists orders_owner_select on public.orders;
create policy orders_owner_select on public.orders
  for select
  using (restaurant_id in (select id from public.restaurants where user_id = auth.uid()));

drop policy if exists orders_owner_update on public.orders;
create policy orders_owner_update on public.orders
  for update
  using (restaurant_id in (select id from public.restaurants where user_id = auth.uid()))
  with check (restaurant_id in (select id from public.restaurants where user_id = auth.uid()));

drop policy if exists orders_anon_insert on public.orders;
create policy orders_anon_insert on public.orders
  for insert with check (true);

-- ============================================================
-- Auto-create restaurant on signup
-- Runs as SECURITY DEFINER so it bypasses RLS, and works even
-- when email confirmation is enabled (no session yet at signup).
-- Restaurant name comes from auth.users.raw_user_meta_data.restaurant_name.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.restaurants (user_id, name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'restaurant_name', ''), 'My Restaurant')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Storage bucket for menu images
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
