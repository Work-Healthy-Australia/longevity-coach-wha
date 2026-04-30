-- Migration 0052: pricing administration foundation
--
-- Adds columns to billing.plans, billing.suppliers, billing.products,
-- then creates new tables for the pricing admin module:
--   janet_services, feature_keys, tier_inclusions, platform_settings,
--   b2b_plans, b2b_plan_tier_allocations, b2b_plan_seat_audit,
--   b2b_plan_product_inclusions, organisation_member_products
--
-- Also adds billing.organisations.b2b_plan_id after b2b_plans exists.

-- ============================================================================
-- billing.plans — column additions
-- ============================================================================

alter table billing.plans
  add column if not exists stripe_price_id_monthly text,
  add column if not exists stripe_price_id_annual   text,
  add column if not exists annual_price_cents        int  not null default 0 check (annual_price_cents >= 0),
  add column if not exists setup_fee_cents           int  not null default 0 check (setup_fee_cents >= 0),
  add column if not exists minimum_commitment_months int  not null default 1 check (minimum_commitment_months >= 1),
  add column if not exists public_description        text;

-- Back-fill stripe_price_id_monthly from the existing stripe_price_id
update billing.plans
   set stripe_price_id_monthly = stripe_price_id
 where stripe_price_id_monthly is null;

-- Expand the tier CHECK constraint to include new values (core, clinical, elite)
do $$ begin
  alter table billing.plans drop constraint if exists plans_tier_check;
exception when undefined_object then null;
end $$;

do $$ begin
  alter table billing.plans
    add constraint plans_tier_check
    check (tier in ('individual','professional','corporate','core','clinical','elite'));
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- billing.suppliers — column additions
-- ============================================================================

alter table billing.suppliers
  add column if not exists legal_entity_name        text,
  add column if not exists abn                      text,
  add column if not exists primary_contact_name     text,
  add column if not exists primary_contact_phone    text,
  add column if not exists website                  text,
  add column if not exists billing_email            text,
  add column if not exists accounts_contact_name    text,
  add column if not exists accounts_contact_email   text,
  add column if not exists invoice_terms            text,
  add column if not exists payment_terms            text,
  add column if not exists preferred_payment_method text,
  add column if not exists bank_account_name        text,
  add column if not exists bsb                      text,
  add column if not exists bank_account_number      text,
  add column if not exists contract_start_date      date,
  add column if not exists contract_end_date        date,
  add column if not exists contract_status          text check (contract_status in ('active','pending','expired','terminated')),
  add column if not exists notes                    text;

-- ============================================================================
-- billing.products — column additions
-- ============================================================================

alter table billing.products
  add column if not exists product_type        text check (product_type in ('product','service','test','scan','session','subscription','bundle')),
  add column if not exists unit_type           text check (unit_type in ('per_test','per_scan','per_session','per_month','per_year','per_unit','per_employee','per_patient')),
  add column if not exists subscription_type   text not null default 'one_time' check (subscription_type in ('one_time','recurring')),
  add column if not exists delivery_method     text check (delivery_method in ('digital','in_person','shipped','referral','lab','clinic','telehealth')),
  add column if not exists gst_applicable      boolean not null default true,
  add column if not exists minimum_order_qty   int not null default 1,
  add column if not exists lead_time_days      int,
  add column if not exists location_restrictions text,
  add column if not exists eligibility_notes   text,
  add column if not exists internal_notes      text;

-- ============================================================================
-- billing.janet_services
-- ============================================================================

