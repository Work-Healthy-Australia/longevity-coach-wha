# Pricing System — Database Design
**Date:** 2026-04-27 (updated 2026-04-29)
**Status:** Draft
**Relates to:** `feature-proposal.md`

---

## Existing anchor — `subscriptions`

Written exclusively by the Stripe webhook. No new writers. The webhook continues writing `price_id` as a raw Stripe string — the new `plans` table soft-references it via `stripe_price_id_monthly` / `stripe_price_id_annual` with no FK change required.

```
subscriptions
  id                     uuid PK
  user_uuid              uuid FK → auth.users
  stripe_customer_id     text unique
  stripe_subscription_id text unique
  price_id               text          ← Stripe price ID (soft-ref to plans.stripe_price_id_monthly or _annual)
  status                 text
  current_period_end     timestamptz
  cancel_at_period_end   boolean
  created_at / updated_at timestamptz
```

---

## S4 — Supplier & Product Catalog

Built first. Tiers depend on products for inclusions.

### `suppliers`

```sql
create table public.suppliers (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  supplier_type           text not null check (supplier_type in (
                            'pathology', 'imaging', 'fitness', 'medical',
                            'coaching', 'supplements', 'recovery', 'wearable', 'other')),
  legal_entity_name       text,
  abn                     text,
  primary_contact_name    text,
  primary_contact_email   text,
  primary_contact_phone   text,
  website                 text,
  address                 text,
  billing_email           text,
  accounts_contact_name   text,
  accounts_contact_email  text,
  invoice_terms           text,
  payment_terms           text,
  preferred_payment_method text,
  bank_account_name       text,
  bsb                     text,
  bank_account_number     text,
  contract_start_date     date,
  contract_end_date       date,
  contract_status         text check (contract_status in ('active', 'pending', 'expired', 'terminated')),
  notes                   text,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
```

---

### `products`

```sql
create table public.products (
  id                    uuid primary key default gen_random_uuid(),
  supplier_id           uuid not null references public.suppliers(id) on delete restrict,
  product_code          text not null,
  name                  text not null,
  description           text,
  category              text not null check (category in (
                          'imaging', 'pathology', 'genomics', 'hormonal',
                          'microbiome', 'fitness', 'supplements', 'coaching',
                          'recovery', 'wearable', 'other')),
  product_type          text not null check (product_type in (
                          'product', 'service', 'test', 'scan',
                          'session', 'subscription', 'bundle')),
  unit_type             text not null check (unit_type in (
                          'per_test', 'per_scan', 'per_session', 'per_month',
                          'per_year', 'per_unit', 'per_employee', 'per_patient')),
  subscription_type     text not null check (subscription_type in ('one_time', 'recurring')),
  delivery_method       text check (delivery_method in (
                          'digital', 'in_person', 'shipped', 'referral',
                          'lab', 'clinic', 'telehealth')),
  wholesale_cents       int  not null check (wholesale_cents >= 0),
  retail_cents          int  not null check (retail_cents >= 0),
  default_markup_pct    numeric(5,2),
  gst_applicable        boolean not null default true,
  minimum_order_qty     int not null default 1,
  lead_time_days        int,
  location_restrictions text,
  eligibility_notes     text,
  stripe_price_id       text unique,            -- set by admin after creating price in Stripe
  is_active             boolean not null default true,
  internal_notes        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (supplier_id, product_code)
);

create index products_supplier_id_idx  on public.products(supplier_id);
create index products_category_idx     on public.products(category);
create index products_sub_type_idx     on public.products(subscription_type);
```

**Notes:**
- `subscription_type` drives billing: `'recurring'` → Stripe subscription item; `'one_time'` → payment intent.
- `wholesale_cents` is hidden from all non-admin RLS policies.
- `stripe_price_id` is entered by admin after creating the price in the Stripe dashboard.

`products_public` view (non-admin roles):
```sql
create view public.products_public as
  select id, supplier_id, product_code, name, description,
         category, product_type, unit_type, subscription_type,
         delivery_method, retail_cents, gst_applicable,
         stripe_price_id, is_active
  from public.products;
```

---

