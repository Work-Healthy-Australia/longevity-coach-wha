# Plan: Pricing Administration Module
Date: 2026-04-29
Phase: Phase 6 — Scale (billing infrastructure)
Status: Approved
Product owner sign-off: James Murray — "Design approved, use dev-loop and quickly complete this feature accurately and cleanly" (2026-04-29 session)

## Objective

Build the full pricing administration module: Tiers (Core/Clinical/Elite with Janet services + feature flags), Suppliers (full contact/billing/contract detail with nested products), and B2B Plan Builder (multi-tier seat allocation with bundled products per tier). Additionally build a Health Manager portal where employers can toggle which bundled products each individual employee receives. UI must match the approved wireframe in `docs/features/pricing/preview.html` and use existing admin CSS tokens.

## Scope

In scope:
- DB migrations: new tables (janet_services, feature_keys, tier_inclusions, platform_settings, b2b_plans, b2b_plan_tier_allocations, b2b_plan_seat_audit, b2b_plan_product_inclusions, organisation_member_products) + column additions to existing suppliers/products/plans
- Admin Tiers page (`/admin/tiers`): 3-tier card editor, Janet service inclusions, feature flag registry
- Admin Suppliers page (`/admin/suppliers`): full supplier card with nested products, expand/collapse
- Admin Plan Builder page (`/admin/plan-builder`): B2B org plan editor, tier allocations, bundled products picker, suspicious seat change banner
- Health Manager portal (`/org/members`): employee list with per-employee product toggles
- API routes for all CRUD operations
- Updated admin nav, canonical schema files, regenerated TS types

Out of scope:
- Stripe Checkout integration for new tiers (existing checkout continues to use `billing.plans.stripe_price_id`)
- Public-facing pricing page
- B2B org invite flow (existing `billing.org_invites` table is already in place)
- Supplier order routing notifications
- Health researcher pipeline worker

## Data model changes

New tables (all `billing` schema):
| Table | PII? | Typed? | Writer |
|---|---|---|---|
| `janet_services` | No | Typed cols | Admin only |
| `feature_keys` | No | Typed cols | Admin only |
| `tier_inclusions` | No | Typed cols | Admin only |
| `platform_settings` | No | key/value text | Admin only |
| `b2b_plans` | No | Typed cols | Admin only |
| `b2b_plan_tier_allocations` | No | Typed cols | Admin only |
| `b2b_plan_seat_audit` | No | Typed cols | Application layer (immutable) |
| `b2b_plan_product_inclusions` | No | Typed cols | Admin only |
| `organisation_member_products` | No | Typed cols | Health Manager via API |

Column additions to existing tables:
- `billing.plans`: add `stripe_price_id_monthly`, `stripe_price_id_annual`, `annual_price_cents` (trigger-maintained), `setup_fee_cents`, `minimum_commitment_months`, `public_description`. Keep existing `stripe_price_id` and `billing_interval` for backward compat. Update `tier` check constraint to allow `core | clinical | elite` alongside existing values.
- `billing.suppliers`: add `legal_entity_name`, `abn`, `primary_contact_name`, `primary_contact_phone`, `website`, `billing_email`, `accounts_contact_name`, `accounts_contact_email`, `invoice_terms`, `payment_terms`, `preferred_payment_method`, `bank_account_name`, `bsb`, `bank_account_number`, `contract_start_date`, `contract_end_date`, `contract_status`, `notes`
- `billing.products`: add `product_type`, `unit_type`, `subscription_type`, `delivery_method`, `gst_applicable`, `minimum_order_qty`, `lead_time_days`, `location_restrictions`, `eligibility_notes`, `internal_notes`
- `billing.organisations`: add `b2b_plan_id` FK → `billing.b2b_plans`

---

## Waves

### Wave 1 — Database foundation
**What James can see after this wave merges:** No visible UI change. All new tables exist in the DB and TypeScript types are regenerated — a safe, non-breaking foundation that leaves the app fully functional.

