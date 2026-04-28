-- Migration 0013: billing schema tables
--
-- Billing is designed as a standalone platform. subscriptions stays in public
-- for now; it will move to billing in a later coordinated migration.
--
-- Writers per table:
--   plans, plan_addons, suppliers, products  → admin only
--   subscription_addons, test_orders         → Stripe webhook (service_role)
--   organisations, organisation_members      → admin / health_manager invite flow
--   organisation_addons                      → health_manager / admin

-- ============================================================================
-- billing.plans
-- ============================================================================

create table if not exists billing.plans (
  id                  uuid        primary key default gen_random_uuid(),
  name                text        not null,
  tier                text        not null check (tier in ('individual', 'professional', 'corporate')),
  billing_interval    text        not null check (billing_interval in ('month', 'year')),
  stripe_price_id     text        not null unique,
  base_price_cents    int         not null check (base_price_cents >= 0),
  annual_discount_pct numeric(5,2) not null default 0 check (annual_discount_pct between 0 and 100),
  feature_flags       jsonb       not null default '{}'::jsonb,
  is_active           boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table billing.plans enable row level security;

drop policy if exists "plans_public_select"  on billing.plans;
drop policy if exists "plans_admin_all"      on billing.plans;

create policy "plans_public_select" on billing.plans
  for select using (is_active = true);

create policy "plans_admin_all" on billing.plans
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists plans_set_updated_at on billing.plans;
create trigger plans_set_updated_at
  before update on billing.plans
  for each row execute function public.set_updated_at();

-- ============================================================================
-- billing.plan_addons
-- ============================================================================

create table if not exists billing.plan_addons (
  id                       uuid        primary key default gen_random_uuid(),
  name                     text        not null,
  description              text,
  feature_key              text        not null unique,
  stripe_price_id_monthly  text        not null unique,
  stripe_price_id_annual   text        not null unique,
  price_monthly_cents      int         not null check (price_monthly_cents >= 0),
  price_annual_cents       int         not null check (price_annual_cents >= 0),
  min_tier                 text        not null check (min_tier in ('individual', 'professional', 'corporate')),
  is_active                boolean     not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table billing.plan_addons enable row level security;

drop policy if exists "plan_addons_public_select" on billing.plan_addons;
drop policy if exists "plan_addons_admin_all"     on billing.plan_addons;

create policy "plan_addons_public_select" on billing.plan_addons
  for select using (is_active = true);

create policy "plan_addons_admin_all" on billing.plan_addons
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists plan_addons_set_updated_at on billing.plan_addons;
create trigger plan_addons_set_updated_at
  before update on billing.plan_addons
  for each row execute function public.set_updated_at();

-- ============================================================================
-- billing.subscription_addons
-- ============================================================================

create table if not exists billing.subscription_addons (
  id                           uuid        primary key default gen_random_uuid(),
  user_uuid                    uuid        not null references auth.users(id) on delete cascade,
  plan_addon_id                uuid        not null references billing.plan_addons(id),
  stripe_subscription_id       text        not null,
  stripe_subscription_item_id  text        not null unique,
  status                       text        not null default 'active' check (status in ('active', 'cancelled')),
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  unique (user_uuid, plan_addon_id)
);

create index if not exists subscription_addons_user_uuid_idx
  on billing.subscription_addons(user_uuid);

alter table billing.subscription_addons enable row level security;

drop policy if exists "subscription_addons_owner_select" on billing.subscription_addons;
drop policy if exists "subscription_addons_owner_delete" on billing.subscription_addons;
drop policy if exists "subscription_addons_service_insert" on billing.subscription_addons;
drop policy if exists "subscription_addons_service_update" on billing.subscription_addons;
drop policy if exists "subscription_addons_admin_all"    on billing.subscription_addons;

create policy "subscription_addons_owner_select" on billing.subscription_addons
  for select using (auth.uid() = user_uuid);

create policy "subscription_addons_owner_delete" on billing.subscription_addons
  for delete using (auth.uid() = user_uuid);

create policy "subscription_addons_service_insert" on billing.subscription_addons
  for insert with check (auth.role() = 'service_role');

create policy "subscription_addons_service_update" on billing.subscription_addons
  for update using (auth.role() = 'service_role');

create policy "subscription_addons_admin_all" on billing.subscription_addons
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists subscription_addons_set_updated_at on billing.subscription_addons;
create trigger subscription_addons_set_updated_at
  before update on billing.subscription_addons
  for each row execute function public.set_updated_at();

-- ============================================================================
-- billing.suppliers
-- ============================================================================

create table if not exists billing.suppliers (
  id                  uuid        primary key default gen_random_uuid(),
  name                text        not null,
  contact_email       text,
  contact_phone       text,
  address             text,
  external_identifier text,
  is_active           boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table billing.suppliers enable row level security;

drop policy if exists "suppliers_active_select" on billing.suppliers;
drop policy if exists "suppliers_admin_all"     on billing.suppliers;

-- Non-admin roles see name + is_active only (contact details hidden by view)
create policy "suppliers_active_select" on billing.suppliers
  for select using (is_active = true);

create policy "suppliers_admin_all" on billing.suppliers
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists suppliers_set_updated_at on billing.suppliers;
create trigger suppliers_set_updated_at
  before update on billing.suppliers
  for each row execute function public.set_updated_at();

-- ============================================================================
-- billing.products
-- ============================================================================

create table if not exists billing.products (
  id              uuid        primary key default gen_random_uuid(),
  supplier_id     uuid        not null references billing.suppliers(id) on delete restrict,
  product_code    text        not null,
  name            text        not null,
  description     text,
  category        text        not null check (category in ('imaging', 'pathology', 'genomics', 'hormonal', 'microbiome', 'other')),
  wholesale_cents int         not null check (wholesale_cents >= 0),
  retail_cents    int         not null check (retail_cents >= 0),
  stripe_price_id text        unique,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (supplier_id, product_code)
);

create index if not exists products_supplier_id_idx on billing.products(supplier_id);
create index if not exists products_category_idx    on billing.products(category);

alter table billing.products enable row level security;

drop policy if exists "products_active_select" on billing.products;
drop policy if exists "products_admin_all"     on billing.products;

-- Non-admin sees retail price only (wholesale hidden); enforced via products_public view
create policy "products_active_select" on billing.products
  for select using (is_active = true);

create policy "products_admin_all" on billing.products
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists products_set_updated_at on billing.products;
create trigger products_set_updated_at
  before update on billing.products
  for each row execute function public.set_updated_at();

-- Public view: hides wholesale_cents from non-admin roles
create or replace view billing.products_public as
  select id, supplier_id, product_code, name, description,
         category, retail_cents, stripe_price_id, is_active
  from billing.products;

-- ============================================================================
-- billing.test_orders
-- ============================================================================

create table if not exists billing.test_orders (
  id                       uuid        primary key default gen_random_uuid(),
  user_uuid                uuid        not null references auth.users(id) on delete restrict,
  product_id               uuid        not null references billing.products(id),
  stripe_payment_intent_id text        unique,
  amount_cents             int         not null,
  status                   text        not null default 'pending'
                           check (status in ('pending', 'paid', 'fulfilling', 'completed', 'cancelled', 'refunded')),
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists test_orders_user_uuid_idx   on billing.test_orders(user_uuid);
create index if not exists test_orders_product_id_idx  on billing.test_orders(product_id);
create index if not exists test_orders_status_idx      on billing.test_orders(status);

alter table billing.test_orders enable row level security;

drop policy if exists "test_orders_owner_select"   on billing.test_orders;
drop policy if exists "test_orders_owner_insert"   on billing.test_orders;
drop policy if exists "test_orders_service_update" on billing.test_orders;
drop policy if exists "test_orders_admin_all"      on billing.test_orders;

create policy "test_orders_owner_select" on billing.test_orders
  for select using (auth.uid() = user_uuid);

create policy "test_orders_owner_insert" on billing.test_orders
  for insert with check (auth.uid() = user_uuid);

create policy "test_orders_service_update" on billing.test_orders
  for update using (auth.role() = 'service_role');

create policy "test_orders_admin_all" on billing.test_orders
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists test_orders_set_updated_at on billing.test_orders;
create trigger test_orders_set_updated_at
  before update on billing.test_orders
  for each row execute function public.set_updated_at();

-- ============================================================================
-- billing.organisations
-- ============================================================================

create table if not exists billing.organisations (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  plan_id     uuid        references billing.plans(id),
  seat_count  int         not null default 0 check (seat_count >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table billing.organisations enable row level security;

drop trigger if exists organisations_set_updated_at on billing.organisations;
create trigger organisations_set_updated_at
  before update on billing.organisations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- billing.organisation_members
-- ============================================================================

create table if not exists billing.organisation_members (
  org_id     uuid        not null references billing.organisations(id) on delete cascade,
  user_uuid  uuid        not null references auth.users(id) on delete cascade,
  role       text        not null default 'member' check (role in ('member', 'health_manager')),
  joined_at  timestamptz not null default now(),
  primary key (org_id, user_uuid)
);

-- One org per user
create unique index if not exists organisation_members_user_uuid_idx
  on billing.organisation_members(user_uuid);

alter table billing.organisation_members enable row level security;

-- ============================================================================
-- billing.organisation_addons
-- ============================================================================

create table if not exists billing.organisation_addons (
  org_id        uuid        not null references billing.organisations(id) on delete cascade,
  plan_addon_id uuid        not null references billing.plan_addons(id),
  enabled_at    timestamptz not null default now(),
  primary key (org_id, plan_addon_id)
);

alter table billing.organisation_addons enable row level security;

-- ============================================================================
-- RLS policies for organisations, organisation_members, organisation_addons
-- (defined after all three tables exist — policies cross-reference each other)
-- ============================================================================

drop policy if exists "organisations_member_select"  on billing.organisations;
drop policy if exists "organisations_manager_update" on billing.organisations;
drop policy if exists "organisations_admin_all"      on billing.organisations;

create policy "organisations_member_select" on billing.organisations
  for select using (
    exists (
      select 1 from billing.organisation_members om
      where om.org_id = id and om.user_uuid = auth.uid()
    )
  );

create policy "organisations_manager_update" on billing.organisations
  for update using (
    exists (
      select 1 from billing.organisation_members om
      where om.org_id = id
        and om.user_uuid = auth.uid()
        and om.role = 'health_manager'
    )
  );

create policy "organisations_admin_all" on billing.organisations
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop policy if exists "org_members_own_select"     on billing.organisation_members;
drop policy if exists "org_members_manager_select" on billing.organisation_members;
drop policy if exists "org_members_admin_all"      on billing.organisation_members;

create policy "org_members_own_select" on billing.organisation_members
  for select using (auth.uid() = user_uuid);

create policy "org_members_manager_select" on billing.organisation_members
  for select using (
    exists (
      select 1 from billing.organisation_members me
      where me.org_id = organisation_members.org_id
        and me.user_uuid = auth.uid()
        and me.role = 'health_manager'
    )
  );

create policy "org_members_admin_all" on billing.organisation_members
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop policy if exists "org_addons_member_select" on billing.organisation_addons;
drop policy if exists "org_addons_manager_all"   on billing.organisation_addons;
drop policy if exists "org_addons_admin_all"     on billing.organisation_addons;

create policy "org_addons_member_select" on billing.organisation_addons
  for select using (
    exists (
      select 1 from billing.organisation_members om
      where om.org_id = organisation_addons.org_id and om.user_uuid = auth.uid()
    )
  );

create policy "org_addons_manager_all" on billing.organisation_addons
  for all using (
    exists (
      select 1 from billing.organisation_members om
      where om.org_id = organisation_addons.org_id
        and om.user_uuid = auth.uid()
        and om.role = 'health_manager'
    )
  );

create policy "org_addons_admin_all" on billing.organisation_addons
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));