### `janet_services`

Janet-owned internal services. Not linked to a supplier. Used exclusively in tier inclusions — supplier products are never bundled into tiers.

```sql
create table public.janet_services (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  internal_cost_cents int not null default 0 check (internal_cost_cents >= 0),
  retail_value_cents  int not null default 0 check (retail_value_cents >= 0),
  unit_type       text not null check (unit_type in (
                    'per_month', 'per_session', 'per_year', 'once_off', 'per_patient')),
  delivery_owner  text,                   -- e.g. 'Janet AI', 'Clinical Team', 'Admin'
  is_active       boolean not null default true,
  internal_notes  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Seed examples (in migration):
-- insert into public.janet_services (name, unit_type, delivery_owner) values
--   ('Janet AI Coach Access',       'per_month',   'Janet AI'),
--   ('Monthly AI Check-in',         'per_month',   'Janet AI'),
--   ('Human Health Check-in',       'per_session', 'Clinical Team'),
--   ('Health Coaching Session',     'per_session', 'Clinical Team'),
--   ('GP Review Coordination',      'per_session', 'Clinical Team'),
--   ('Health Risk Report',          'once_off',    'Janet AI'),
--   ('Advanced Risk Report',        'once_off',    'Janet AI'),
--   ('Corporate Dashboard Access',  'per_month',   'Admin'),
--   ('Onboarding',                  'once_off',    'Clinical Team'),
--   ('Employer Cohort Reporting',   'per_month',   'Admin');
```

---

## S1 — Tiers, Feature Flags & Inclusions

### `feature_keys`

Registry of all software feature identifiers. Each key carries a `tier_affinity` — the minimum tier required to access it. Access is resolved by level comparison; no join table is needed.

```sql
create table public.feature_keys (
  key            text primary key,
  label          text not null,
  description    text,
  tier_affinity  text not null check (tier_affinity in ('core', 'clinical', 'elite')),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Initial seed:
insert into public.feature_keys (key, label, tier_affinity) values
  ('ai_coach_access',      'Janet AI Coach',             'core'),
  ('supplement_protocol',  'Supplement Protocol',        'core'),
  ('pdf_export',           'Branded PDF Export',         'core'),
  ('clinician_access',     'Personal Clinician Access',  'clinical'),
  ('gp_coordination',      'GP Review Coordination',     'clinical'),
  ('advanced_risk_report', 'Advanced Risk Report',       'clinical'),
  ('genome_access',        'Genome Analysis Access',     'elite'),
  ('dexa_ordering',        'DEXA Scan Ordering',         'elite');
```

**Notes:**
- `tier_affinity` determines the minimum tier. Core features are available to all tiers; clinical features require Clinical or Elite; elite features require Elite.
- Admin can create, edit, and deactivate keys. Admin freely adds new `elite` keys — this is the primary mechanism for configuring what makes Elite premium.
- Deactivate rather than delete; hard-delete is blocked if users currently have access via this key.
- Tier rank mapping used by the resolver: `core = 1`, `clinical = 2`, `elite = 3`. A user with tier rank ≥ feature rank has access.

---

### `plans`

One row per tier. Monthly and annual are two Stripe price IDs on the same row.

```sql
create table public.plans (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  tier                    text not null unique check (tier in ('core', 'clinical', 'elite')),
  stripe_price_id_monthly text not null unique,
  stripe_price_id_annual  text unique,                    -- null if annual not offered
  base_price_cents        int  not null check (base_price_cents >= 0),
  annual_discount_pct     numeric(5,2) not null default 20 check (annual_discount_pct between 0 and 100),
  annual_price_cents      int  not null check (annual_price_cents >= 0),  -- stored, trigger-maintained
  setup_fee_cents         int  not null default 0 check (setup_fee_cents >= 0),
  minimum_commitment_months int not null default 1 check (minimum_commitment_months >= 1),
  currency                text not null default 'AUD',
  public_description      text,                           -- customer-facing copy
  internal_notes          text,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
```

