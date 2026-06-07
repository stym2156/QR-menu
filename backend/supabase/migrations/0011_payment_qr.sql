-- ShopQR 0011: payment QR code per restaurant
-- Run AFTER 0010.
--
-- Owners upload a bank/PromptPay QR image in /dashboard/settings.
-- The image is rendered at the bottom of printed receipts so customers
-- can scan to transfer.

alter table public.restaurants
  add column if not exists payment_qr_url text;

-- Storage bucket for payment QR images (separate from menu/promotion buckets).
insert into storage.buckets (id, name, public)
values ('payment-qr', 'payment-qr', true)
on conflict (id) do nothing;

drop policy if exists "payment-qr public read" on storage.objects;
create policy "payment-qr public read" on storage.objects
  for select using (bucket_id = 'payment-qr');

drop policy if exists "payment-qr owner write" on storage.objects;
create policy "payment-qr owner write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-qr');

drop policy if exists "payment-qr owner update" on storage.objects;
create policy "payment-qr owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'payment-qr' and owner = auth.uid());

drop policy if exists "payment-qr owner delete" on storage.objects;
create policy "payment-qr owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-qr' and owner = auth.uid());

notify pgrst, 'reload schema';
