# Pricing Feature — Proposal
**Date:** 2026-04-27
**Status:** Draft — pending design approval
**Source:** Voice brief (`docs/pricing-feature.md`) + extended requirements 2026-04-27

---

## Overview

The pricing feature covers four distinct subsystems. Each is independently deliverable and shares a clear dependency chain.

```
S1: Pricing Tiers & Plans
    └── S2: User Add-on Selection (Stripe-charged extras)
    └── S3: Employer Feature Toggles (B2B health packages)
            └── S4: Supplier & Product Catalog (fulfillment network)
```

---

## Subsystem 1 — Pricing Tiers & Plans

### What it is
Subscription plan definitions with tiers (Individual / Professional / Corporate), each with a billing interval (monthly / annual) and a defined feature ceiling. Replaces the current two hardcoded env-var price IDs with a DB-managed plan catalog.

### What it needs
- A `plans` table: tier name, Stripe price IDs, billing interval, base price, feature flags ceiling
- Admin UI to create/edit plans without touching env vars or code
- Stripe checkout updated to resolve plan by `plan_id` from DB
- Public pricing page showing tier comparison with monthly/annual toggle and auto-calculated annual savings

### Actors
- **Platform admin** — creates and manages plans
- **Patient / standalone user** — selects a plan at signup or upgrades

### Success criteria
- New plan can be published from the admin UI and immediately appear at checkout
- Annual pricing auto-calculates as `monthly_price × 12 × discount_pct` and displays savings
- No Stripe price IDs remain hardcoded in application code

---

## Subsystem 2 — User Add-on Selection

### What it is
A standalone user can purchase optional feature add-ons beyond their base plan. Add-ons are recurring extras (billed as Stripe subscription items on the same subscription) or one-time test orders (billed as Stripe payment intents). The running total auto-calculates as the user selects/deselects.

### Two add-on categories

**Feature add-ons (recurring):**
Software features that can be unlocked beyond the base tier. Examples: advanced supplement protocol, genome analysis access, branded PDF report export. Each has a monthly and annual Stripe price ID. Added as subscription items.

**Test orders (one-time):**
Physical health tests fulfilled by a supplier (DEXA scan, blood panel, genetic test). Billed as one-time Stripe payment intents at retail price. Linked to a supplier product in the catalog.

### What it needs
- `plan_addons` table: which recurring add-ons are available per tier, each with Stripe price IDs
- `subscription_addons` table: which recurring add-ons a user has active (Stripe subscription item IDs)
- `test_orders` table: one-time test purchases with order status and supplier routing
- Add-on picker UI on the pricing page and on the account/billing page
- Running total component: base plan price + selected add-ons = total per month/year
- API to add/remove recurring add-ons via Stripe subscription item create/delete
- API to initiate a one-time test order via Stripe payment intent

### Actors
- **Standalone user** — selects, pays for, and manages their add-ons
- **Platform** — routes test orders to the appropriate supplier

### Success criteria
- User can add a recurring feature add-on; Stripe subscription item is created and billing adjusts immediately
- User can order a one-time test; Stripe payment intent created, order record written to DB
- Running total on the pricing/account page always reflects the current selection accurately

---

## Subsystem 3 — Employer Feature Toggles

### What it is
A **Corporate** tier account (representing an employer) has one or more **Health Managers** who can enable or disable specific features for their employee health package. Toggles are constrained by what the corporate plan permits — a Health Manager cannot unlock features above their plan ceiling.

### What it needs
- `organisations` table: employer account linked to a corporate plan
- `organisation_members` join table: employees → org, with `member | health_manager` role
- `organisation_addons` table: which feature add-ons the org has enabled for all its members
- Health Manager UI: feature toggle matrix showing available features with on/off and cost-per-employee impact
- Cost impact calculator: toggling a feature shows the updated per-employee cost and total org cost
- Employee management: invite employees by email, view member list, set health_manager role

### Auto-calculation rule
```
org_monthly_total = plan.base_price_per_seat × member_count
                  + sum(enabled_addon.price_per_seat) × member_count
```

