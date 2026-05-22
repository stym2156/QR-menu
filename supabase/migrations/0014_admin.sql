-- ShopQR 0014: platform admin role
-- Run AFTER 0013.
--
-- Adds an `app_admins` table for platform-level administrators
-- (the people running the SaaS, NOT individual restaurant owners).
-- Admins can see and edit ANY restaurant's metadata + read all feedback.
-- They are still subject to RLS — policies below grant the necessary access.

-- ============================================================
-- 1. app_admins table
-- ============================================================
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

-- Admins can read the admins list (so the UI can show "you are admin").
-- Regular users cannot see this table at all.
drop policy if exists app_admins_self_read on public.app_admins;
create policy app_admins_self_read on public.app_admins
  for select to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 2. Helper function: is_app_admin(uid)
-- ============================================================
create or replace function public.is_app_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = uid);
$$;

grant execute on function public.is_app_admin(uuid) to authenticated;

-- ============================================================
-- 3. RLS policies for admins
-- ============================================================
-- Restaurants — admins can SELECT/UPDATE/DELETE any row.
-- Existing owner-scoped policies still apply for owners.
drop policy if exists restaurants_admin_all on public.restaurants;
create policy restaurants_admin_all on public.restaurants
  for all to authenticated
  using (is_app_admin(auth.uid()))
  with check (is_app_admin(auth.uid()));

-- Feedback — admins can SELECT/UPDATE any row.
-- Owners can still see only their own (existing feedback_own_read policy).
drop policy if exists feedback_admin_read on public.feedback;
create policy feedback_admin_read on public.feedback
  for select to authenticated
  using (is_app_admin(auth.uid()));

drop policy if exists feedback_admin_update on public.feedback;
create policy feedback_admin_update on public.feedback
  for update to authenticated
  using (is_app_admin(auth.uid()))
  with check (is_app_admin(auth.uid()));

-- ============================================================
-- 4. Seed initial admin (test@test.com)
-- ============================================================
-- Conditional: only insert if the user exists. If you haven't signed up
-- with test@test.com yet, this is a no-op — sign up first, then re-run
-- this migration or insert manually:
--   insert into public.app_admins (user_id)
--   select id from auth.users where email = 'your@email.com'
--   on conflict do nothing;
do $$
declare
  v_uid uuid;
begin
  select id into v_uid from auth.users where email = 'test@test.com' limit 1;
  if v_uid is not null then
    insert into public.app_admins (user_id) values (v_uid)
      on conflict (user_id) do nothing;
  end if;
end $$;

notify pgrst, 'reload schema';
