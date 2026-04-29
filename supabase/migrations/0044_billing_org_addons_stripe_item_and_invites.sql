-- Migration 0044: pricing system gap-fill on top of 0013_billing_schema.sql
--
-- Audit (2026-04-29) showed 0013 already created plans, plan_addons,
-- subscription_addons, organisations, organisation_members, organisation_addons,
-- suppliers, products, products_public view, test_orders.
--
-- Two gaps remain for Sprint-2 pricing work, decided by James:
--   D4: Org add-ons billed FLAT (one Stripe sub item per add-on, not per seat).
--       organisation_addons therefore needs stripe_subscription_item_id +
--       stripe_subscription_id + status, mirroring subscription_addons.
--   D3: Corporate invites use email + CSV bulk upload. We need a billing.org_invites
--       table to record pending invites with single-use tokens.

-- ============================================================================
-- billing.organisation_addons — add Stripe linkage + status
-- ============================================================================

alter table billing.organisation_addons
  add column if not exists stripe_subscription_id      text,
  add column if not exists stripe_subscription_item_id text,
  add column if not exists status                      text not null default 'active'
    check (status in ('active', 'cancelled')),
  add column if not exists updated_at                  timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organisation_addons_stripe_item_unique'
  ) then
    alter table billing.organisation_addons
      add constraint organisation_addons_stripe_item_unique
      unique (stripe_subscription_item_id);
  end if;
end$$;

drop trigger if exists organisation_addons_set_updated_at on billing.organisation_addons;
create trigger organisation_addons_set_updated_at
  before update on billing.organisation_addons
  for each row execute function public.set_updated_at();

-- ============================================================================
-- billing.org_invites — pending corporate invites (email + CSV bulk)
-- ============================================================================

create table if not exists billing.org_invites (
  id            uuid        primary key default gen_random_uuid(),
  org_id        uuid        not null references billing.organisations(id) on delete cascade,
  email         text        not null,
  role          text        not null default 'member' check (role in ('member', 'health_manager')),
  token         text        not null unique,
  invited_by    uuid        references auth.users(id) on delete set null,
  status        text        not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at    timestamptz not null default (now() + interval '14 days'),
  accepted_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, email, status)
);

create index if not exists org_invites_org_id_idx     on billing.org_invites(org_id);
create index if not exists org_invites_token_idx      on billing.org_invites(token);
create index if not exists org_invites_email_idx      on billing.org_invites(email);

alter table billing.org_invites enable row level security;

drop policy if exists "org_invites_manager_all"   on billing.org_invites;
drop policy if exists "org_invites_admin_all"     on billing.org_invites;
drop policy if exists "org_invites_invitee_select" on billing.org_invites;

create policy "org_invites_manager_all" on billing.org_invites
  for all using (
    exists (
      select 1 from billing.organisation_members om
      where om.org_id = org_invites.org_id
        and om.user_uuid = auth.uid()
        and om.role = 'health_manager'
    )
  );

create policy "org_invites_admin_all" on billing.org_invites
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

-- The invitee themselves can read their own pending invite by token via service role,
-- so no patient-facing select policy is required here.

drop trigger if exists org_invites_set_updated_at on billing.org_invites;
create trigger org_invites_set_updated_at
  before update on billing.org_invites
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Decision marker for D2 (flat org pricing)
-- ============================================================================
-- billing.organisations.seat_count remains in the schema but is INFORMATIONAL only
-- under the flat-pricing model. The pricing calculator does NOT multiply by seat_count
-- for orgs. Documented here in case anyone asks why seat_count is non-zero but the
-- billed total is flat.
comment on column billing.organisations.seat_count is
  'Informational head-count for flat-priced corporate plans (D2: 2026-04-29).';