### Actors
- **Employer / Health Manager** — manages the employee health package
- **Platform admin** — assigns org to a corporate plan
- **Employee (org member)** — sees features that their org has enabled

### Success criteria
- Health Manager can toggle features; cost impact shows before confirming
- Employees see only the features their org has enabled
- A Health Manager cannot enable features not permitted by their plan tier

---

## Subsystem 4 — Supplier & Product Catalog

### What it is
A back-office fulfillment registry. When a user orders a test (DEXA scan, blood panel, genetic test), the platform routes that order to a registered supplier. The catalog stores supplier contact details and identifiers, and the products each supplier can fulfill — with wholesale cost and retail price managed from the UI.

### Design recommendation
Keep the supplier catalog as **admin-only write access**. This is not a customer-facing marketplace — it is the platform's fulfillment network. Health Managers get read-only access to browse what tests can be offered to their employees.

**Two pricing layers:**
- **Wholesale price** — what the platform pays the supplier. Never shown to users or Health Managers.
- **Retail price** — what is charged to the patient or corporate account at checkout.

**Product → Stripe mapping:**
Each product carries a `stripe_price_id` so that when a test order is placed, the system calls `stripe.paymentIntents.create` with the product's retail price. No manual price entry at order time.

### What it needs
- `suppliers` table: name, contact details, ABN/provider ID, status
- `products` table: supplier FK, product code, name, category, wholesale/retail price, Stripe price ID, status
- `test_orders` table: user FK, product FK, Stripe payment intent ID, fulfillment status
- Admin UI: supplier list + create/edit form; product list + create/edit form
- Health Manager UI: read-only product catalog (retail price only, no wholesale)

### Actors
- **Platform admin** — creates and maintains suppliers and products
- **Corporate Health Manager** — browses available tests to include in employee packages
- **Patient / standalone user** — orders a test (via the add-on flow in S2)
- **Supplier** — receives order notification and fulfills the test (out of scope for this system; handled externally)

### Success criteria
- Admin can register a supplier and add products with prices entirely from the UI
- Ordering a product creates a Stripe payment intent at the correct retail price with no hardcoding
- Wholesale price is never readable by non-admin roles

---

## Build Order & Dependencies

| Sprint | Subsystem | Depends on |
|---|---|---|
| 1 | S1 — Pricing Tiers | Nothing |
| 2 | S2 — Add-on Selection | S1 (plan_addons reference plans) |
| 3 | S3 — Employer Toggles | S1 (org references plans), S2 (add-on model) |
| 4 | S4 — Supplier Catalog | S2 (test_orders uses products), S3 (health_manager role) |

---

## What changed from initial proposal

| Item | Before | After |
|---|---|---|
| User add-ons | Not modelled | New Subsystem 2: recurring (Stripe sub items) + one-time (payment intents) |
| Pricing calculator | Not specified | Auto-calc on pricing page and employer dashboard |
| Supplier purpose | Vague | Explicit: fulfillment network for test orders, admin-only writes |
| Products → Stripe | Open question | Each product carries `stripe_price_id`; used at order time |
| Employer cost calc | Not specified | Per-seat formula across base plan + enabled add-ons × headcount |

---

## Open questions (resolved)

| Question | Resolution |
|---|---|
| Tier names | Individual / Professional / Corporate |
| Add-on billing model | Recurring → Stripe subscription items; one-time tests → payment intents |
| Wholesale visibility | Never visible outside service_role / platform admin |
| Products → Stripe | `products.stripe_price_id` populated by admin at product creation |

## Open questions (still pending)

1. **Corporate invite model** — email invite, bulk CSV, or email-domain auto-match?
2. **Per-seat vs flat corporate pricing** — is the corporate plan priced per employee seat or as a flat organisational rate?
3. **Feature flag keys** — what are the exact feature identifiers? (e.g. `supplement_protocol`, `pdf_export`, `genome_access`) — a TS enum must be agreed before migrations are written
4. **Supplier order routing** — how does the platform notify a supplier of a new test order? (email, webhook, portal?) — out of scope for this sprint but needs a decision before S4 goes live
