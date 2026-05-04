-- ============================================================================
-- billing.suppliers — canonical schema
--
-- Backfilled in PR for supplier_type bug fix (2026-05-04) per
-- .claude/rules/database.md. The table itself was created in migration
-- 0013_billing_schema.sql; columns were added by 0055 (B2B contract +
-- billing fields) and 0071 (supplier_type, this PR).
--
-- Allowed supplier_type values mirror the admin UI dropdown — change
-- requires both a new migration and a UI update.
-- ============================================================================

create table if not exists billing.suppliers (
  id                       uuid        primary key default gen_random_uuid(),
  name                     text        not null,
  contact_email            text,
  contact_phone            text,
  address                  text,
  external_identifier      text,
  is_active                boolean     not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  -- Added in 0055
  legal_entity_name        text,
  abn                      text,
  primary_contact_name     text,
  primary_contact_phone    text,
  website                  text,
  billing_email            text,
  accounts_contact_name    text,
  accounts_contact_email   text,
  invoice_terms            text,
  payment_terms            text,
  preferred_payment_method text,
  bank_account_name        text,
  bsb                      text,
  bank_account_number      text,
  contract_start_date      date,
  contract_end_date        date,
  contract_status          text check (contract_status in ('active','pending','expired','terminated')),
  notes                    text,

  -- Added in 0071
  supplier_type            text check (
    supplier_type is null
    or supplier_type in (
      'Pathology', 'Imaging', 'Genomics', 'Supplements',
      'Fitness', 'Technology', 'Other'
    )
  )
);

alter table billing.suppliers enable row level security;

drop policy if exists "suppliers_active_select" on billing.suppliers;
create policy "suppliers_active_select" on billing.suppliers
  for select using (is_active = true);

drop policy if exists "suppliers_admin_all" on billing.suppliers;
create policy "suppliers_admin_all" on billing.suppliers
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists suppliers_set_updated_at on billing.suppliers;
create trigger suppliers_set_updated_at
  before update on billing.suppliers
  for each row execute function public.set_updated_at();
