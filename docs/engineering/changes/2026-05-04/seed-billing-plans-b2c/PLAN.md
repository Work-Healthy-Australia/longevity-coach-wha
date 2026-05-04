# Plan: Seed B2C billing.plans + flip tier model to core/clinical/elite

Date: 2026-05-04
Phase: Phase 1 — Foundation (v1.1 backlog, BUG-014)
Status: Reviewed (rev 2)

## Objective

Make `/pricing` render the real B2C plan offering — three tiers (Core, Clinical, Elite), each with a Monthly and Annual row — instead of the broken `$0.00/mo` empty state.

The fix is broader than "insert some rows" because the codebase has TWO inconsistent representations of the tier model:

| Source | Tier names |
|---|---|
| Migration `0060_seed_tier_plans.sql` (already in prod) | `core`, `clinical`, `elite` |
| `feature_keys.tier_affinity` constraint | `core`, `clinical`, `elite` |
| `PricingClient.tsx` types | `individual`, `professional`, `corporate` |
| Admin Zod schemas (`/api/admin/plans`, `/api/admin/plan-addons`) | `individual`, `professional`, `corporate` |
| Admin UI select options (`/admin/plans`) | `individual`, `professional`, `corporate` |
| `plan_addons.min_tier` check constraint (`0013`) | `individual`, `professional`, `corporate` |

So the prod state today: `billing.plans` has 3 rows with tier=`core/clinical/elite` (from 0060), but `PricingClient`'s `TIER_RANK` lookup returns `undefined` for those values, breaking the sort and add-on gating. The plans render as cards but with broken ordering and broken add-on rules. There are no Annual rows, so the Annual toggle has nothing to show.

Done = `/pricing` shows three plan cards (Core / Clinical / Elite), the Monthly/Annual toggle works, prices display correctly, "Continue to checkout" enables once a card is selected. The user (James) confirmed B2C tiers are exactly Core/Clinical/Elite. B2B (corporate volume pricing) lives in `b2b_plans` — out of scope.

## Scope

**In scope:**
- New migration `0070_seed_b2c_plans_annual_and_relax_min_tier.sql`:
  - Insert 3 annual rows into `billing.plans` (Core / Clinical / Elite, `billing_interval='year'`) — idempotent, deterministic placeholder Stripe price IDs
  - Drop the `min_tier` check constraint on `plan_addons` (mirrors what 0061 did for `plans.tier`) so tier values are managed in application code, not the schema
- `PricingClient.tsx` — update `tier` and `min_tier` types from `"individual" | "professional" | "corporate"` to `"core" | "clinical" | "elite"`; update `TIER_RANK` accordingly
- `app/api/admin/plans/route.ts` — Zod enum updated
- `app/api/admin/plan-addons/route.ts` — Zod enum updated (min_tier)
- `app/api/admin/plan-addons/[id]/route.ts` — Zod enum updated (min_tier)
- `app/(admin)/admin/plans/PlansClient.tsx` — `<select name="tier">` options + `defaultValue` updated
- `app/(admin)/admin/addons/AddonsClient.tsx` — `<select name="min_tier">` options + `defaultValue` updated (caught in plan review)
- `app/api/stripe/checkout/route.ts` — has its own inline `tierRank: { individual: 0, professional: 1, corporate: 2 }` at lines 106-110 used to gate add-ons against plan tier. Without updating, every add-on selection at checkout would be rejected because `tierRank[plan.tier] ?? 0 = 0` and `tierRank[a.min_tier] ?? 99 = 99`, so `99 > 0` always. (Caught in plan review.)
- `supabase/schema/billing/tables/plans.sql` — NEW canonical file for `billing.plans` (per `.claude/rules/database.md`, this file should exist alongside the migration but doesn't yet — backfill it now while we're touching the table)
- Tests: unit test for `PricingClient` grouping/key logic with realistic seed data (Core+Clinical+Elite × month+year = 6 rows)

**Out of scope:**
- B2B (`b2b_plans`) plan seeding — corporate volume pricing is negotiated, separate concern
- Real Stripe price IDs — placeholder values per existing 0060 convention; admin UI / env-driven swap is a separate follow-up
- Per-feature `feature_flags` content for each plan — leave at default `'{}'` for now; admin UI manages
- Removing the now-obsolete migration 0060 — never modify a migration that has shipped (per `.claude/rules/database.md`)
- Plan add-on rows — table stays empty; UI gracefully renders no add-on section when `addons.length === 0` (existing PricingClient behaviour)
- `/account/billing` — already reads existing rows, doesn't need to change

**Confirmed already correct (no change needed):**
- `feature_keys.tier_affinity` constraint already accepts `('core','clinical','elite')` (per `supabase/schema/billing/tables/feature_keys.sql`) — no migration needed there.