#### Task 1.1 — Schema migration (0052)
Files affected:
- `supabase/migrations/0052_pricing_admin_foundation.sql`
- `supabase/schema/billing/tables/janet_services.sql` (new canonical file)
- `supabase/schema/billing/tables/feature_keys.sql`
- `supabase/schema/billing/tables/tier_inclusions.sql`
- `supabase/schema/billing/tables/platform_settings.sql`
- `supabase/schema/billing/tables/b2b_plans.sql`
- `supabase/schema/billing/tables/b2b_plan_tier_allocations.sql`
- `supabase/schema/billing/tables/b2b_plan_seat_audit.sql`
- `supabase/schema/billing/tables/b2b_plan_product_inclusions.sql`
- `supabase/schema/billing/tables/organisation_member_products.sql`

What to build:
Write a single idempotent migration that:
1. Adds new columns to `billing.plans` (all `if not exists`): `stripe_price_id_monthly text`, `stripe_price_id_annual text`, `annual_price_cents int default 0`, `setup_fee_cents int default 0`, `minimum_commitment_months int default 1`, `public_description text`. Also update the tier check constraint with `alter table ... drop constraint if exists ... / add constraint ...` to allow `core | clinical | elite` in addition to existing values.
2. Adds new columns to `billing.suppliers` (all `if not exists`): legal_entity_name, abn, primary_contact_name, primary_contact_phone, website, billing_email, accounts_contact_name, accounts_contact_email, invoice_terms, payment_terms, preferred_payment_method, bank_account_name, bsb, bank_account_number, contract_start_date (date), contract_end_date (date), contract_status text check in ('active','pending','expired','terminated'), notes text.
3. Adds new columns to `billing.products` (all `if not exists`): product_type text check ('product','service','test','scan','session','subscription','bundle'), unit_type text check ('per_test','per_scan','per_session','per_month','per_year','per_unit','per_employee','per_patient'), subscription_type text check ('one_time','recurring') default 'one_time', delivery_method text check ('digital','in_person','shipped','referral','lab','clinic','telehealth'), gst_applicable bool default true, minimum_order_qty int default 1, lead_time_days int, location_restrictions text, eligibility_notes text, internal_notes text.
4. Adds `b2b_plan_id uuid references billing.b2b_plans(id)` to `billing.organisations` (nullable — must execute AFTER `billing.b2b_plans` is created). This creates an intentional bidirectional reference: `b2b_plans.org_id` is the authoritative join (NOT NULL, set at plan creation); `organisations.b2b_plan_id` is a denormalised convenience pointer (nullable, set when a plan is activated). Write order: create b2b_plan row first (with org_id), then update organisations.b2b_plan_id.
5. Creates new tables in order: `janet_services`, `feature_keys`, `tier_inclusions`, `platform_settings`, `b2b_plans`, `b2b_plan_tier_allocations`, `b2b_plan_seat_audit`, `b2b_plan_product_inclusions`, `organisation_member_products`.
6. Seeds `feature_keys` and `platform_settings` using `INSERT ... ON CONFLICT DO NOTHING`.
7. Creates `annual_price_cents` trigger function on `billing.plans`.
8. Enables RLS on all new tables; adds service_role-bypass policies.

Table definitions (exact SQL):

