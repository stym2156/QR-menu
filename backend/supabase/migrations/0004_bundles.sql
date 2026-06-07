-- ShopQR 0004: bundle quick-add per menu
-- Run AFTER 0003_promotions.sql.
-- Bundles are stored as jsonb array on each menu:
--   [{ "label": "ครึ่งลัง", "qty": 12 }, { "label": "ลัง", "qty": 24 }]
-- Customer can tap a bundle to add that many units to cart at once.

alter table public.menus
  add column if not exists bundles jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
