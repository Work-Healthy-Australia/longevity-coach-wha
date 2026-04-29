# Pricing Feature — Proposal
**Date:** 2026-04-27 (updated 2026-04-29)
**Status:** Draft — pending design approval
**Source:** Voice brief + executive description (`docs/features/pricing/pricing-executive-description.md`)

---

## Overview

```
S4: Supplier & Product Catalog          ← built first; tiers depend on products
    └── S1: Tiers, Janet Services & Inclusions
            └── S2: User Add-ons (inferred from product catalog)
            └── S3: B2B Plans (multi-tier seat allocation)
```

Note: S4 is the foundation. Tier inclusions pull from both Janet services and supplier products, so the product catalog must exist before tiers can be fully configured.

---

## Subsystem 1 — Tiers, Janet Services & Inclusions

### What it is
Three subscription tiers — **Core**, **Clinical**, **Elite** — each defining a monthly base price and a set of bundled inclusions. Inclusions are drawn from two sources: Janet-owned internal services (e.g. AI coach access, GP review coordination) and supplier products/services (e.g. DEXA scan, blood panel). A feature flags layer controls access to software capabilities bundled with each tier.

Replaces the current two hardcoded Stripe price IDs with a DB-managed tier catalog.

### Tier summary

| Tier | Feature set | Who defines it |
|---|---|---|
| **Core** | Base UI + Janet AI (coach access, check-ins, risk report, supplement protocol, PDF export) | Fixed — these are the product foundation |
| **Clinical** | All Core + personal Clinician access (human coaching sessions, GP review coordination, advanced risk report) | Fixed — clinician access IS the Clinical differentiator |
| **Elite** | All Clinical + admin-defined premium features | **Admin controls this** — admin creates and assigns Elite-only feature keys freely |

The tier model is additive and hierarchical. A feature has a `tier_affinity` (core / clinical / elite) which sets the **minimum tier** needed to access it. A Core-tier user gets all `core` features; a Clinical user gets `core` + `clinical` features; an Elite user gets all three.

Admin's primary lever for Elite is creating new feature keys marked `elite` — e.g. genome analysis, DEXA ordering, priority queue access, white-glove onboarding. There is no upper limit on how many Elite-only features admin can define.

### What it needs
- `plans` table: one row per tier (Core / Clinical / Elite), with monthly Stripe price ID, annual Stripe price ID, `annual_discount_pct`, stored `annual_price_cents` (auto-computed), `setup_fee`, `minimum_commitment_months`, `currency`, `public_description`, `internal_notes`
- `janet_services` table: Janet-owned internal services with internal cost and retail value (e.g. AI coach access, monthly check-in, human health coaching, GP coordination, report generation, corporate dashboard access)
- `tier_inclusions` join table: links a tier to a Janet service with `quantity`, `frequency`, `wholesale_cost_cents`, `retail_value_cents`, and derived margin — tracks what is bundled and what is customer-visible. Supplier products are **not** bundled into tiers.
- `feature_keys` registry with `tier_affinity` field (core / clinical / elite): each feature key carries the minimum tier required to access it — no join table needed, access resolves by level comparison (`user_tier_rank >= feature.tier_affinity_rank`). Admin freely adds Elite-only keys from the admin UI.
- Admin Plan Builder UI: single page covering tiers, Janet services, suppliers, and products — see Plan Builder section below
- Stripe checkout updated to resolve by `plan_id` + billing interval toggle
- Public pricing page: tier comparison with monthly/annual toggle, auto-calculated savings, and customer-facing inclusion list

### Actors
- **Platform admin** — creates and manages all tiers, services, suppliers, products
- **Patient / standalone user** — selects a tier at signup or upgrades

### Success criteria
- New tier published from admin UI and immediately available at checkout
- Annual price auto-calculated as `base_price_cents × 12 × (1 - annual_discount_pct / 100)` and stored — admin never inputs annual price directly
- Tier inclusion builder shows live margin summary (total wholesale cost vs total retail value)
- No Stripe price IDs hardcoded in application code

---

## Subsystem 2 — User Add-ons (inferred from product catalog)