```sql
-- janet_services
create table if not exists billing.janet_services (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  internal_cost_cents int not null default 0 check (internal_cost_cents >= 0),
  retail_value_cents  int not null default 0 check (retail_value_cents >= 0),
  unit_type       text not null default 'per_month' check (unit_type in ('per_month','per_session','per_year','once_off','per_patient')),
  delivery_owner  text,
  is_active       boolean not null default true,
  internal_notes  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- feature_keys
create table if not exists billing.feature_keys (
  key            text primary key,
  label          text not null,
  description    text,
  tier_affinity  text not null check (tier_affinity in ('core','clinical','elite')),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- tier_inclusions
create table if not exists billing.tier_inclusions (
  id                     uuid primary key default gen_random_uuid(),
  plan_id                uuid not null references billing.plans(id) on delete cascade,
  janet_service_id       uuid not null references billing.janet_services(id),
  quantity               int not null default 1 check (quantity >= 1),
  frequency              text not null default 'monthly' check (frequency in ('monthly','quarterly','annually','once_off','per_participant')),
  wholesale_cost_cents   int not null default 0,
  retail_value_cents     int not null default 0,
  is_visible_to_customer boolean not null default true,
  customer_description   text,
  internal_notes         text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (plan_id, janet_service_id)
);

-- platform_settings
create table if not exists billing.platform_settings (
  key         text primary key,
  value       text not null,
  description text,
  updated_at  timestamptz not null default now()
);

-- b2b_plans
create table if not exists billing.b2b_plans (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references billing.organisations(id) on delete cascade,
  name                      text not null,
  billing_basis             text not null default 'per_seat_monthly' check (billing_basis in ('per_seat_monthly','per_seat_annual','flat_monthly','flat_annual')),
  negotiated_discount_pct   numeric(5,2) not null default 0 check (negotiated_discount_pct between 0 and 100),
  setup_fee_cents           int not null default 0,
  contract_start_date       date,
  contract_end_date         date,
  minimum_commitment_months int not null default 12,
  currency                  text not null default 'AUD',
  max_seats_per_tier        int,
  status                    text not null default 'draft' check (status in ('draft','active','archived')),
  is_flagged_suspicious     boolean not null default false,
  internal_notes            text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- b2b_plan_tier_allocations
create table if not exists billing.b2b_plan_tier_allocations (
  id          uuid primary key default gen_random_uuid(),
  b2b_plan_id uuid not null references billing.b2b_plans(id) on delete cascade,
  plan_id     uuid not null references billing.plans(id),
  seat_count  int  not null check (seat_count >= 1),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (b2b_plan_id, plan_id)
);

-- b2b_plan_seat_audit (append-only)
create table if not exists billing.b2b_plan_seat_audit (
  id             uuid primary key default gen_random_uuid(),
  b2b_plan_id    uuid not null references billing.b2b_plans(id) on delete cascade,
  allocation_id  uuid not null references billing.b2b_plan_tier_allocations(id) on delete cascade,
  plan_id        uuid not null references billing.plans(id),
  old_seat_count int,
  new_seat_count int not null,
  delta          int not null,
  changed_by     uuid references auth.users(id),
  is_flagged     boolean not null default false,
  flag_reason    text,
  reviewed_by    uuid references auth.users(id),
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);

-- b2b_plan_product_inclusions
create table if not exists billing.b2b_plan_product_inclusions (
  id                   uuid primary key default gen_random_uuid(),
  b2b_plan_id          uuid not null references billing.b2b_plans(id) on delete cascade,
  allocation_id        uuid not null references billing.b2b_plan_tier_allocations(id) on delete cascade,
  product_id           uuid not null references billing.products(id),
  quantity             int not null default 1 check (quantity >= 1),
  frequency            text not null default 'annually' check (frequency in ('monthly','quarterly','annually','once_off','per_participant')),
  wholesale_cost_cents int not null default 0,
  client_price_cents   int not null default 0,
  is_visible_to_client boolean not null default true,
  client_description   text,
  internal_notes       text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (b2b_plan_id, allocation_id, product_id)
);

-- organisation_member_products  (employer toggles products per employee)
create table if not exists billing.organisation_member_products (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references billing.organisations(id) on delete cascade,
  user_uuid       uuid not null references auth.users(id) on delete cascade,
  inclusion_id    uuid not null references billing.b2b_plan_product_inclusions(id) on delete cascade,
  is_enabled      boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, user_uuid, inclusion_id)
);
```

Seed data:
```sql
insert into billing.feature_keys (key, label, tier_affinity) values
  ('ai_coach_access',      'Janet AI Coach',             'core'),
  ('supplement_protocol',  'Supplement Protocol',        'core'),
  ('pdf_export',           'Branded PDF Export',         'core'),
  ('clinician_access',     'Personal Clinician Access',  'clinical'),
  ('gp_coordination',      'GP Review Coordination',     'clinical'),
  ('advanced_risk_report', 'Advanced Risk Report',       'clinical'),
  ('genome_access',        'Genome Analysis Access',     'elite'),
  ('dexa_ordering',        'DEXA Scan Ordering',         'elite')
on conflict (key) do nothing;

insert into billing.platform_settings (key, value, description) values
  ('b2b_max_seats_per_tier_default', '10000', 'Default max seats per tier per B2B plan.'),
  ('b2b_suspicion_threshold_pct',    '50',    'Flag a seat increase as suspicious if > this % in one update.'),
  ('b2b_suspicion_threshold_abs',    '500',   'Flag a seat increase as suspicious if > this many seats in one update.')
on conflict (key) do nothing;
```

