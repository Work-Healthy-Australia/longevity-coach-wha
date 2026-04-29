# Pricing Feature — Database Design
**Date:** 2026-04-27
**Status:** Draft
**Relates to:** `2026-04-27-pricing-feature-proposal.md`

---

## Existing anchor — `subscriptions`

Written exclusively by the Stripe webhook. No new writers. The webhook will continue writing `price_id` as a raw Stripe string — the new `plans` table soft-references it via `stripe_price_id` with no FK change required.

```
subscriptions
  id                     uuid PK
  user_uuid              uuid FK → auth.users
  stripe_customer_id     text unique
  stripe_subscription_id text unique
  price_id               text          ← Stripe price ID (soft-ref to plans.stripe_price_id)
  status                 text
  current_period_end     timestamptz
  cancel_at_period_end   boolean
  created_at / updated_at timestamptz
```

---

## S1 — Plans

### `feature_keys`

The canonical registry of all valid feature identifiers. Fully managed by platform admin from the admin UI.

```sql
create table public.feature_keys (
  key         text primary key,   -- e.g. 'supplement_protocol', 'pdf_export'
  label       text not null,      -- human-readable: 'Supplement Protocol'
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Initial seed in migration 0007:
insert into public.feature_keys (key, label) values
  ('supplement_protocol',  'Supplement Protocol'),
  ('pdf_export',           'Branded PDF Export'),
  ('genome_access',        'Genome Analysis Access'),
  ('advanced_risk_report', 'Advanced Risk Report'),
  ('dexa_ordering',        'DEXA Scan Ordering');
```

**Notes:**
- Admin can create, edit, and delete feature keys from the admin UI. Deletion of a key that is referenced by `plan_features` or `plan_addons` must be blocked at the application layer (or via FK constraint) — deactivate instead.
- `is_active = false` soft-deletes the key; existing plan/add-on references are preserved for audit.

---

### `plans`

One row per tier. Monthly and annual billing are two Stripe price IDs on the same plan — admins do not create separate plans for each interval.

```sql
create table public.plans (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  tier                    text not null unique check (tier in ('individual', 'professional', 'corporate')),
  stripe_price_id_monthly text not null unique,
  stripe_price_id_annual  text unique,                     -- null if annual billing not offered for this tier
  base_price_cents        int  not null check (base_price_cents >= 0),
  annual_discount_pct     numeric(5,2) not null default 20 check (annual_discount_pct between 0 and 100),
  annual_price_cents      int  not null check (annual_price_cents >= 0),  -- stored, derived on write
  is_per_seat             boolean not null default false,   -- true for corporate
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
```

**Notes:**
- `unique (tier)` enforces one plan per tier — each row is a tier definition, not a billing interval.
- `annual_price_cents` is stored but always derived: `floor(base_price_cents * 12 * (1 - annual_discount_pct / 100))`. The application layer (or a DB trigger on `0007`) recalculates it whenever `base_price_cents` or `annual_discount_pct` changes. Admin never inputs this value directly.
- Resolving a subscription to a plan: `WHERE stripe_price_id_monthly = $1 OR stripe_price_id_annual = $1`.
- `base_price_cents` is per-seat for corporate (`is_per_seat = true`); flat for individual/professional.

---

### `plan_features`

Which feature keys are bundled into each plan tier at no extra charge (the "included" column in the employer dashboard).

```sql
create table public.plan_features (
  plan_id     uuid not null references public.plans(id) on delete cascade,
  feature_key text not null references public.feature_keys(key),
  primary key (plan_id, feature_key)
);
```

**Notes:**
- Admin UI presents this as a checkbox list sourced from `feature_keys` — no free-text input.
- The feature flag resolver checks this table for bundled access before checking `subscription_addons` / `organisation_addons`.

---

### `plan_addons`

Optional recurring feature add-ons, scoped to a minimum tier.

