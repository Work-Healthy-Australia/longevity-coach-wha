-- Canonical schema: billing.janet_services
-- Last updated: migration 0052_pricing_admin_foundation

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

create policy "admin full access" on billing.janet_services
  using     ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

drop trigger if exists janet_services_set_updated_at on billing.janet_services;
create trigger janet_services_set_updated_at
  before update on billing.janet_services
  for each row execute function public.set_updated_at();
