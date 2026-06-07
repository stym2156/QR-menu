-- ShopQR 0022: Short table QR codes
-- Adds compact public table codes so QR URLs can use /t/{code}.

alter table public.tables
  add column if not exists short_code text;

create or replace function public.generate_table_short_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  code text;
begin
  loop
    code := upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 8));
    exit when not exists (
      select 1 from public.tables where short_code = code
    );
  end loop;
  return code;
end;
$$;

alter table public.tables
  alter column short_code set default public.generate_table_short_code();

update public.tables
set short_code = public.generate_table_short_code()
where short_code is null;

alter table public.tables
  alter column short_code set not null;

create unique index if not exists tables_short_code_key
  on public.tables(short_code);

create index if not exists tables_restaurant_short_code_idx
  on public.tables(restaurant_id, short_code);

notify pgrst, 'reload schema';
