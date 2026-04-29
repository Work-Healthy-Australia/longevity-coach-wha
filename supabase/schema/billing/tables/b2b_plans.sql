-- Canonical schema: billing.b2b_plans
-- Last updated: migration 0052_pricing_admin_foundation
--
-- b2b_plans.org_id is authoritative (NOT NULL).
-- billing.organisations.b2b_plan_id is a nullable convenience pointer.
-- Write order: create b2b_plan first, then set organisations.b2b_plan_id on activation.

create table if not exists billing.b2b_plans (
  id                        uuid         primary key default gen_random_uuid(),
  org_id                    uuid         not null references billing.organisations(id) on delete cascade,
  name                      text         not null,
  billing_basis             text         not null default 'per_seat_monthly'
                            check (billing_basis in ('per_seat_monthly','per_seat_annual','flat_monthly','flat_annual')),
  negotiated_discount_pct   numeric(5,2) not null default 0
                            check (negotiated_discount_pct between 0 and 100),
  setup_fee_cents           int          not null default 0,
  contract_start_date       date,
  contract_end_date         date,
  minimum_commitment_months int          not null default 12,
  currency                  text         not null default 'AUD',
  max_seats_per_tier        int,
  status                    text         not null default 'draft'
                            check (status in ('draft','active','archived')),
  is_flagged_suspicious     boolean      not null default false,
  internal_notes            text,
  created_at                timestamptz  not null default now(),
  updated_at                timestamptz  not null default now()
);

create index if not exists b2b_plans_org_id_idx on billing.b2b_plans(org_id);

alter table billing.b2b_plans enable row level security;

create policy "admin full access" on billing.b2b_plans
  using     ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

drop trigger if exists b2b_plans_set_updated_at on billing.b2b_plans;
create trigger b2b_plans_set_updated_at
  before update on billing.b2b_plans
  for each row execute function public.set_updated_at();
