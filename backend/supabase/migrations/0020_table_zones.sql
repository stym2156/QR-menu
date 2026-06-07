-- ShopQR 0020: Table zones
-- Adds restaurant-specific zones and assigns each table to a zone.
-- Table numbers are unique inside a zone, but may repeat across zones.

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

-- Every existing restaurant gets a default zone so existing tables remain valid.
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

notify pgrst, 'reload schema';