Trigger for annual_price_cents on `billing.plans` (must execute AFTER the `annual_price_cents` column addition in step 1 — migration ordering is critical):
```sql
create or replace function billing.compute_annual_price_cents()
returns trigger language plpgsql as $$
begin
  new.annual_price_cents := floor(new.base_price_cents * 12 * (1 - new.annual_discount_pct / 100.0))::int;
  return new;
end $$;

drop trigger if exists plans_compute_annual on billing.plans;
create trigger plans_compute_annual
  before insert or update of base_price_cents, annual_discount_pct
  on billing.plans
  for each row execute function billing.compute_annual_price_cents();
```

RLS: enable RLS on all new tables. Add admin-only policies (check `profiles.is_admin` via a helper function, or use `service_role` bypass). Non-admin reads should return empty; admin reads are via `createAdminClient()` which bypasses RLS.

Acceptance criteria:
- `pnpm build` passes
- All new tables exist in Supabase after `supabase db push`
- `billing.feature_keys` has 8 rows; `billing.platform_settings` has 3 rows
- Trigger: updating `base_price_cents` on a plans row recalculates `annual_price_cents`
- All new tables have RLS enabled
- Existing tests still pass

#### Task 1.2 — Regenerate TypeScript types + canonical schema files
Files affected:
- `lib/supabase/database.types.ts` (regenerated)
- `supabase/schema/billing/tables/*.sql` (new canonical files — one per new table)

What to build:
1. Run `supabase gen types typescript --local > lib/supabase/database.types.ts`
2. Write canonical schema files for each new table (full CREATE TABLE statement with all columns, indexes, RLS, triggers as they now exist)
3. Update existing canonical files for `billing.plans`, `billing.suppliers`, `billing.products` to reflect added columns

Acceptance criteria:
- TypeScript types match new DB schema (all new tables present in `Database["billing"]["Tables"]`)
- Canonical schema files exist for all new tables
- `pnpm build` still passes

---

### Wave 2 — Admin Tiers page
**What James can see after this wave merges:** Navigate to `/admin/tiers` and see three tier cards (Core, Clinical, Elite). Clicking a tier expands an inline editor where admin sets monthly price, annual discount, Janet service inclusions (checkboxes), and feature flags (tier-grouped toggles). A live margin summary updates as services are added. Janet Services and Feature Keys are also manageable from this page.

#### Task 2.1 — Update admin nav + create Tiers route stub
Files affected:
- `app/(admin)/layout.tsx`
- `app/(admin)/admin/tiers/page.tsx` (new)
- `app/(admin)/admin/tiers/tiers.css` (new)

What to build:
1. In `layout.tsx`, add nav links for `Tiers` (`/admin/tiers`) and `Plan Builder` (`/admin/plan-builder`). Keep existing Plans/Addons/Suppliers/Products links — they remain functional.
2. Create `/admin/tiers/page.tsx` as a server component (RSC, `export const dynamic = "force-dynamic"`). Fetches in parallel:
   - `billing.plans` WHERE `tier IN ('core','clinical','elite')` (or all rows for now)
   - `billing.janet_services` WHERE `is_active = true`
   - `billing.tier_inclusions` (all rows, join with service names)
   - `billing.feature_keys` (all rows)
   Renders `<TiersClient>` passing all data as props.
3. Create `tiers.css` with scoped styles matching admin.css tokens (no custom properties — hardcoded hex).

#### Task 2.2 — TiersClient component
Files affected:
- `app/(admin)/admin/tiers/TiersClient.tsx` (new)

What to build:
A `"use client"` component that renders:
- Page header: "Tiers" title + subtitle + "+ Add Janet Service" and "+ Add Feature Key" buttons (opens inline modals)
- Three tier cards in a vertical stack. Each card:
  - Header row: tier name (Core/Clinical/Elite), tier badge, monthly price display, "Edit" button
  - Collapsed: shows inclusion count and active status
  - Expanded (toggle on Edit click): inline editor with:
    **Pricing section:** monthly price input (cents → dollars display), annual discount % input, calculated annual price display (read-only), setup fee, Stripe Monthly Price ID, Stripe Annual Price ID
    **Included Janet Services section:** table of all active janet_services with checkboxes; checked rows are included. Per-checked-row: qty input, frequency dropdown, wholesale $ (pre-filled from service, editable), retail $ (pre-filled, editable)
    **Feature Flags section:** three groups (Core inherited — greyed out, Clinical/Elite — this tier checkboxes, Elite-admin — editable list). Feature keys are displayed from `feature_keys` table grouped by `tier_affinity`.
    **Margin summary card:** live-computed total internal cost/mo, total retail value/mo, monthly price, gross margin $, gross margin %