**Notes:**
- `unique (tier)` enforces one plan per tier — no separate monthly/annual rows.
- `annual_price_cents` is stored but always derived: `floor(base_price_cents * 12 * (1 - annual_discount_pct / 100))`. A DB trigger on `0007` recalculates it whenever `base_price_cents` or `annual_discount_pct` changes. Admin never inputs this directly.
- Resolving a subscription to a plan: `WHERE stripe_price_id_monthly = $1 OR stripe_price_id_annual = $1`.

---

### `tier_inclusions`

Bundled Janet services per tier, with quantity, frequency, and margin tracking. Tiers contain only Janet-owned services — supplier products are never included here.

```sql
create table public.tier_inclusions (
  id                    uuid primary key default gen_random_uuid(),
  plan_id               uuid not null references public.plans(id) on delete cascade,
  janet_service_id      uuid not null references public.janet_services(id),
  quantity              int not null default 1 check (quantity >= 1),
  frequency             text not null check (frequency in (
                          'monthly', 'quarterly', 'annually', 'once_off', 'per_participant')),
  wholesale_cost_cents  int not null default 0,           -- snapshotted at inclusion time
  retail_value_cents    int not null default 0,           -- snapshotted at inclusion time
  is_visible_to_customer boolean not null default true,
  customer_description  text,                            -- customer-facing label override
  internal_notes        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (plan_id, janet_service_id)
);

create index tier_inclusions_plan_id_idx on public.tier_inclusions(plan_id);
```

**Notes:**
- `wholesale_cost_cents` and `retail_value_cents` are snapshotted when the inclusion is saved. Changes to the underlying service price do not auto-update inclusions — admin must re-save to refresh.
- Margin is always derived: `margin = retail_value_cents - wholesale_cost_cents`. Never stored.
- Supplier products are **not** in tiers. Patients purchase supplier products a la carte from the billing portal. For B2B clients, admin bundles specific products per plan via `b2b_plan_product_inclusions`.

---

## S2 — Add-on Selection

### `subscription_addons`

Active products a user has added on top of their tier. References `products` directly — no separately managed add-on entity.

```sql
create table public.subscription_addons (
  id                          uuid primary key default gen_random_uuid(),
  user_uuid                   uuid not null references auth.users(id) on delete cascade,
  product_id                  uuid not null references public.products(id),
  stripe_subscription_id      text not null,              -- FK to subscriptions.stripe_subscription_id
  stripe_subscription_item_id text not null unique,       -- used to remove the add-on
  status                      text not null default 'active' check (status in ('active', 'cancelled')),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (user_uuid, product_id)
);

create index subscription_addons_user_uuid_idx on public.subscription_addons(user_uuid);
```

**Notes:**
- Only applicable for products where `subscription_type = 'recurring'`. One-time products use `test_orders`.
- Available add-ons at checkout = `products WHERE is_active = true`. Tiers no longer include supplier products directly, so all active products are available as add-ons for standalone subscribers.

---

### `test_orders`

One-time product purchases fulfilled by a supplier.

```sql
create table public.test_orders (
  id                       uuid primary key default gen_random_uuid(),
  user_uuid                uuid not null references auth.users(id) on delete restrict,
  product_id               uuid not null references public.products(id),
  stripe_payment_intent_id text unique,
  amount_cents             int  not null,                 -- retail price snapshotted at order time
  status                   text not null default 'pending'
                             check (status in ('pending', 'paid', 'fulfilling', 'completed', 'cancelled', 'refunded')),
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index test_orders_user_uuid_idx  on public.test_orders(user_uuid);
create index test_orders_product_id_idx on public.test_orders(product_id);
```

---

## S3 — B2B Plans

### `platform_settings`

Key-value store for platform-level configuration. Seat cap default and suspicion thresholds live here so admin can tune them without a code deploy.

```sql
create table public.platform_settings (
  key         text primary key,
  value       text not null,
  description text,
  updated_at  timestamptz not null default now()
);

-- Seed:
insert into public.platform_settings (key, value, description) values
  ('b2b_max_seats_per_tier_default', '10000',
   'Default maximum seats per tier per B2B plan. Can be overridden per plan.'),
  ('b2b_suspicion_threshold_pct',    '50',
   'Flag a seat count increase as suspicious if it exceeds this % in a single update.'),
  ('b2b_suspicion_threshold_abs',    '500',
   'Flag a seat count increase as suspicious if it adds more than this many seats in a single update.');
```

