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

notify pgrst, 'reload schema';