```sql
create table public.plan_addons (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  description              text,
  feature_key              text not null unique references public.feature_keys(key),
  stripe_price_id_monthly  text not null unique,
  stripe_price_id_annual   text not null unique,
  price_monthly_cents      int  not null check (price_monthly_cents >= 0),
  price_annual_cents       int  not null check (price_annual_cents >= 0),
  min_tier                 text not null check (min_tier in ('individual', 'professional', 'corporate')),
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
```

**Notes:**
- `feature_key` is a FK to `feature_keys.key` — admins pick from a dropdown, no free-text entry.
- `min_tier` gates which tiers can purchase this add-on (e.g. `genome_access` requires `professional` or above).

---

## S2 — Add-on Selection

### `subscription_addons`

Tracks which recurring add-ons a user has activated (maps to Stripe subscription items).

```sql
create table public.subscription_addons (
  id                        uuid primary key default gen_random_uuid(),
  user_uuid                 uuid not null references auth.users(id) on delete cascade,
  plan_addon_id             uuid not null references public.plan_addons(id),
  stripe_subscription_id    text not null,               -- FK to subscriptions.stripe_subscription_id
  stripe_subscription_item_id text not null unique,       -- Stripe sub item; used to remove the add-on
  status                    text not null default 'active' check (status in ('active', 'cancelled')),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (user_uuid, plan_addon_id)                       -- one of each add-on per user
);

create index subscription_addons_user_uuid_idx on public.subscription_addons(user_uuid);
```

---

### `test_orders`

One-time test purchases fulfilled by a supplier.

```sql
create table public.test_orders (
  id                      uuid primary key default gen_random_uuid(),
  user_uuid               uuid not null references auth.users(id) on delete restrict,
  product_id              uuid not null references public.products(id),
  stripe_payment_intent_id text unique,
  amount_cents            int  not null,                  -- retail price at time of order (snapshot)
  status                  text not null default 'pending'
                            check (status in ('pending', 'paid', 'fulfilling', 'completed', 'cancelled', 'refunded')),
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index test_orders_user_uuid_idx    on public.test_orders(user_uuid);
create index test_orders_product_id_idx   on public.test_orders(product_id);
```

**Notes:**
- `amount_cents` is snapshotted at order time — price changes on the product do not retroactively affect past orders.
- Status is driven by Stripe webhook (`payment_intent.succeeded` → `paid`) and manual supplier update.

---

## S3 — Employer Toggles

### `organisations`

```sql
create table public.organisations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  plan_id       uuid references public.plans(id),         -- must reference a 'corporate' tier plan
  seat_count    int  not null default 0 check (seat_count >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

---

### `organisation_addons`

Which feature add-ons the org has enabled for all members.

```sql
create table public.organisation_addons (
  org_id        uuid not null references public.organisations(id) on delete cascade,
  plan_addon_id uuid not null references public.plan_addons(id),
  enabled_at    timestamptz not null default now(),
  primary key (org_id, plan_addon_id)
);
```

**Notes:**
- Replaces the `feature_flags` JSONB blob from the earlier design. Typed rows are queryable, indexable, and auditable.
- Application enforces that an org can only enable add-ons whose `min_tier` ≤ their plan's tier.

---

### `organisation_members`

```sql
create table public.organisation_members (
  org_id     uuid not null references public.organisations(id) on delete cascade,
  user_uuid  uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('member', 'health_manager')),
  joined_at  timestamptz not null default now(),
  primary key (org_id, user_uuid)
);

create unique index organisation_members_user_uuid_idx
  on public.organisation_members(user_uuid);   -- one org per user
```

---

## S4 — Supplier Catalog

### `suppliers`

```sql
create table public.suppliers (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  contact_email       text,
  contact_phone       text,
  address             text,
  external_identifier text,                               -- ABN, provider number, etc.
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
```

---

### `products`

```sql
create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  supplier_id         uuid not null references public.suppliers(id) on delete restrict,
  product_code        text not null,
  name                text not null,
  description         text,
  category            text not null check (category in
                        ('imaging', 'pathology', 'genomics', 'hormonal', 'microbiome', 'other')),
  wholesale_cents     int  not null check (wholesale_cents >= 0),
  retail_cents        int  not null check (retail_cents >= 0),
  stripe_price_id     text unique,                        -- created in Stripe by admin; used at order time
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (supplier_id, product_code)
);