create table if not exists billing.janet_services (
  id                  uuid        primary key default gen_random_uuid(),
  name                text        not null,
  description         text,
  internal_cost_cents int         not null default 0 check (internal_cost_cents >= 0),
  retail_value_cents  int         not null default 0 check (retail_value_cents >= 0),
  unit_type           text        not null default 'per_month'
                      check (unit_type in ('per_month','per_session','per_year','once_off','per_patient')),
  delivery_owner      text,
  is_active           boolean     not null default true,
  internal_notes      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table billing.janet_services enable row level security;

drop policy if exists "admin full access" on billing.janet_services;
create policy "admin full access" on billing.janet_services
  using     ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

drop trigger if exists janet_services_set_updated_at on billing.janet_services;
create trigger janet_services_set_updated_at
  before update on billing.janet_services
  for each row execute function public.set_updated_at();

-- ============================================================================
-- billing.feature_keys
-- ============================================================================

create table if not exists billing.feature_keys (
  key           text        primary key,
  label         text        not null,
  description   text,
  tier_affinity text        not null check (tier_affinity in ('core','clinical','elite')),
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table billing.feature_keys enable row level security;

drop policy if exists "admin full access" on billing.feature_keys;
create policy "admin full access" on billing.feature_keys
  using     ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

drop trigger if exists feature_keys_set_updated_at on billing.feature_keys;
create trigger feature_keys_set_updated_at
  before update on billing.feature_keys
  for each row execute function public.set_updated_at();

-- ============================================================================
-- billing.tier_inclusions
-- ============================================================================

create table if not exists billing.tier_inclusions (
  id                     uuid        primary key default gen_random_uuid(),
  plan_id                uuid        not null references billing.plans(id) on delete cascade,
  janet_service_id       uuid        not null references billing.janet_services(id),
  quantity               int         not null default 1 check (quantity >= 1),
  frequency              text        not null default 'monthly'
                         check (frequency in ('monthly','quarterly','annually','once_off','per_participant')),
  wholesale_cost_cents   int         not null default 0,
  retail_value_cents     int         not null default 0,
  is_visible_to_customer boolean     not null default true,
  customer_description   text,
  internal_notes         text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (plan_id, janet_service_id)
);

create index if not exists tier_inclusions_plan_id_idx on billing.tier_inclusions(plan_id);

alter table billing.tier_inclusions enable row level security;

drop policy if exists "admin full access" on billing.tier_inclusions;
create policy "admin full access" on billing.tier_inclusions
  using     ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

drop trigger if exists tier_inclusions_set_updated_at on billing.tier_inclusions;
create trigger tier_inclusions_set_updated_at
  before update on billing.tier_inclusions
  for each row execute function public.set_updated_at();

-- ============================================================================
-- billing.platform_settings
-- ============================================================================

create table if not exists billing.platform_settings (
  key         text        primary key,
  value       text        not null,
  description text,
  updated_at  timestamptz not null default now()
);

alter table billing.platform_settings enable row level security;

drop policy if exists "admin full access" on billing.platform_settings;
create policy "admin full access" on billing.platform_settings
  using     ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

-- platform_settings has no created_at — updated_at only, managed manually or via trigger
drop trigger if exists platform_settings_set_updated_at on billing.platform_settings;
create trigger platform_settings_set_updated_at
  before update on billing.platform_settings
  for each row execute function public.set_updated_at();

-- ============================================================================
-- billing.b2b_plans
-- (must be created BEFORE organisations.b2b_plan_id FK addition)
-- ============================================================================

create table if not exists billing.b2b_plans (
  id                        uuid        primary key default gen_random_uuid(),
  org_id                    uuid        not null references billing.organisations(id) on delete cascade,
  name                      text        not null,
  billing_basis             text        not null default 'per_seat_monthly'
                            check (billing_basis in ('per_seat_monthly','per_seat_annual','flat_monthly','flat_annual')),
  negotiated_discount_pct   numeric(5,2) not null default 0
                            check (negotiated_discount_pct between 0 and 100),
  setup_fee_cents           int         not null default 0,
  contract_start_date       date,
  contract_end_date         date,
  minimum_commitment_months int         not null default 12,
  currency                  text        not null default 'AUD',
  max_seats_per_tier        int,
  status                    text        not null default 'draft'
                            check (status in ('draft','active','archived')),
  is_flagged_suspicious     boolean     not null default false,
  internal_notes            text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists b2b_plans_org_id_idx on billing.b2b_plans(org_id);

alter table billing.b2b_plans enable row level security;

drop policy if exists "admin full access" on billing.b2b_plans;
create policy "admin full access" on billing.b2b_plans
  using     ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

drop trigger if exists b2b_plans_set_updated_at on billing.b2b_plans;
create trigger b2b_plans_set_updated_at
  before update on billing.b2b_plans
  for each row execute function public.set_updated_at();

-- ============================================================================
-- billing.organisations — add b2b_plan_id (after b2b_plans exists)
-- Note: b2b_plans.org_id is authoritative (NOT NULL).
--       organisations.b2b_plan_id is a nullable convenience pointer.
--       Write order: create b2b_plan first, then set organisations.b2b_plan_id on activation.
-- ============================================================================

alter table billing.organisations
  add column if not exists b2b_plan_id uuid references billing.b2b_plans(id);

-- ============================================================================
-- billing.b2b_plan_tier_allocations
-- ============================================================================

create table if not exists billing.b2b_plan_tier_allocations (
  id          uuid        primary key default gen_random_uuid(),
  b2b_plan_id uuid        not null references billing.b2b_plans(id) on delete cascade,
  plan_id     uuid        not null references billing.plans(id),
  seat_count  int         not null check (seat_count >= 1),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (b2b_plan_id, plan_id)
);

create index if not exists b2b_alloc_plan_id_idx on billing.b2b_plan_tier_allocations(b2b_plan_id);

alter table billing.b2b_plan_tier_allocations enable row level security;

drop policy if exists "admin full access" on billing.b2b_plan_tier_allocations;
create policy "admin full access" on billing.b2b_plan_tier_allocations
  using     ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

drop trigger if exists b2b_plan_tier_allocations_set_updated_at on billing.b2b_plan_tier_allocations;
create trigger b2b_plan_tier_allocations_set_updated_at
  before update on billing.b2b_plan_tier_allocations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- billing.b2b_plan_seat_audit  (append-only immutable log — no updated_at)
-- ============================================================================

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

drop policy if exists "admin full access" on billing.b2b_plan_seat_audit;
create policy "admin full access" on billing.b2b_plan_seat_audit
  using     ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

-- ============================================================================
-- billing.b2b_plan_product_inclusions
-- ============================================================================

create table if not exists billing.b2b_plan_product_inclusions (
  id                   uuid        primary key default gen_random_uuid(),
  b2b_plan_id          uuid        not null references billing.b2b_plans(id) on delete cascade,
  allocation_id        uuid        not null references billing.b2b_plan_tier_allocations(id) on delete cascade,
  product_id           uuid        not null references billing.products(id),
  quantity             int         not null default 1 check (quantity >= 1),
  frequency            text        not null default 'annually'
                       check (frequency in ('monthly','quarterly','annually','once_off','per_participant')),
  wholesale_cost_cents int         not null default 0,
  client_price_cents   int         not null default 0,
  is_visible_to_client boolean     not null default true,
  client_description   text,
  internal_notes       text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (b2b_plan_id, allocation_id, product_id)
);

create index if not exists b2b_prod_incl_plan_idx  on billing.b2b_plan_product_inclusions(b2b_plan_id);
create index if not exists b2b_prod_incl_alloc_idx on billing.b2b_plan_product_inclusions(allocation_id);

alter table billing.b2b_plan_product_inclusions enable row level security;

drop policy if exists "admin full access" on billing.b2b_plan_product_inclusions;
create policy "admin full access" on billing.b2b_plan_product_inclusions
  using     ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

drop trigger if exists b2b_plan_product_inclusions_set_updated_at on billing.b2b_plan_product_inclusions;
create trigger b2b_plan_product_inclusions_set_updated_at
  before update on billing.b2b_plan_product_inclusions
  for each row execute function public.set_updated_at();

-- ============================================================================
-- billing.organisation_member_products
-- ============================================================================

create table if not exists billing.organisation_member_products (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references billing.organisations(id) on delete cascade,
  user_uuid    uuid        not null references auth.users(id) on delete cascade,
  inclusion_id uuid        not null references billing.b2b_plan_product_inclusions(id) on delete cascade,
  is_enabled   boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (org_id, user_uuid, inclusion_id)
);

create index if not exists org_member_products_org_idx  on billing.organisation_member_products(org_id);
create index if not exists org_member_products_user_idx on billing.organisation_member_products(user_uuid);

alter table billing.organisation_member_products enable row level security;

drop policy if exists "admin full access" on billing.organisation_member_products;
create policy "admin full access" on billing.organisation_member_products
  using     ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

drop trigger if exists organisation_member_products_set_updated_at on billing.organisation_member_products;
create trigger organisation_member_products_set_updated_at
  before update on billing.organisation_member_products
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Annual price auto-compute trigger on billing.plans
-- (defined AFTER annual_price_cents column exists)
-- ============================================================================

create or replace function billing.compute_annual_price_cents()
returns trigger language plpgsql as $$
begin
  new.annual_price_cents := floor(new.base_price_cents * 12.0 * (1.0 - new.annual_discount_pct / 100.0))::int;
  return new;
end $$;

drop trigger if exists plans_compute_annual on billing.plans;
create trigger plans_compute_annual
  before insert or update of base_price_cents, annual_discount_pct
  on billing.plans
  for each row execute function billing.compute_annual_price_cents();

-- ============================================================================
-- Seed data
-- ============================================================================

insert into billing.feature_keys (key, label, tier_affinity) values
  ('ai_coach_access',      'Janet AI Coach',            'core'),
  ('supplement_protocol',  'Supplement Protocol',       'core'),
  ('pdf_export',           'Branded PDF Export',        'core'),
  ('clinician_access',     'Personal Clinician Access', 'clinical'),
  ('gp_coordination',      'GP Review Coordination',    'clinical'),
  ('advanced_risk_report', 'Advanced Risk Report',      'clinical'),
  ('genome_access',        'Genome Analysis Access',    'elite'),
  ('dexa_ordering',        'DEXA Scan Ordering',        'elite')
on conflict (key) do nothing;

insert into billing.platform_settings (key, value, description) values
  ('b2b_max_seats_per_tier_default', '10000', 'Default max seats per tier per B2B plan.'),
  ('b2b_suspicion_threshold_pct',    '50',    'Flag if seat increase > this % in one update.'),
  ('b2b_suspicion_threshold_abs',    '500',   'Flag if seat increase > this many seats in one update.')
on conflict (key) do nothing;
