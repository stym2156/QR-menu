-- ShopQR 0009: multi-staff roles
-- Run AFTER 0008.
--
-- Adds restaurant_members table — owner stays as restaurants.user_id (back-compat),
-- but ALL access policies switch to checking membership.
-- Staff members can manage orders + call-staff + read everything else;
-- only owners can write to menus/categories/tables/promotions/settings.

-- ============================================================
-- Role enum
-- ============================================================
do $$ begin
  create type restaurant_role as enum ('owner', 'staff');
exception when duplicate_object then null; end $$;

-- ============================================================
-- Members table
-- ============================================================
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

-- Backfill: existing owners become 'owner' members.
insert into public.restaurant_members (restaurant_id, user_id, role)
select id, user_id, 'owner'
from public.restaurants
where user_id is not null
on conflict (restaurant_id, user_id) do nothing;

-- ============================================================
-- Helper SQL functions
-- ============================================================
create or replace function public.has_restaurant_access(rid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.restaurant_members
    where restaurant_id = rid and user_id = auth.uid()
  );
$$;

create or replace function public.is_restaurant_owner(rid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.restaurant_members
    where restaurant_id = rid and user_id = auth.uid() and role = 'owner'
  );
$$;

-- ============================================================
-- Update signup trigger: also create owner membership.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
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

-- ============================================================
-- Update RLS: switch from "user_id = auth.uid()" to membership.
-- ============================================================

-- restaurants
drop policy if exists restaurants_owner_all on public.restaurants;
drop policy if exists restaurants_member_read on public.restaurants;
drop policy if exists restaurants_owner_update on public.restaurants;
drop policy if exists restaurants_owner_delete on public.restaurants;
create policy restaurants_member_read on public.restaurants
  for select using (has_restaurant_access(id));
create policy restaurants_owner_update on public.restaurants
  for update using (is_restaurant_owner(id))
  with check (is_restaurant_owner(id));

-- IMPORTANT: anonymous customers need to read restaurant info to render
-- the QR-scan customer menu page. Keep this in addition to member_read.
drop policy if exists restaurants_anon_read on public.restaurants;
create policy restaurants_anon_read on public.restaurants
  for select using (true);

-- Same for tables — customers need to verify the table on the menu page.
drop policy if exists tables_anon_read on public.tables;
create policy tables_anon_read on public.tables
  for select using (true);

-- menus: any member reads; only owner writes.
drop policy if exists menus_owner_all on public.menus;
drop policy if exists menus_member_read on public.menus;
drop policy if exists menus_owner_write on public.menus;
create policy menus_member_read on public.menus
  for select using (
    available = true or has_restaurant_access(restaurant_id)
  );
create policy menus_owner_write on public.menus
  for all
  using (is_restaurant_owner(restaurant_id))
  with check (is_restaurant_owner(restaurant_id));

-- categories
drop policy if exists categories_owner_all on public.categories;
drop policy if exists categories_member_read on public.categories;
drop policy if exists categories_owner_write on public.categories;
create policy categories_member_read on public.categories
  for select using (true);
create policy categories_owner_write on public.categories
  for all
  using (is_restaurant_owner(restaurant_id))
  with check (is_restaurant_owner(restaurant_id));

-- tables
drop policy if exists tables_owner_all on public.tables;
drop policy if exists tables_member_read on public.tables;
drop policy if exists tables_owner_write on public.tables;
create policy tables_member_read on public.tables
  for select using (true);
create policy tables_owner_write on public.tables
  for all
  using (is_restaurant_owner(restaurant_id))
  with check (is_restaurant_owner(restaurant_id));

-- orders: any member manages.
drop policy if exists orders_owner_select on public.orders;
drop policy if exists orders_owner_update on public.orders;
drop policy if exists orders_member_select on public.orders;
drop policy if exists orders_member_update on public.orders;
drop policy if exists orders_member_delete on public.orders;
create policy orders_member_select on public.orders
  for select using (has_restaurant_access(restaurant_id));
create policy orders_member_update on public.orders
  for update using (has_restaurant_access(restaurant_id))
  with check (has_restaurant_access(restaurant_id));
create policy orders_member_delete on public.orders
  for delete using (has_restaurant_access(restaurant_id));

-- call_staff_requests
drop policy if exists call_staff_owner_all on public.call_staff_requests;
drop policy if exists call_staff_member_all on public.call_staff_requests;
create policy call_staff_member_all on public.call_staff_requests
  for all
  using (has_restaurant_access(restaurant_id))
  with check (has_restaurant_access(restaurant_id));

-- promotions
drop policy if exists promotions_owner_all on public.promotions;
drop policy if exists promotions_member_read on public.promotions;
drop policy if exists promotions_owner_write on public.promotions;
create policy promotions_member_read on public.promotions
  for select using (active = true or has_restaurant_access(restaurant_id));
create policy promotions_owner_write on public.promotions
  for all
  using (is_restaurant_owner(restaurant_id))
  with check (is_restaurant_owner(restaurant_id));

-- ============================================================
-- RPC: look up user_id by email (for staff invitation flow)
-- security definer so it can read auth.users; but only returns the id,
-- not sensitive data.
-- ============================================================
create or replace function public.find_user_id_by_email(email_input text)
returns table (user_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select id as user_id
  from auth.users
  where lower(email) = lower(email_input)
  limit 1;
$$;

grant execute on function public.find_user_id_by_email(text) to authenticated;

-- ============================================================
-- restaurant_members table RLS
-- ============================================================
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

notify pgrst, 'reload schema';