---

### `b2b_plans`

A named package for one organisation. Replaces the old `organisations.plan_id → plans` pattern.

```sql
create table public.b2b_plans (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references public.organisations(id) on delete cascade,
  name                      text not null,
  billing_basis             text not null check (billing_basis in (
                              'per_seat_monthly', 'per_seat_annual', 'flat_monthly', 'flat_annual')),
  negotiated_discount_pct   numeric(5,2) not null default 0 check (negotiated_discount_pct between 0 and 100),
  setup_fee_cents           int not null default 0 check (setup_fee_cents >= 0),
  contract_start_date       date,
  contract_end_date         date,
  minimum_commitment_months int not null default 12,
  currency                  text not null default 'AUD',
  max_seats_per_tier        int,                             -- null = use platform_settings default
  status                    text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  is_flagged_suspicious     boolean not null default false,
  internal_notes            text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
```

**Notes:**
- `max_seats_per_tier`: if null, the app reads `platform_settings.b2b_max_seats_per_tier_default`. Admin can override per plan for large clients without changing the platform default.
- `is_flagged_suspicious`: set by the seat change audit trigger when a suspicious change is detected. Requires platform admin to review and clear before the plan can be activated or re-activated.

---

### `b2b_plan_tier_allocations`

One row per tier in a B2B plan.

```sql
create table public.b2b_plan_tier_allocations (
  id          uuid primary key default gen_random_uuid(),
  b2b_plan_id uuid not null references public.b2b_plans(id) on delete cascade,
  plan_id     uuid not null references public.plans(id),
  seat_count  int  not null check (seat_count >= 1),        -- upper bound enforced at application layer against plan's effective max
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (b2b_plan_id, plan_id)
);

create index b2b_alloc_plan_id_idx on public.b2b_plan_tier_allocations(b2b_plan_id);
```

**Notes:**
- Hard lower bound of 1 in the DB; upper bound is application-layer enforced using `coalesce(b2b_plans.max_seats_per_tier, platform_settings.b2b_max_seats_per_tier_default)`.
- Monthly cost: `sum(plans.base_price_cents × seat_count)` across all allocations. Annual cost applies `b2b_plans.negotiated_discount_pct`.

---

### `b2b_plan_seat_audit`

Immutable audit log of every seat count change. The suspicion check runs here.

```sql
create table public.b2b_plan_seat_audit (
  id               uuid primary key default gen_random_uuid(),
  b2b_plan_id      uuid not null references public.b2b_plans(id) on delete cascade,
  allocation_id    uuid not null references public.b2b_plan_tier_allocations(id) on delete cascade,
  plan_id          uuid not null references public.plans(id),
  old_seat_count   int,
  new_seat_count   int  not null,
  delta            int  not null,                            -- new - old (negative = reduction)
  changed_by       uuid references auth.users(id),
  is_flagged       boolean not null default false,
  flag_reason      text,                                     -- populated when is_flagged = true
  reviewed_by      uuid references auth.users(id),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);

create index seat_audit_plan_idx on public.b2b_plan_seat_audit(b2b_plan_id);
```

**Suspicion logic (application layer, runs before committing seat count change):**
```
1. Compute delta = new_seat_count - old_seat_count
2. If delta <= 0: no flag (reductions are not suspicious)
3. If delta > platform_settings.b2b_suspicion_threshold_abs: flag = true, reason = 'Absolute increase exceeds threshold'
4. If old_seat_count > 0 AND delta / old_seat_count > threshold_pct / 100: flag = true, reason = 'Percentage increase exceeds threshold'
5. If flagged: write audit row with is_flagged = true, set b2b_plans.is_flagged_suspicious = true, do NOT apply seat change until admin clears the flag
6. If not flagged: write audit row, apply seat change immediately
```

Admin clears the flag from the B2B plan editor → sets `is_flagged_suspicious = false`, fills `reviewed_by` + `reviewed_at` on the audit row, and applies the pending seat change.

