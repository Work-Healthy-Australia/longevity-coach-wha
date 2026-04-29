# Changelog: Pricing System + Admin CRM (Sprint 2 Plan A)
Date: 2026-04-29
Phase: Phase 2 — Intelligence (business-model layer)

## What was built

- Public `/pricing` page (Screen 1 wireframe): monthly/annual toggle, tier cards, gated add-on checkboxes, live total
- `/account/billing` page (Screen 3): plan summary, active add-ons, available add-ons, test catalog, order history
- 4 admin catalog pages: `/admin/plans`, `/admin/addons`, `/admin/suppliers`, `/admin/products` using a shared `CrudTable` client component
- 12 new API routes:
  - `GET /api/plans`, `GET /api/plan-addons`
  - `GET/POST /api/subscription/addons`, `DELETE /api/subscription/addons/:id`
  - `GET/POST /api/test-orders`
  - `GET/POST /api/admin/plans`, `PUT /api/admin/plans/:id`
  - `GET/POST /api/admin/plan-addons`, `PUT /api/admin/plan-addons/:id`
  - `GET/POST /api/admin/suppliers`, `PUT /api/admin/suppliers/:id`
  - `GET/POST /api/admin/products`, `PUT /api/admin/products/:id`
  - `GET /api/admin/test-orders`, `PUT /api/admin/test-orders/:id`
- `lib/features/resolve.ts` — four-path canAccess feature-flag resolver
- `lib/pricing/calculate.ts` — `calculateTotal` and `calculateOrgTotal` (D2 flat per-org)
- `lib/admin/guard.ts` — shared `requireAdmin()` for admin API routes
- `lib/stripe/addons.ts`, `lib/stripe/test-orders.ts` — Stripe sub-item + payment-intent helpers
- `/api/stripe/checkout` updated to accept `{ plan_id, addon_ids[], billing_interval }`; legacy body kept working
- `priceIdForPlan()` flagged `@deprecated`
- 19 new unit tests across resolver and pricing helpers

## What changed

- `app/(admin)/layout.tsx` nav now links Plans, Add-ons, Suppliers, Products
- `lib/stripe/client.ts` — deprecation note on `priceIdForPlan()`

## Migrations applied

- `0044` (renumbered → `0047_billing_org_addons_stripe_item_and_invites.sql`):
  - Adds `stripe_subscription_id`, `stripe_subscription_item_id`, `status`, `updated_at` to `billing.organisation_addons` for D4 (one Stripe sub-item per add-on, flat org billing)
  - Creates `billing.org_invites` for D3 (email + CSV bulk corporate invites) with single-use 14-day tokens
  - Documents that `billing.organisations.seat_count` is informational under D2 flat pricing

## Migration collision fixes

- Wave 1 renamed `0041_daily_logs_deep_sleep_pct.sql` → `0043_*` (later bumped again to `0046_*` after parallel branches landed `0043_daily_goals.sql` and `0044_journal.sql`)
- Wave 2 renamed `0044_billing_org_addons_stripe_item_and_invites.sql` → `0047_*`

## Decisions resolved (2026-04-29)

- D1 feature-flag enum: `supplement_protocol`, `pdf_export`, `genome_access`, `advanced_risk_report`, `dexa_ordering`
- D2 corporate pricing: FLAT per-org (seat_count informational)
- D3 corporate invites: email + CSV bulk
- D4 org add-on Stripe billing: FLAT — one Stripe sub-item per add-on

## Audit finding

`supabase/migrations/0013_billing_schema.sql` already created **all** pricing tables in the `billing` schema. The source plan's 0040–0043 migrations were specced against `public.*` and were not needed. Only `0047` (gap-fill) was written.

## Deviations from plan

- Plan called for migrations 0040–0043 in `public` schema; those are redundant — adapted to a single `0047` gap-fill on the existing `billing` schema.
- Wave 6 (admin CRM metrics) shipped via parallel branch `feat/sprint2-engineering-completeness` before Wave 5 merged. No additional code was needed for Wave 6.
- Step 13 (clinician portal review) deferred — placeholder `docs/architecture/clinician-portal-decisions.md` records C1–C6 with default proposals as `PENDING` until James runs the review session.

## Known gaps / deferred items

- `lib/supabase/database.types.ts` regeneration deferred to next deployment (`supabase gen types typescript --local > lib/supabase/database.types.ts`).
- Live `billing.plans` seeding with real Stripe price IDs is a manual task for James + Trac.
- Employer dashboard UI (`/employer`) and CSV invite intake handler not yet built — schema is ready.
- `priceIdForPlan()` deprecation can land once the legacy signup buttons migrate to the DB-driven body.

## PR trail

- Wave 1: #24 (collision fix + 0044 → bumped to 0047 in Wave 2)
- Wave 2: #25 (lib helpers + renumber)
- Wave 3: #26 (pricing page + checkout)
- Wave 4: #27 (account/billing + APIs)
- Wave 5: #29 (admin catalog)
- Wave 6: shipped via parallel #28 (engineering-completeness)
- Wave 7: this changelog + epic-status update + clinician-portal-decisions placeholder
