-- ShopQR 0015: admin can reply to owner feedback
-- Run AFTER 0014.
--
-- Adds two columns so platform admins can write a reply that the
-- owner sees on their /dashboard/feedback page. The existing
-- feedback_own_read policy already lets owners read their own row,
-- so the reply is visible automatically once stored.

alter table public.feedback
  add column if not exists admin_reply text,
  add column if not exists replied_at timestamptz;

notify pgrst, 'reload schema';
