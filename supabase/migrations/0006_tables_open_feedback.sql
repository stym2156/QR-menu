-- ShopQR 0006: table open/close + feedback channel
-- Run AFTER 0005_settings.sql.

-- ============================================================
-- Tables: is_open flag
-- ============================================================
alter table public.tables
  add column if not exists is_open boolean not null default false;

create index if not exists tables_is_open_idx on public.tables(restaurant_id, is_open);

-- ============================================================
-- Feedback (owners send messages to platform admin)
-- ============================================================
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  email text,
  category text not null default 'general',
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_idx on public.feedback(created_at desc);
create index if not exists feedback_user_idx on public.feedback(user_id);

alter table public.feedback enable row level security;

-- Authenticated users can insert their own feedback.
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert to authenticated
  with check (user_id = auth.uid());

-- Users can see their own submitted feedback (status etc.).
drop policy if exists feedback_own_read on public.feedback;
create policy feedback_own_read on public.feedback
  for select to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
