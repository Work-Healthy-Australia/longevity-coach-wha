-- Canonical schema: billing.organisation_member_products
-- Last updated: migration 0052_pricing_admin_foundation
-- Employer-managed toggle: per-employee product enablement within a B2B plan.

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

create policy "admin full access" on billing.organisation_member_products
  using     ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

drop trigger if exists organisation_member_products_set_updated_at on billing.organisation_member_products;
create trigger organisation_member_products_set_updated_at
  before update on billing.organisation_member_products
  for each row execute function public.set_updated_at();