**Known limitation after this PR ships:**
- `/pricing` will render correctly, but clicking "Continue to checkout" will return a 5xx error from Stripe. The `stripe_price_id` values in the new and existing seed rows are placeholders (`price_*_PLACEHOLDER`); Stripe rejects unknown price IDs at session creation with `No such price`. Real Stripe price IDs must be populated via the admin UI (or a follow-up migration / env-driven seed) before checkout works end-to-end. This is unchanged from the pre-PR state — the existing 0060 migration also used placeholders. Tracked as separate follow-up.

## Data model changes

| Change | Type | Notes |
|---|---|---|
| Insert 3 annual rows into `billing.plans` | Idempotent insert via `where not exists` | Deterministic placeholder Stripe IDs |
| Drop `plan_addons.min_tier` check constraint | DROP CONSTRAINT IF EXISTS | Mirrors 0061's drop of `plans_tier_check`. Tier values are now application-managed, not schema-managed |

No PII implications. Both tables are billing config, not patient data.

## Waves

### Wave 1 — Seed annual plans + flip tier types codebase-wide (single wave)

**What James can see after this wave merges:**
- `/pricing` renders 3 plan cards: Core ($49/mo), Clinical ($99/mo), Elite ($199/mo) in the correct order
- Toggling Annual switches every card to its annual-equivalent monthly price (20% discount: Core $39.20/mo billed $470.40/yr, Clinical $79.20/mo billed $950.40/yr, Elite $159.20/mo billed $1910.40/yr)
- Selecting any card enables "Continue to checkout"
- Admin UI at `/admin/plans` allows creating/editing plans with the correct tier names (core/clinical/elite)
- Admin UI for plan-addons accepts the new min_tier values

#### Task 1.1 — Migration 0070 (seed annual rows + relax min_tier)

Files affected:
- `supabase/migrations/0070_seed_b2c_plans_annual_and_relax_min_tier.sql` (new)
- `supabase/schema/billing/tables/plans.sql` (new — canonical schema file backfill)

What to build:

**Migration SQL:**
```sql
-- Insert 3 annual rows for Core, Clinical, Elite — idempotent.
-- Pricing convention (matches 0060): base_price_cents holds the monthly base
-- price for both monthly and annual rows; annual_discount_pct controls the
-- annual savings. PricingClient.tsx computes the displayed monthly-equivalent
-- price for annual rows as base_price_cents * (1 - annual_discount_pct/100).

insert into billing.plans (name, tier, billing_interval, stripe_price_id, base_price_cents, annual_discount_pct, is_active)
select 'Core', 'core', 'year', 'price_CORE_ANNUAL_PLACEHOLDER', 4900, 20, true
where not exists (select 1 from billing.plans where tier = 'core' and billing_interval = 'year');

insert into billing.plans (name, tier, billing_interval, stripe_price_id, base_price_cents, annual_discount_pct, is_active)
select 'Clinical', 'clinical', 'year', 'price_CLINICAL_ANNUAL_PLACEHOLDER', 9900, 20, true
where not exists (select 1 from billing.plans where tier = 'clinical' and billing_interval = 'year');

insert into billing.plans (name, tier, billing_interval, stripe_price_id, base_price_cents, annual_discount_pct, is_active)
select 'Elite', 'elite', 'year', 'price_ELITE_ANNUAL_PLACEHOLDER', 19900, 20, true
where not exists (select 1 from billing.plans where tier = 'elite' and billing_interval = 'year');

-- Drop the legacy min_tier check on plan_addons. Tier values are now
-- application-managed (the 4 .ts files in this PR enforce them). Mirrors what
-- 0061 did for billing.plans.tier.
do $$ begin
  alter table billing.plan_addons drop constraint if exists plan_addons_min_tier_check;
exception when undefined_object then null;
end $$;
```

**Canonical schema file `supabase/schema/billing/tables/plans.sql`** — full current state of `billing.plans` (CREATE TABLE with all columns, RLS policies, trigger), reflecting cumulative state through 0070. Read 0013_billing_schema.sql lines around the `create table billing.plans` block for the source of truth. Do NOT include the dropped tier check constraint (per 0061). Include a top comment noting the file was backfilled in PR for BUG-014, not a new table.

Acceptance criteria:
- Migration file numbered 0070, named exactly as above
- Migration is idempotent: running twice does not insert duplicate rows or error on the constraint drop
- Annual rows are inserted with the correct field values (verified by `select * from billing.plans where billing_interval='year'` returning the 3 expected rows)
- After migration, `select count(*) from billing.plans where tier in ('core','clinical','elite') and is_active=true` returns 6
- Canonical `supabase/schema/billing/tables/plans.sql` exists and reflects the post-0070 state
- `pnpm build` passes (no TS regression)

Rules to apply:
- `.claude/rules/database.md` (numbered migrations, idempotency, canonical schema files)
- `.claude/rules/data-management.md` (no PII; billing config)

#### Task 1.2 — Flip tier types in PricingClient + admin + checkout code