---

### `b2b_plan_product_inclusions`

Supplier products hand-picked by admin to be bundled into a specific B2B plan for a specific tier allocation. This is the only place supplier products are "included" rather than purchased a la carte.

```sql
create table public.b2b_plan_product_inclusions (
  id                    uuid primary key default gen_random_uuid(),
  b2b_plan_id           uuid not null references public.b2b_plans(id) on delete cascade,
  allocation_id         uuid not null references public.b2b_plan_tier_allocations(id) on delete cascade,
  product_id            uuid not null references public.products(id),
  quantity              int not null default 1 check (quantity >= 1),
  frequency             text not null check (frequency in (
                          'monthly', 'quarterly', 'annually', 'once_off', 'per_participant')),
  wholesale_cost_cents  int not null default 0,           -- snapshotted at save time
  client_price_cents    int not null default 0,           -- what this client pays for this product
  is_visible_to_client  boolean not null default true,
  client_description    text,                            -- client-facing label override
  internal_notes        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (b2b_plan_id, allocation_id, product_id)
);

create index b2b_prod_incl_plan_idx  on public.b2b_plan_product_inclusions(b2b_plan_id);
create index b2b_prod_incl_alloc_idx on public.b2b_plan_product_inclusions(allocation_id);
```

**Notes:**
- `allocation_id` scopes the inclusion to a specific tier within the plan (e.g. only Elite-tier employees in this org get the DEXA scan).
- `wholesale_cost_cents` is snapshotted at save; changes to the product price require admin to re-save.
- `client_price_cents` can be 0 for fully-included products or set to a discounted client rate.
- Margin per inclusion: `client_price_cents - wholesale_cost_cents`.

---

### `organisations`

```sql
create table public.organisations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  b2b_plan_id   uuid references public.b2b_plans(id),    -- set once a B2B plan is activated
  seat_count    int  not null default 0 check (seat_count >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

---

### `organisation_members`

```sql
create table public.organisation_members (
  org_id         uuid not null references public.organisations(id) on delete cascade,
  user_uuid      uuid not null references auth.users(id) on delete cascade,
  tier_allocation_id uuid references public.b2b_plan_tier_allocations(id),  -- which tier the employee is on
  role           text not null default 'member' check (role in ('member', 'health_manager')),
  joined_at      timestamptz not null default now(),
  primary key (org_id, user_uuid)
);

create unique index organisation_members_user_idx on public.organisation_members(user_uuid);
```

**Notes:**
- `tier_allocation_id` determines the employee's feature access — it points to a specific tier allocation within the org's B2B plan.
- Unique index enforces one org per user.

---

## Feature flag resolution (runtime)

`lib/features/resolve.ts` — called from server components and API route guards.

```typescript
const TIER_RANK = { core: 1, clinical: 2, elite: 3 };

// Software feature access (feature_keys)
function canAccessFeature(userTier: Tier, featureKey: string): boolean {
  // 1. Platform admin → all features unlocked
  // 2. Look up feature_keys.tier_affinity for featureKey
  // 3. return TIER_RANK[userTier] >= TIER_RANK[feature.tier_affinity]
}

// B2B bundled product (b2b_plan_product_inclusions) — org members only
function hasBundledProduct(allocationId: string, productId: string): boolean {
  // Check b2b_plan_product_inclusions WHERE allocation_id = allocationId AND product_id = productId
}
```

**Resolution order for a full access check:**
```
1. Is the user a platform admin?          → all features unlocked
2. Resolve user's effective tier:
   - Standalone subscriber → their subscriptions.price_id → plans.tier
   - Org member            → their tier_allocation_id → b2b_plan_tier_allocations.plan_id → plans.tier