### What it is
After subscribing to a tier, a user can add any active supplier product not already included in their tier. There is no separately managed add-ons entity — available add-ons are derived at runtime from the product catalog minus the user's tier inclusions.

### Two add-on types

**Recurring:** products with `subscription_type = 'recurring'` (e.g. ongoing coaching session, monthly supplement delivery). Billed as Stripe subscription items on the user's existing subscription.

**One-time:** products with `subscription_type = 'one_time'` (e.g. DEXA scan, blood panel, genetic test). Billed as Stripe payment intents.

### What it needs
- `subscription_addons` table: active products a user has added on top of their tier (references `products.id`, not a separate plan_addons table)
- `test_orders` table: one-time product purchases with Stripe payment intent ID and fulfillment status
- Add-on picker UI on pricing page and account/billing page — populated from the live product catalog, filtered against tier inclusions
- Running total component: base tier price + selected recurring add-on prices

### Actors
- **Standalone user** — selects and manages their add-ons
- **Platform** — routes test orders to the appropriate supplier

### Success criteria
- Available add-ons at checkout are always derived live from the product catalog minus the user's tier inclusions — no manual add-on list maintained by admin
- One-time test orders create a Stripe payment intent at the product's retail price
- No `plan_addons` table exists or is managed in the admin UI

---

## Subsystem 3 — B2B Plans (multi-tier seat allocation)

### What it is
A B2B plan lets an employer purchase a mix of Core, Clinical, and Elite seats for their employee base. A single org can hold **N Core + M Clinical + Z Elite seats**, where each count can be zero. The monthly charge is the sum of each tier's per-seat price × seat count.

**Seat cap:** 10,000 per tier per plan. This covers enterprises up to ~30,000 employees at a 30% participation rate. Clients above this threshold require a custom offline contract.

### Billing formula
```
b2b_monthly = sum(tier.base_price_cents × allocation.seat_count) across all allocations
b2b_annual  = b2b_monthly × 12 × (1 - negotiated_annual_discount_pct / 100)
```

### What it needs
- `b2b_plans` table: a named package linked to one org, with negotiated annual discount, contract dates, billing basis, and status
- `b2b_plan_tier_allocations` join table: one row per tier in the plan, with seat count enforced 1–10,000
- `b2b_plan_product_inclusions` join table: supplier products hand-picked by admin per tier allocation within a B2B plan — this is the only place supplier products are "bundled" rather than purchased a la carte
- `organisations` updated to reference a `b2b_plan` instead of a single `plans` row
- Health Manager UI: org's tier allocations, seat counts, and live monthly/annual cost breakdown
- Employee management: invite employees by email, assign to a tier allocation, manage roles
- Platform admin UI: create/edit B2B plans, tier allocations, and bundled products per tier inside the Plan Builder tab

### Actors
- **Platform admin** — creates B2B plans, sets tier allocations and contract terms
- **Health Manager** — manages employee invitations, views cost breakdown
- **Employee (org member)** — accesses features matching the tier they are allocated to

### Success criteria
- A B2B plan can hold any combination of tier allocations (e.g. 100 Core + 20 Clinical + 0 Elite)
- Monthly and annual cost display updates live as seat counts change in the builder
- An employee's feature access is determined by the tier they are allocated to

---

## Subsystem 4 — Supplier & Product Catalog

### What it is
The back-office fulfillment registry. Suppliers are registered with full contact, billing, invoicing, and contract details. Each supplier has products and services attached. Products feed two places: the **tier inclusions** builder (S1) and the **available add-ons** list (S2).

### Two pricing layers
- **Wholesale price** — what the platform pays the supplier. Never visible to non-admin roles.
- **Retail price** — what is charged to the patient or corporate account at checkout.

### Product types from James's vision
Supplier types: pathology, imaging, fitness, medical, coaching, supplements, recovery, wearable, other.
Unit types: per test, per scan, per session, per month, per year, per unit, per employee.
Delivery methods: digital, in-person, shipped, referral, lab, clinic, telehealth.