- All mutations via API calls (no page reload — use React state updates)

State management:
- `expandedTier: 'core' | 'clinical' | 'elite' | null`
- Per-tier dirty state tracking
- Optimistic UI: update local state on save, show error toast on failure

#### Task 2.3 — Janet Services management panel
Files affected:
- `app/(admin)/admin/tiers/JanetServicesPanel.tsx` (new)

What to build:
A slide-over panel (position: fixed right, overlay) that shows all Janet services in a table with inline edit. Opened by the "+ Manage Janet Services" button. Uses the same CRUD pattern as CrudTable but custom-styled for this layout.

#### Task 2.4 — API routes for Tiers, Janet Services, Feature Keys
Files affected:
- `app/api/admin/tiers/[id]/route.ts` (new) — PUT to update plan pricing + Stripe IDs
- `app/api/admin/janet-services/route.ts` (new) — GET list, POST create
- `app/api/admin/janet-services/[id]/route.ts` (new) — PUT update, DELETE deactivate
- `app/api/admin/feature-keys/route.ts` (new) — GET list, POST create
- `app/api/admin/feature-keys/[id]/route.ts` (new) — PUT update, DELETE deactivate
- `app/api/admin/tier-inclusions/route.ts` (new) — POST create inclusion
- `app/api/admin/tier-inclusions/[id]/route.ts` (new) — PUT update, DELETE remove

All routes:
- Call `requireAdmin()` from `lib/admin/guard.ts` at the top
- Use `createAdminClient().schema("billing")` for all DB operations
- Validate body with Zod
- Return `NextResponse.json({ error })` on failure

Acceptance criteria:
- `/admin/tiers` renders without error
- Admin can click Edit on Core tier and see the inline editor open
- Admin can toggle a Janet service inclusion and save — inclusion row appears in DB
- Admin can set monthly price and see annual price auto-calculated (read from DB after save)
- Feature flags display in three groups; admin can add/remove elite flags
- Margin summary shows correct numbers based on included services
- `pnpm build` passes

---

### Wave 3 — Admin Suppliers page
**What James can see after this wave merges:** Navigate to `/admin/suppliers` and see a directory of suppliers with expand/collapse. Expanding HealthPath shows full contact/billing/contract detail in a 2-column grid and a nested products table with Add/Edit. Products show code, name, category, type, subscription type, retail price, wholesale price.

#### Task 3.1 — Suppliers page + SuppliersClient component
Files affected:
- `app/(admin)/admin/suppliers/page.tsx` (replace stub)
- `app/(admin)/admin/suppliers/SuppliersClient.tsx` (new)
- `app/(admin)/admin/suppliers/suppliers.css` (new)

What to build:
Server component fetches `billing.suppliers` with nested `billing.products`. Renders `<SuppliersClient>`.

`SuppliersClient` renders:
- Page header: "Suppliers" + subtitle + "+ Add Supplier" button
- Each supplier as a card with:
  - Header row (always visible): chevron icon, name, type pill, ABN, active status badge, product count, "Edit supplier" button
  - Expanded body (toggled by header click):
    - 2-column grid: left = Contact Details (legal entity, ABN, type, primary contact, email, phone, website, address), right = Billing & Contract (billing email, accounts contact, invoice terms, payment terms, preferred method, BSB/account, contract dates, contract status)
    - Products table below the 2-col grid: Code | Name | Category | Type | Sub | Retail | Wholesale | Status | Edit button
    - "+ Add Product" button above products table
  - Edit Supplier: expands a full form below the header (similar to edit in place)
  - Add Product: inline form slide-in below the products table
- Collapsed suppliers show just the header row

#### Task 3.2 — API routes for Suppliers and Products
Files affected:
- `app/api/admin/suppliers/route.ts` — GET list (with product counts), POST create
- `app/api/admin/suppliers/[id]/route.ts` — GET single (with products), PUT update, PATCH (toggle active)
- `app/api/admin/products/route.ts` — POST create
- `app/api/admin/products/[id]/route.ts` — PUT update, PATCH (toggle active)

