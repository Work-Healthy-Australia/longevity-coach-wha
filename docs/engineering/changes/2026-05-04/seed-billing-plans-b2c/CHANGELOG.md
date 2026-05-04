# Changelog: Seed B2C billing.plans + flip tier model

Date: 2026-05-04
Phase: Phase 1 — Foundation (v1.1 backlog)
PR: [apps#135](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/135)
Bug closed: BUG-014

## What was built

- New B2C tier model (Core / Clinical / Elite) is now consistent across the entire codebase. Previously the schema and seed used `core/clinical/elite` while the application code (`PricingClient`, admin Zod schemas, Stripe checkout add-on gating) hard-coded the old `individual/professional/corporate` names — a mismatch that broke `/pricing`'s sort order and add-on gating even when rows existed.
- Three annual rows added to `billing.plans` (Core / Clinical / Elite, `billing_interval='year'`, 20% annual discount). Combined with the existing 3 monthly rows from migration 0060, `/pricing` now has 6 rows and the Annual toggle works.
- New `lib/pricing/grouping.ts` is the single source of truth for `TIER_RANK` and the `planKey()` grouping function. Imported by both `PricingClient.tsx` and `app/api/stripe/checkout/route.ts` — no inline duplicates.
- Canonical schema files backfilled for `billing.plans` and `billing.plan_addons` (per `.claude/rules/database.md`); neither existed previously.
- 8 new unit tests for the grouping helpers.

## What changed

| File | Change |
|---|---|
| `supabase/migrations/0070_seed_b2c_plans_annual_and_relax_min_tier.sql` | New — 3 annual seed inserts (idempotent) + drop of `plan_addons_min_tier_check` |
| `supabase/schema/billing/tables/plans.sql` | New canonical file — backfill |
| `supabase/schema/billing/tables/plan_addons.sql` | New canonical file — backfill |
| `lib/pricing/grouping.ts` | New — exports `Tier`, `TIER_RANK`, `planKey()` |
| `app/(public)/pricing/PricingClient.tsx` | Use shared `TIER_RANK` + `planKey`, types narrowed to `Tier` |
| `app/api/admin/plans/route.ts` | Zod enum: `core/clinical/elite` |
| `app/api/admin/plan-addons/route.ts` | Zod enum: `core/clinical/elite` |
| `app/api/admin/plan-addons/[id]/route.ts` | Zod enum: `core/clinical/elite` |
| `app/(admin)/admin/plans/PlansClient.tsx` | Tier `<select>` + `defaultValue` |
| `app/(admin)/admin/addons/AddonsClient.tsx` | Min-tier `<select>` × 2 + `defaultValue` × 2 |
| `app/api/stripe/checkout/route.ts` | Imports `TIER_RANK` from shared module; inline `tierRank` removed |
| `tests/unit/pricing/grouping.test.ts` | New — 8 cases |

## Migrations applied

- `0070_seed_b2c_plans_annual_and_relax_min_tier.sql` — inserts 3 annual rows for B2C tiers; drops `plan_addons_min_tier_check` constraint (mirrors what 0061 did for `plans.tier`)

## Deviations from plan

None on the implementation side. One post-implementation addition: the canonical `supabase/schema/billing/tables/plan_addons.sql` was backfilled in addition to `plans.sql` (the plan only required `plans.sql`, but the code-quality reviewer flagged the missing `plan_addons.sql`). Quick win, kept the schema directory consistent.

## Known gaps / deferred items

- **Stripe price IDs are placeholders.** `/pricing` renders correctly, but clicking "Continue to checkout" returns a 5xx from Stripe until the `price_*_PLACEHOLDER` values are replaced via the admin UI at `/admin/plans` (and `/admin/addons` if any add-ons are added). Real IDs come from the Stripe dashboard once products are created. Unchanged from pre-PR state — the existing 0060 migration also used placeholders.
- **B2B plan seeding** out of scope. Corporate volume pricing is negotiated per organisation and lives in `b2b_plans`, not `billing.plans`.
- **Per-feature `feature_flags` content** for each plan is empty (`{}`). Managed via the admin UI.
