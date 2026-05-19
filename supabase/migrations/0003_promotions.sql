-- ShopQR 0003: promotions (with image)
-- Run AFTER 0002_features.sql.

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

-- If table existed before (without image_url), add the column.
alter table public.promotions
  add column if not exists image_url text;

create index if not exists promotions_restaurant_idx on public.promotions(restaurant_id);
create index if not exists promotions_active_idx on public.promotions(restaurant_id, active);

alter table public.promotions enable row level security;

drop policy if exists promotions_owner_all on public.promotions;
create policy promotions_owner_all on public.promotions
  for all
  using (restaurant_id in (select id from public.restaurants where user_id = auth.uid()))
  with check (restaurant_id in (select id from public.restaurants where user_id = auth.uid()));

drop policy if exists promotions_anon_read on public.promotions;
create policy promotions_anon_read on public.promotions
  for select using (active = true);

-- Storage bucket for promotion images (separate from menu-images for hygiene)
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

notify pgrst, 'reload schema';
