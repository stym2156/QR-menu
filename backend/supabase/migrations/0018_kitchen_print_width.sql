-- ShopQR 0018: kitchen ticket print width per restaurant
-- Run AFTER 0017.
--
-- Owners pick the paper width their kitchen printer uses (58mm / 76mm /
-- 80mm) on /dashboard/settings. The auto-print kitchen-ticket builder
-- reads this column and formats the layout for that column count.

alter table public.restaurants
  add column if not exists kitchen_print_width int not null default 58;

-- Constrain to sane values; default 58 is the most common thermal width.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'restaurants_kitchen_print_width_range'
  ) then
    alter table public.restaurants
      add constraint restaurants_kitchen_print_width_range
      check (kitchen_print_width in (58, 76, 80));
  end if;
end $$;

notify pgrst, 'reload schema';
