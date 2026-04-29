# Plan: Pricing System + Admin CRM (Sprint 2)
Date: 2026-04-29
Phase: Phase 2 — Intelligence (business-model layer)
Status: In progress

## Objective

Wire up the customer-facing and admin-facing pricing system on top of the existing
`billing.*` schema (0013), implement the feature-flag resolution layer, expand the
admin CRM with real metrics, and resolve the migration filename collision in 0041.

Source plan: `docs/engineering/plan/sprint-1/2026-04-29-plan-business-features.md`.

## Decisions resolved by James (2026-04-29)

- **D1** Feature-flag enum: `supplement_protocol`, `pdf_export`, `genome_access`, `advanced_risk_report`, `dexa_ordering`
- **D2** Corporate pricing: FLAT per-org (seat_count informational only)
- **D3** Corporate invite model: email invite + CSV bulk upload (no domain auto-match)
- **D4** Org add-on Stripe billing: FLAT — one Stripe sub item per add-on

## Scope

In scope:
- Step 1 audit, Step 2 collision fix, Steps 3–12 of the source plan
- Placeholder for clinician-portal-decisions.md (Step 13 deferred to James review session)

Out of scope:
- Live Stripe price-ID seeding (manual task by James)
- Clinician portal UI (gated on Step 13 review)
- Multi-org membership (single-org enforced by 0013 unique index)

## Audit findings (Step 1)

`supabase/migrations/0013_billing_schema.sql` already created **all** pricing tables in
the `billing` schema. The plan's 0040–0043 migrations were specced against `public.*`
which doesn't match the as-built schema. Adapted: only one new migration is needed
(`0044`) to gap-fill the two missing pieces required by D3 and D4.

| Source plan file | What it specced | Reality |
|---|---|---|
| 0040_plans.sql | create `public.plans`, `public.plan_addons` | already exists in `billing` |
| 0041_subscription_addons.sql | create `public.subscription_addons`, `public.test_orders` | already exists in `billing` |
| 0042_organisations_pricing.sql | create org tables | already exists in `billing` |
| 0043_products_public_view.sql | create products_public view | already exists as `billing.products_public` |

Net new: `0044_billing_org_addons_stripe_item_and_invites.sql`:
- Adds `stripe_subscription_id`, `stripe_subscription_item_id`, `status`, `updated_at` to `billing.organisation_addons` (D4)
- Creates `billing.org_invites` (D3 — email + CSV invites)

## Migration collision fix (Step 2 follow-up)

Two files held slot 0041 (`daily_logs_deep_sleep_pct`, `training_plans_plan_name`).
Renamed `0041_daily_logs_deep_sleep_pct.sql` → `0043_daily_logs_deep_sleep_pct.sql`
(it was added in commit c4d6ad7, after the wave2 commit). New work starts at `0044`.

## Waves

### Wave 1 — Foundation (THIS WAVE)
**What James can see after this merges:** clean migration chain, new `org_invites`
table available, types regenerated.
- 0041 collision fix (rename to 0043)
- 0044 migration: org_addons Stripe linkage + status, org_invites table
- Regenerate `lib/supabase/database.types.ts`
- Audit doc inline in this PLAN.md

### Wave 2 — Library helpers + cron registration
- `lib/features/resolve.ts` + tests in `tests/unit/features/resolve.test.ts`
- `lib/pricing/calculate.ts` + tests in `tests/unit/pricing/calculate.test.ts`
- vercel.json cron `/api/cron/repeat-tests` (already present — verify no-op)

### Wave 3 — Public pricing page + DB-driven Stripe checkout
- `GET /api/plans/route.ts`
- `GET /api/plan-addons/route.ts`
- `app/(public)/pricing/page.tsx` (SSR fetch + client-side toggle)
- Update `app/api/stripe/checkout/route.ts` to read plans + add-ons from DB
- Mark `priceIdForPlan()` deprecated

### Wave 4 — Account billing page + recurring add-ons + test orders
- `app/(app)/account/billing/page.tsx` (Screen 3)
- `GET/POST/DELETE /api/subscription/addons/route.ts`
- `GET/POST /api/test-orders/route.ts`

### Wave 5 — Admin plans / add-ons / suppliers / products
- `app/(admin)/admin/plans/page.tsx`
- `app/(admin)/admin/addons/page.tsx`
- `app/(admin)/admin/suppliers/page.tsx`
- `app/(admin)/admin/products/page.tsx`
- All admin API routes (admin-gated)

### Wave 6 — Admin CRM metrics
- Expand `app/(admin)/admin/page.tsx` with MRR / Active members / Churn / Pipeline runs
- `lib/admin/metrics.ts`

### Wave 7 — Documentation
- `docs/architecture/clinician-portal-decisions.md` placeholder (C1–C6 PENDING)
- `docs/product/epic-status.md` updates for Epic 12 / 13
- `CHANGELOG.md`, `EXECUTIVE_SUMMARY.md` for this change folder
