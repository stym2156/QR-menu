-- Audit log — append-only history of who changed what in the restaurant.
-- Owners need this to investigate disputes (staff voided an order, kitchen
-- "lost" a ticket, suspicious refunds, etc.) without trusting verbal report.
--
-- Design notes:
--   * Action is free-form text using a dotted taxonomy ('order.cancel',
--     'bill.settle', ...) so we can add new tracked actions without a
--     schema migration each time.
--   * Details is jsonb — store cancel reason, payment method, totals, etc.
--   * Append-only: no UPDATE / DELETE policy. The whole point is that
--     history can't be tampered with after the fact.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_restaurant_idx
  on public.audit_logs (restaurant_id, created_at desc);
create index if not exists audit_logs_action_idx
  on public.audit_logs (restaurant_id, action, created_at desc);
create index if not exists audit_logs_target_idx
  on public.audit_logs (target_id);

alter table public.audit_logs enable row level security;

-- Anyone with restaurant access can read their restaurant's logs. Cooks
-- and waiters benefit from this when reviewing their own actions; owners
-- get the full picture.
drop policy if exists audit_logs_read on public.audit_logs;
create policy audit_logs_read on public.audit_logs
  for select using (has_restaurant_access(restaurant_id));

-- Inserts: any member can append a log for their restaurant. The actor
-- must match auth.uid() (or be null for system events) so members can't
-- log actions as someone else.
drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs
  for insert with check (
    has_restaurant_access(restaurant_id)
    and (actor_user_id is null or actor_user_id = auth.uid())
  );

-- No update / delete policies → append-only by RLS.