### What it needs
- `suppliers` table: name, legal entity, ABN, primary contact, billing contact, accounts contact, bank/payment details, invoice terms, contract dates and status, notes
- `products` table: supplier FK, product code, name, category, product type, unit type, description, wholesale/retail price, default markup, GST treatment, minimum order, lead time, delivery method, `subscription_type` (`one_time` | `recurring`), active status
- `janet_services` table (Janet-owned services): service name, description, internal cost, retail value, unit type, delivery owner, active status
- Admin UI: supplier directory, product catalog, Janet services catalog — all within the Plan Builder tab

### Actors
- **Platform admin** — full CRUD on suppliers, products, Janet services
- **Health Manager** — read-only product catalog (retail price only, no wholesale)
- **Patient / standalone user** — orders products via the add-on flow

### Success criteria
- Admin registers a supplier with full contact/billing/contract detail
- Products automatically appear in the tier inclusion picker and in the available add-ons list
- Wholesale price never readable by non-admin roles

---

## Admin navigation structure

Three distinct admin sections:

**Tiers** (`/admin/tiers`) — B2C product configuration. Core, Clinical, and Elite tier cards. Click a tier to expand the editor: pricing, included Janet services, included supplier products, feature flags, live margin summary. This is not the "Plan Builder" — it is the definition of what each tier is.

**Suppliers** (`/admin/suppliers`) — Supplier directory. Each supplier row expands inline to show full contact, billing, and contract details. Products for that supplier are nested directly below the supplier detail — there is no separate Products section. Admin adds and edits products from within the expanded supplier.

**Plan Builder** (`/admin/plan-builder`) — B2B only. Build multi-tier seat allocation packages for corporate clients. Select org, define Core/Clinical/Elite seat counts (1–10,000 per tier, capped by platform setting), set contract terms and negotiated annual discount, view live monthly and annual cost.

---

## Build Order & Dependencies

| Sprint | Subsystem | Depends on |
|---|---|---|
| 1 | S4 — Supplier & Product Catalog | Nothing |
| 2 | S1 — Tiers, Janet Services & Inclusions | S4 (products needed for tier inclusions) |
| 3 | S2 — User Add-ons | S1 (tier inclusions define what is excluded from add-ons), S4 |
| 4 | S3 — B2B Plans | S1 (allocations reference tiers) |

---

## What changed from previous version

| Item | Before | After |
|---|---|---|
| Tier names | Individual / Professional / Corporate | Core / Clinical / Elite |
| B2B tier model | "Corporate" single-tier with feature toggles | Multi-tier seat allocation: N Core + M Clinical + Z Elite |
| Add-ons management | Separately managed `plan_addons` table | Inferred from product catalog minus tier inclusions; no admin add-on entity |
| Janet services | Not modelled | New `janet_services` table; included in tier inclusions |
| Tier inclusions | `feature_flags` JSONB ceiling | `tier_inclusions` join table with quantity, frequency, and margin tracking |
| Admin UI structure | Split sections (tiers, suppliers, products, add-ons each separate) | Single Plan Builder tab; B2B Clients as a separate tab |
| Build order | S1 → S2 → S3 → S4 | S4 → S1 → S2 → S3 |

---

## Open questions (resolved)

| Question | Resolution |
|---|---|
| Tier names | Core / Clinical / Elite |
| Annual pricing | Stored but auto-calculated from `monthly × 12 × (1 - discount%)`; admin only sets monthly price and discount |
| Add-on source | Inferred from product catalog minus tier inclusions; no separate admin entity |
| Wholesale visibility | Never visible outside service_role / platform admin |
| Products → Stripe | `products.stripe_price_id` populated by admin; used at order time |
| Feature key registry | `feature_keys` table, admin-managed, starting set: `supplement_protocol`, `pdf_export`, `genome_access`, `advanced_risk_report`, `dexa_ordering` |
| B2B seat limit | 10,000 seats per tier per plan; DB check constraint enforced |

## Open questions (still pending)

1. **Corporate invite model** — email invite, bulk CSV, or email-domain auto-match?
2. **Supplier order routing** — how does the platform notify a supplier of a new test order? (email, webhook, portal?) — out of scope for this sprint but decision needed before S4 goes live
3. **B2B Stripe billing model** — does each tier allocation map to a separate Stripe subscription item per tier, or does the org receive a single monthly invoice line?
