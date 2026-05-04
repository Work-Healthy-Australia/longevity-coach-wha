# QA Report: Seed B2C billing.plans + flip tier model — Wave 1

Date: 2026-05-04
Reviewer: dev-loop QA pass

## Build status

- `pnpm build`: PASS — clean (only pre-existing turbopack-root warning)
- `pnpm test`: PASS — **710 passed, 4 skipped, 0 failed** across 92 test files
- `pnpm test tests/unit/pricing/grouping.test.ts`: PASS — 8 / 8

## Test results

| Suite | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| `tests/unit/pricing/grouping.test.ts` (new) | 8 | 8 | 0 | 0 |
| Full project suite | 714 | 710 | 0 | 4 |

## Findings

### Confirmed working
- Migration 0070 inserts 3 annual rows into `billing.plans` (Core / Clinical / Elite) idempotently — re-running produces no duplicates.
- Migration 0070 drops the `plan_addons_min_tier_check` constraint, mirroring what 0061 did for `plans.tier`. Tier values are now application-managed across all four code paths.
- `lib/pricing/grouping.ts` is the single source of truth for `TIER_RANK` and `planKey`. Imported by both `PricingClient.tsx` and `app/api/stripe/checkout/route.ts` — no inline duplicates.
- All 7 affected code files updated to use `core/clinical/elite`. Grep across `app/`, `lib/`, `tests/` for `"individual"`, `"professional"`, or `"corporate"` returns zero matches.
- Canonical schema files backfilled for both `billing.plans` and `billing.plan_addons`, neither of which existed before. Both correctly reflect the dropped check constraints.
- `app/api/stripe/checkout/route.ts` add-on tier-gate logic uses `(ranks[a.min_tier] ?? 99) > (ranks[plan.tier] ?? 0)` — preserves the original guard semantics for unknown tier values (asymmetric defaults: addon defaults to most restrictive 99, plan defaults to most permissive 0).

### Spec compliance review
PASS — every acceptance criterion across all 3 tasks verified.

### Code quality review
APPROVED_WITH_NITS. Two NITs identified:
- ✅ Addressed: backfilled `supabase/schema/billing/tables/plan_addons.sql` to reflect the dropped constraint.
- ⏭ Skipped (intentional): runtime `.filter(p => p.tier in TIER_RANK)` guard on the Supabase cast in `pricing/page.tsx` — admin Zod gate enforces correct tier values on writes; canonical seed enforces correct values for the existing 6 rows. Risk of stale data is low.

### Known limitation (carried forward)
**`/pricing` will render correctly, but clicking "Continue to checkout" will return a 5xx from Stripe** until real Stripe price IDs replace the `price_*_PLACEHOLDER` values. This is unchanged from the pre-PR state — the existing 0060 migration also used placeholders. The fix is to populate real Stripe price IDs via the admin UI (`/admin/plans` for plans, `/admin/addons` for addons) once the Stripe products are created. Tracked as a separate follow-up.

### Deferred items
- Real Stripe price IDs (out of scope; requires Stripe dashboard access)
- B2B (`b2b_plans`) seeding (separate concern; corporate volume pricing is negotiated per organisation)

## Verdict

APPROVED — proceed to browser verification → push → merge.