3. Software feature gate:  canAccessFeature(tier, featureKey)
4. Bundled Janet service:   tier_inclusions WHERE plan_id = plans[tier].id AND janet_service_id = ?
5. B2B bundled product:     hasBundledProduct(allocationId, productId)  [org members only]
6. Purchased add-on:        subscription_addons WHERE product_id = ? AND status = 'active'
7. Otherwise                → locked (show upsell / a la carte purchase)
```

---

## RLS summary

| Table | patient | health_manager | platform admin |
|---|---|---|---|
| `feature_keys` | SELECT active | SELECT active | ALL |
| `plans` | SELECT active | SELECT active | ALL |
| `tier_inclusions` | SELECT visible_to_customer | SELECT | ALL |
| `janet_services` | — | — | ALL |
| `subscription_addons` | SELECT/INSERT/DELETE own | — | ALL |
| `test_orders` | SELECT/INSERT own | SELECT own org's | ALL |
| `b2b_plans` | — | SELECT own org | ALL |
| `b2b_plan_tier_allocations` | — | SELECT own org | ALL |
| `organisations` | SELECT own org | SELECT + UPDATE own org | ALL |
| `organisation_members` | SELECT own row | SELECT own org | ALL |
| `suppliers` | — | SELECT active | ALL |
| `products` (via view) | SELECT active (retail only) | SELECT active (retail only) | ALL |

---

## Entity relationship

```
auth.users
  │
  ├── profiles (1:1)
  │
  ├── subscriptions (1:many)
  │       └── price_id ────────────────── soft-ref ──→ plans.stripe_price_id_monthly/_annual
  │
  ├── subscription_addons (1:many) ─────────────────→ products
  │
  ├── test_orders (1:many) ──────────────────────────→ products → suppliers
  │
  └── organisation_members (many:many)
            │
            └── organisations ──── b2b_plan_id ──→ b2b_plans
                      │                                  │
                      │                                  └── b2b_plan_tier_allocations ──→ plans
                      │
                      └── (member.tier_allocation_id) ──→ b2b_plan_tier_allocations

plans ──── plan_features ──→ feature_keys
plans ──── tier_inclusions ──→ janet_services
                           └──→ products → suppliers
```

---

## Migration plan

| # | File | Content |
|---|---|---|
| 0007 | `0007_plans.sql` | `feature_keys` (+ seed with tier_affinity), `plans` (+ annual_price trigger), `janet_services` (+ seed), `tier_inclusions` + RLS |
| 0008 | `0008_subscription_addons.sql` | `subscription_addons`, `test_orders` + RLS |
| 0009 | `0009_b2b_plans.sql` | `platform_settings` (+ seed), `b2b_plans`, `b2b_plan_tier_allocations`, `b2b_plan_seat_audit`, `organisations`, `organisation_members` + RLS |
| 0010 | `0010_suppliers_products.sql` | `suppliers`, `products`, `products_public` view + RLS |

Note: 0010 logically precedes 0007 in the build order (products needed for inclusions), but the migration numbers reflect the order they are written. Tier inclusions referencing products are added in 0007 after products exist from 0010 in the running DB. In practice, run 0010 first during local setup.

---

## Seeding `plans` from existing env vars

```sql
-- Run manually after 0007, substituting real values:
-- insert into public.plans
--   (name, tier, stripe_price_id_monthly, stripe_price_id_annual,
--    base_price_cents, annual_discount_pct, annual_price_cents,
--    currency, public_description)
-- values
--   ('Core', 'core', '<STRIPE_PRICE_MONTHLY>', '<STRIPE_PRICE_ANNUAL>',
--    <monthly_cents>, 20, floor(<monthly_cents> * 12 * 0.80), 'AUD', '...');
--
-- One row per tier. The trigger keeps annual_price_cents in sync on future updates.
```

`priceIdForPlan()` in `lib/stripe/client.ts` is deprecated once checkout reads from `plans`.

---

## Open questions (data layer)

1. **B2B Stripe billing** — does each `b2b_plan_tier_allocation` map to a separate Stripe subscription item, or does the org receive a single invoice line? Affects whether `b2b_plan_tier_allocations` needs a Stripe subscription item ID column.
2. **Single-org constraint** — the unique index on `organisation_members.user_uuid` enforces one org per user. Remove if multi-org membership is ever needed.
3. **Tier inclusion price drift** — wholesale/retail on inclusions are snapshotted. A scheduled check or admin alert for stale inclusion prices may be needed before Phase 3.
