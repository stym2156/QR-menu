-- ShopQR 0008: scheduled promotions (start_at / end_at)
-- Run AFTER 0007.

alter table public.promotions
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz;

create index if not exists promotions_schedule_idx
  on public.promotions(restaurant_id, active, start_at, end_at);

notify pgrst, 'reload schema';