Files affected:
- `app/(public)/pricing/PricingClient.tsx`
- `app/api/admin/plans/route.ts`
- `app/api/admin/plan-addons/route.ts`
- `app/api/admin/plan-addons/[id]/route.ts`
- `app/(admin)/admin/plans/PlansClient.tsx`
- `app/(admin)/admin/addons/AddonsClient.tsx`
- `app/api/stripe/checkout/route.ts` (inline tierRank at ~lines 106-110)

What to build:

**PricingClient.tsx:**
- `PricingPlan.tier` type: change from `"individual" | "professional" | "corporate"` to `"core" | "clinical" | "elite"`
- `PricingAddon.min_tier` type: same change
- `TIER_RANK` map: change keys from `individual/professional/corporate` to `core/clinical/elite` with same numeric ranks (0/1/2 in the order Core=0, Clinical=1, Elite=2)
- All other code unchanged

**`app/api/admin/plans/route.ts`:**
- Update Zod `tier: z.enum([...])` from old names to `["core", "clinical", "elite"]`

**`app/api/admin/plan-addons/route.ts`:**
- Update Zod `min_tier: z.enum([...])` to `["core", "clinical", "elite"]`

**`app/api/admin/plan-addons/[id]/route.ts`:**
- Update Zod `min_tier: z.enum([...]).optional()` to `["core", "clinical", "elite"]`

**`app/(admin)/admin/plans/PlansClient.tsx`:**
- Update `defaultValue="individual"` to `defaultValue="core"`
- Update `<select name="tier">` `<option>` values + labels to Core / Clinical / Elite
- (Search the file for any other tier-name string literals and update)

**`app/(admin)/admin/addons/AddonsClient.tsx`:**
- Update both `<select name="min_tier">` blocks (~lines 72-74 and 112-115) to options Core/Clinical/Elite
- Update both `defaultValue` strings (~lines 61 and 93) from `"individual"` to `"core"`
- (Search the file for any other tier-name string literals and update)

**`app/api/stripe/checkout/route.ts`:**
- Replace the inline `const tierRank: Record<string, number> = { individual: 0, professional: 1, corporate: 2 };` at ~lines 106-110 with an import from `lib/pricing/grouping.ts` (created in Task 1.3): `import { TIER_RANK } from "@/lib/pricing/grouping";` and use `TIER_RANK` directly in the gating check at line 112. Do NOT define a second copy. Single source of truth.

Acceptance criteria:
- All 7 files updated. Verify with: `grep -rn '"individual"\|"professional"\|"corporate"' app/ lib/ | grep -v "node_modules"`. Allowed remaining matches: any prose in `app/(public)/legal/` files (legitimate content), and the docstring `corporate organisation` in `lib/pricing/calculate.ts` if present (not a tier value). All other matches must be cleared.
- `pnpm build` passes (TS would catch any leftover incompatibility)
- Admin UI dropdowns for plan tier and addon min_tier both show Core/Clinical/Elite (verified in the browser-verification step)
- Stripe checkout route imports `TIER_RANK` from `lib/pricing/grouping.ts` (no inline duplicate)

Rules to apply:
- `.claude/rules/nextjs-conventions.md` (server actions, Zod validation)
- `.claude/rules/security.md` (Zod gates user input at the server boundary)

#### Task 1.3 — Extract `planKey` + `TIER_RANK` to shared module + unit test

Files affected:
- `lib/pricing/grouping.ts` (new — shared module for `planKey` and `TIER_RANK`, consistent with existing `lib/pricing/calculate.ts`)
- `app/(public)/pricing/PricingClient.tsx` (import from new module instead of defining locally)
- `app/api/stripe/checkout/route.ts` (import `TIER_RANK` from new module — see Task 1.2)
- `tests/unit/pricing/grouping.test.ts` (new)

What to build:

**`lib/pricing/grouping.ts`:**
- Export `TIER_RANK: Record<"core" | "clinical" | "elite", number> = { core: 0, clinical: 1, elite: 2 }`
- Export `planKey(p: { tier: string; name: string }): string` — same logic as PricingClient's current local function (`${p.tier}::${p.name.replace(/\s+(monthly|annual)$/i, "").trim()}`)
- Pure functions, no I/O
- Test cases:
  1. `planKey({ tier: 'core', name: 'Core', ... })` returns `'core::Core'`
  2. `planKey({ tier: 'core', name: 'Core Annual', ... })` strips the suffix and returns `'core::Core'` (so monthly + annual rows group under one key)
  3. `planKey({ tier: 'clinical', name: 'Clinical Monthly', ... })` returns `'clinical::Clinical'`
  4. `TIER_RANK.core < TIER_RANK.clinical < TIER_RANK.elite` (ordering invariant)
- 6 fixture rows (Core/Clinical/Elite × month/year) feeding the grouping logic should produce exactly 3 groups in TIER_RANK order

Acceptance criteria:
- All cases pass
- `pnpm test` full suite passes (no regressions)

Rules to apply:
- `.claude/rules/nextjs-conventions.md`
