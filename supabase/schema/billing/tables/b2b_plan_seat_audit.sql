-- Canonical schema: billing.b2b_plan_seat_audit
-- Last updated: migration 0052_pricing_admin_foundation
-- Append-only immutable log — no updated_at, no UPDATE/DELETE policies.

create table if not exists billing.b2b_plan_seat_audit (
  id             uuid        primary key default gen_random_uuid(),
  b2b_plan_id    uuid        not null references billing.b2b_plans(id) on delete cascade,
  allocation_id  uuid        not null references billing.b2b_plan_tier_allocations(id) on delete cascade,
  plan_id        uuid        not null references billing.plans(id),
  old_seat_count int,
  new_seat_count int         not null,
  delta          int         not null,
  changed_by     uuid        references auth.users(id),
  is_flagged     boolean     not null default false,
  flag_reason    text,
  reviewed_by    uuid        references auth.users(id),
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists b2b_seat_audit_plan_idx on billing.b2b_plan_seat_audit(b2b_plan_id);

alter table billing.b2b_plan_seat_audit enable row level security;

create policy "admin full access" on billing.b2b_plan_seat_audit
  using     ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));