create index products_supplier_id_idx on public.products(supplier_id);
create index products_category_idx    on public.products(category);
```

**Notes:**
- `stripe_price_id` is populated by admin when the product is set up. The order flow calls `stripe.paymentIntents.create({ amount: retail_cents })` — no manual price entry at order time.
- `wholesale_cents` is hidden from all non-admin RLS policies.

---

## RLS summary

| Table | patient | health_manager | platform admin |
|---|---|---|---|
| `feature_keys` | SELECT active | SELECT active | ALL |
| `plans` | SELECT active | SELECT active | ALL |
| `plan_features` | SELECT | SELECT | ALL |
| `plan_addons` | SELECT active | SELECT active | ALL |
| `subscription_addons` | SELECT/INSERT/DELETE own | — | ALL |
| `test_orders` | SELECT/INSERT own | SELECT own org's | ALL |
| `organisations` | SELECT own org | SELECT + UPDATE own org | ALL |
| `organisation_addons` | SELECT own org | SELECT/INSERT/DELETE own org | ALL |
| `organisation_members` | SELECT own row | SELECT own org's rows | ALL |
| `suppliers` | — | SELECT active | ALL |
| `products` | — | SELECT active (retail only) | ALL |

`products_public` view (used by non-admin roles):
```sql
create view public.products_public as
  select id, supplier_id, product_code, name, description,
         category, retail_cents, stripe_price_id, is_active
  from public.products;
```

---

## Entity relationship

```
auth.users
  │
  ├── profiles (1:1)
  │
  ├── subscriptions (1:many)
  │       └── price_id ──────────────────────── soft-ref ──→ plans.stripe_price_id
  │
  ├── subscription_addons (1:many) ──────────────────────→ plan_addons
  │
  ├── test_orders (1:many) ──────────────────────────────→ products
  │                                                              │
  └── organisation_members (many:many)                   suppliers (1:many)
            │
            └── organisations ──── plan_id FK ──→ plans
                      │
                      └── organisation_addons ──────────→ plan_addons
```

---

## Migration plan

| # | File | Content |
|---|---|---|
| 0007 | `0007_plans.sql` | `feature_keys` (+ seed rows), `plans`, `plan_features`, `plan_addons` tables + RLS |
| 0008 | `0008_subscription_addons.sql` | `subscription_addons`, `test_orders` tables + RLS |
| 0009 | `0009_organisations.sql` | `organisations`, `organisation_addons`, `organisation_members` + RLS |
| 0010 | `0010_suppliers_products.sql` | `suppliers`, `products`, `products_public` view + RLS |

---

## Seeding `plans` from existing env vars

```sql
-- Run manually after 0007, substituting real values:
-- insert into public.plans
--   (name, tier, stripe_price_id_monthly, stripe_price_id_annual,
--    base_price_cents, annual_discount_pct, annual_price_cents)
-- values
--   ('Individual', 'individual', '<STRIPE_PRICE_MONTHLY>', '<STRIPE_PRICE_ANNUAL>',
--    <monthly_cents>, 20, floor(<monthly_cents> * 12 * 0.80));
--
-- One row per tier. annual_price_cents is computed here and kept in sync by
-- the trigger installed in 0007 on any update to base_price_cents or annual_discount_pct.
```

`priceIdForPlan()` in `lib/stripe/client.ts` is deprecated once checkout reads from `plans`.

---

## Open questions (data layer)

1. **Per-seat vs flat corporate pricing** — if corporate is per-seat, `organisations.seat_count` drives the total; if flat, `seat_count` is informational only. This also determines whether `is_per_seat` on `plans` is needed or can be dropped.
2. **Org add-on billing** — corporate add-ons: does the org get a single Stripe subscription item per add-on (flat) or per-seat? This affects whether `organisation_addons` needs a Stripe subscription item ID column.
3. **Single-org constraint** — the unique index on `organisation_members.user_uuid` enforces one org per user. Remove it if multi-org membership is ever needed.