What to build:
All routes use `requireAdmin()` + Zod validation + `createAdminClient().schema("billing")`.

For suppliers, PUT updates all contact/billing/contract fields. Response includes the full supplier row.
For products, POST requires `supplier_id`. All new fields accepted (product_type, unit_type, subscription_type, delivery_method, gst_applicable, etc.). `wholesale_cents` is accepted but the public-facing endpoint MUST NOT return it — use `products_public` view for non-admin queries.

Acceptance criteria:
- `/admin/suppliers` loads and shows supplier rows
- Clicking a supplier expands the 2-col detail + products table
- Admin can edit a supplier's ABN, billing email, contract dates and save
- Admin can add a product to a supplier — product appears in the nested table
- Wholesale price is visible in the admin products table
- `pnpm build` passes

---

### Wave 4 — Admin Plan Builder + Health Manager employee toggles
**What James can see after this wave merges:** Navigate to `/admin/plan-builder` and see a two-column layout: client list on the left, plan editor on the right. Admin can select an org, set tier allocations (Core/Clinical/Elite seats with live monthly total), add bundled products per tier allocation. A yellow warning banner appears when a suspicious seat change is detected. Health Managers can navigate to `/org/members` to see their employees and toggle which bundled products each employee receives.

#### Task 4.1 — Plan Builder page + PlanBuilderClient
Files affected:
- `app/(admin)/admin/plan-builder/page.tsx` (new)
- `app/(admin)/admin/plan-builder/PlanBuilderClient.tsx` (new)
- `app/(admin)/admin/plan-builder/plan-builder.css` (new)

What to build:
Server component fetches:
- `billing.organisations` (all orgs with their b2b_plan_id)
- `billing.b2b_plans` with `billing.b2b_plan_tier_allocations` (nested)
- `billing.b2b_plan_product_inclusions` (nested per allocation)
- `billing.plans` WHERE `tier IN ('core','clinical','elite')` for seat price reference
- `billing.products` WHERE `is_active = true` (for product picker)
- `billing.platform_settings` (suspicion thresholds)
- Flagged seat audit rows: `billing.b2b_plan_seat_audit` WHERE `is_flagged = true AND reviewed_at IS NULL`
- `billing.organisation_members` with `auth.users` email (for employee list)

`PlanBuilderClient` renders:
- Warning banner at top if any flagged seat changes exist (shows org name, tier, delta, %, approve/reject buttons)
- Two-column layout:
  - Left: client list (org name, plan name, seat total, monthly cost, status badge). Clicking selects the org.
  - Right: plan editor for selected org:
    - Plan details form: plan name, billing basis select, annual discount %, contract start/end, min commitment, max seats override, suspicion settings info box
    - Tier Allocations table: Core/Clinical/Elite rows, seat count input, price/seat (from plans), monthly subtotal. Live total bar below.
    - Bundled Products section: table of current product inclusions (product name, supplier tag, tier badge, qty, frequency, wholesale $, client price $, remove button). Product + tier picker dropdown to add new inclusion.
    - Members section (collapsible): employee list with per-product toggle rows (see Task 4.3)

Seat change logic: when admin changes seat count, before saving, compute delta. If `delta > threshold_abs OR (delta/old * 100 > threshold_pct)`, show inline confirmation: "This change (+N seats, +X%) exceeds suspicion threshold. Save anyway to flag for review." If confirmed, save with `is_flagged_suspicious = true` and write audit row with `is_flagged = true`.

#### Task 4.2 — API routes for B2B plans
Files affected:
- `app/api/admin/b2b-plans/route.ts` — GET list (with orgs + allocations), POST create
- `app/api/admin/b2b-plans/[id]/route.ts` — PUT update plan details, PATCH status
- `app/api/admin/b2b-plans/[id]/allocations/route.ts` — POST create/update allocation (includes suspicion check + audit log write)
- `app/api/admin/b2b-plans/[id]/product-inclusions/route.ts` — POST create inclusion, DELETE remove
- `app/api/admin/b2b-plans/[id]/seat-audit/[auditId]/review/route.ts` — POST approve/reject flagged seat change

