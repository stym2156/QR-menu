-- ShopQR 0010: order cancellation with reason
-- Run AFTER 0009.
--
-- Cancel flow: kitchen marks order as 'cancelled' (with a reason note)
-- instead of deleting it, so the customer sees a "ยกเลิก" badge + reason
-- on their menu screen instead of "กำลังทำ".

-- Add 'cancelled' to the order_status enum. Safe to re-run.
do $$ begin
  alter type order_status add value if not exists 'cancelled';
exception when others then null; end $$;

alter table public.orders
  add column if not exists cancel_reason text;

notify pgrst, 'reload schema';
