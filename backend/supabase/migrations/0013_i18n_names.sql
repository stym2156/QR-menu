-- ShopQR 0013: optional Lao + English names for menus & categories
-- Run AFTER 0012.
--
-- Owners can fill in name_lo and name_en alongside name (Thai). The customer
-- menu picks the column matching their selected locale, falling back to the
-- Thai name when a translation is missing. No client-side migration needed
-- because columns default to NULL.

alter table public.menus
  add column if not exists name_lo text,
  add column if not exists name_en text;

alter table public.categories
  add column if not exists name_lo text,
  add column if not exists name_en text;

notify pgrst, 'reload schema';
