-- ShopQR 0005: restaurant settings + operating hours
-- Run AFTER 0004_bundles.sql.

alter table public.restaurants
  add column if not exists accepting_orders boolean not null default true,
  add column if not exists open_time text,
  add column if not exists close_time text;

notify pgrst, 'reload schema';
