-- ShopQR 0007: service charge + VAT settings
-- Run AFTER 0006.

alter table public.restaurants
  add column if not exists service_charge_pct numeric(5, 2) not null default 0,
  add column if not exists vat_pct numeric(5, 2) not null default 0;

-- Defensive: clamp to sane range
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'restaurants_service_charge_pct_range'
  ) then
    alter table public.restaurants
      add constraint restaurants_service_charge_pct_range
      check (service_charge_pct >= 0 and service_charge_pct <= 100);
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'restaurants_vat_pct_range'
  ) then
    alter table public.restaurants
      add constraint restaurants_vat_pct_range
      check (vat_pct >= 0 and vat_pct <= 100);
  end if;
end $$;

notify pgrst, 'reload schema';
