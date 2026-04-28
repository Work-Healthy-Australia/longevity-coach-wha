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

### `plans`

```sql
create table public.plans (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  tier                text not null check (tier in ('individual', 'professional', 'corporate')),
  billing_interval    text not null check (billing_interval in ('month', 'year')),
  stripe_price_id     text not null unique,         -- soft-matches subscriptions.price_id
  base_price_cents    int  not null check (base_price_cents >= 0),
  annual_discount_pct numeric(5,2) not null default 0 check (annual_discount_pct between 0 and 100),
  feature_flags       jsonb not null default '{}'::jsonb,  -- ceiling of what this tier permits
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
```

**Notes:**
- `feature_flags` is the ceiling. No user or org can enable a flag not set here.
- `annual_discount_pct` drives the pricing calculator: `annual_total = base_price_cents × 12 × (1 - discount_pct/100)`.
- `base_price_cents` is per-seat for corporate plans; flat for individual/professional.

---

### `plan_addons`

Optional recurring feature add-ons, scoped to a tier.

```sql
create table public.plan_addons (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  description              text,
  feature_key              text not null unique,   -- e.g. 'supplement_protocol', 'pdf_export'
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
- `min_tier` gates which tiers can purchase this add-on (e.g. `genome_access` may require `professional` or above).
- `feature_key` is the canonical string used inside `feature_flags` JSONB across all tables.

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
| `plans` | SELECT active | SELECT active | ALL |
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
| 0007 | `0007_plans.sql` | `plans`, `plan_addons` tables + RLS + seed comment |
| 0008 | `0008_subscription_addons.sql` | `subscription_addons`, `test_orders` tables + RLS |
| 0009 | `0009_organisations.sql` | `organisations`, `organisation_addons`, `organisation_members` + RLS |
| 0010 | `0010_suppliers_products.sql` | `suppliers`, `products`, `products_public` view + RLS |

---

## Seeding `plans` from existing env vars

```sql
-- Run manually after 0007, substituting real Stripe price IDs:
-- insert into public.plans
--   (name, tier, billing_interval, stripe_price_id, base_price_cents, annual_discount_pct)
-- values
--   ('Individual Monthly', 'individual', 'month', '<STRIPE_PRICE_MONTHLY>', 0, 0),
--   ('Individual Annual',  'individual', 'year',  '<STRIPE_PRICE_ANNUAL>',  0, 0);
```

`priceIdForPlan()` in `lib/stripe/client.ts` is deprecated once checkout reads from `plans`.

---

## Open questions (data layer)

1. **Per-seat vs flat corporate pricing** — if corporate is per-seat, `organisations.seat_count` drives the total; if flat, `seat_count` is informational only.
2. **`feature_key` enum** — the exact string values for `plan_addons.feature_key` must be agreed and typed before migrations run. Suggested starting set: `supplement_protocol`, `pdf_export`, `genome_access`, `advanced_risk_report`, `dexa_ordering`.
3. **Org add-on billing** — corporate add-ons: does the org get a single Stripe subscription item per add-on (flat) or per-seat? This affects whether `organisation_addons` needs a Stripe subscription item ID column.
4. **Single-org constraint** — the unique index on `organisation_members.user_uuid` enforces one org per user. Remove it if multi-org membership is ever needed.