Suspicion check in `PUT .../allocations`:
```
1. Read old seat_count from DB
2. Compute delta = newSeats - oldSeats
3. If delta <= 0: proceed without flag
4. Read thresholds from platform_settings
5. If delta > abs_threshold OR (old > 0 AND delta/old*100 > pct_threshold):
   - Write audit row with is_flagged = true
   - Set b2b_plans.is_flagged_suspicious = true
   - Return 200 with { flagged: true } — do NOT apply seat change yet
6. Else:
   - Apply seat change
   - Write audit row with is_flagged = false
   - Return 200 with { flagged: false }
```

Approve endpoint: reads `new_seat_count` from the flagged `b2b_plan_seat_audit` row, writes that value to `b2b_plan_tier_allocations.seat_count`, sets `reviewed_by`, `reviewed_at` on the audit row, clears `b2b_plans.is_flagged_suspicious = false`.
Reject endpoint: sets `reviewed_by`, `reviewed_at` on the audit row (marks as reviewed but rejected), clears `b2b_plans.is_flagged_suspicious = false`, discards the pending seat value — `b2b_plan_tier_allocations.seat_count` remains unchanged.

#### Task 4.3 — Health Manager employee product toggles
Files affected:
- `app/(app)/org/page.tsx` (new — Health Manager portal root, redirects to /org/members)
- `app/(app)/org/members/page.tsx` (new)
- `app/(app)/org/members/MembersClient.tsx` (new)
- `app/(app)/org/members/members.css` (new)
- `app/api/org/member-products/route.ts` (new) — POST toggle
- `proxy.ts` — add `/org` to protected prefixes

What to build:
**`/org/members` server component:** Checks `organisation_members` for the current user's `role = 'health_manager'`. If not health manager, redirect to `/dashboard`. Fetches:
- `billing.organisation_members` for this org with `profiles.full_name`
- `billing.b2b_plan_product_inclusions` for this org's active b2b_plan (products available to assign)
- `billing.organisation_member_products` for this org (current toggles per employee)

**`MembersClient`:** Renders a table of employees. For each employee row: name, email, tier badge. Below each row (expandable): a list of all bundled products from the B2B plan (grouped by tier allocation). Each product shows a toggle switch (`is_enabled`). Toggling calls `POST /api/org/member-products` with `{ user_uuid, inclusion_id, is_enabled }`.

**`POST /api/org/member-products`:** Role check — read current user from `createClient().auth.getUser()`, then query `billing.organisation_members` WHERE `user_uuid = currentUser.id AND role = 'health_manager'` using admin client. If no row found, return 403. Verify the target `user_uuid` in the request body belongs to the same `org_id`. Then upsert `billing.organisation_member_products` (`ON CONFLICT (org_id, user_uuid, inclusion_id) DO UPDATE SET is_enabled = excluded.is_enabled, updated_at = now()`). Returns `{ ok: true }`.

Note: If no `organisation_member_products` row exists for a user+inclusion, the default is `is_enabled = true` (all bundled products enabled by default; employer toggles OFF to restrict).

Acceptance criteria:
- `/admin/plan-builder` loads with the two-column layout
- Admin can select an org, see tier allocations, update seat counts
- Seat increase > threshold shows the suspicious change banner on the next page load
- Approve/reject clears the banner and applies/discards the change
- Admin can add a product inclusion to the Core tier of a plan
- Health Manager navigating to `/org/members` sees their employees
- Toggling a product for an employee creates/updates `organisation_member_products` row
- Non-health-manager user visiting `/org/members` is redirected to `/dashboard`
- `pnpm build` passes

---

## Key rules that apply throughout

- `.claude/rules/database.md`: bundle all related column additions for a feature into one migration; write canonical schema files alongside
- `.claude/rules/data-management.md`: no PII outside `profiles`; typed columns for anything queryable
- `.claude/rules/security.md`: `requireAdmin()` on all `/api/admin/` routes; health manager API validates role membership; wholesale_cents never returned from non-admin queries
- `.claude/rules/nextjs-conventions.md`: RSC for all page.tsx; `"use client"` only for interactive components; `export const dynamic = "force-dynamic"` on all data-fetching pages
- Admin CSS: use hardcoded hex tokens from `admin.css` — no CSS custom properties. Match card/table/button patterns from existing admin pages.
