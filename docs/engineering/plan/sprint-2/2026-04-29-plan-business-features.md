# Sprint 2 — Plan A: Business Features
**Date:** 2026-04-29
**Scope:** Pricing system (S1+S2), Admin CRM expansion, Stripe entitlement wiring, Clinician Portal review
**Runner:** Claude Code (coding steps) + James Murray (decisions marked ⚠️)
**Epics touched:** Epic 9 (Care Team — review only), Epic 12 (Distribution), Epic 13 (Business Model)

---

## Pre-flight: Decisions required from James BEFORE coding starts

These are business decisions that block specific steps. Resolve them in the morning standup.

| # | Decision | Blocks |
|---|---|---|
| ⚠️ D1 | **Feature flag key enum** — confirm the exact string identifiers for add-ons. Suggested: `supplement_protocol`, `pdf_export`, `genome_access`, `advanced_risk_report`, `dexa_ordering` | Step 3 migrations |
| ⚠️ D2 | **Per-seat vs flat corporate pricing** — is the corporate plan billed per employee seat or as a flat org rate? | Step 3 migrations + Step 8 |
| ⚠️ D3 | **Corporate invite model** — email invite (existing flow), bulk CSV upload, or email-domain auto-match? | Step 9 |
| ⚠️ D4 | **Org add-on Stripe billing** — does the org get one Stripe subscription item per add-on (flat) or one per seat? Affects whether `organisation_addons` needs a `stripe_subscription_item_id` column | Step 3 migrations |

---

## Step 1 — Audit existing billing schema migration

**Who:** Claude Code  
**What:** Read `supabase/migrations/0013_billing_schema.sql` and compare against the pricing feature database design at `docs/features/pricing/database-design.md`. Produce a diff of what tables already exist vs. what the pricing design requires.

**Output:** A concrete list of new tables/columns needed before any migration is written.

---

## Step 2 — Resolve migration filename collisions

**Who:** Claude Code  
**What:** The `0031_*.sql` and `0032_*.sql` slots each have two files (parallel branch collision). Renumber them to a clean monotonic sequence:

- `0031_member_alerts.sql` → keep as `0031`
- `0031_patient_uploads_file_hash.sql` → rename to `0038_patient_uploads_file_hash.sql`
- `0032_lab_results_idempotency.sql` → keep as `0032`
- `0032_seed_admins.sql` → rename to `0039_seed_admins.sql`

Then bump the next available migration slot to `0040`.

**Verify:** Run `supabase db diff` locally after renaming to confirm the chain is intact.

---

## Step 3 — Write pricing migrations (requires D1, D2, D4)

**Who:** Claude Code  
**What:** Write new idempotent migrations under the next sequential numbers. Reference `docs/features/pricing/database-design.md` exactly.

Tables to create (check Step 1 diff first — some may already exist in `0013`):

| Migration | Tables |
|---|---|
| `0040_plans.sql` | `public.plans`, `public.plan_addons` + RLS policies |
| `0041_subscription_addons.sql` | `public.subscription_addons`, `public.test_orders` + RLS |
| `0042_organisations_pricing.sql` | `public.organisations` (extend or create), `public.organisation_addons`, `public.organisation_members` + RLS |
| `0043_products_public_view.sql` | `products_public` view (wholesale hidden from non-admin RLS) |

RLS rules per table must match the table in `docs/features/pricing/database-design.md` — Section "RLS summary".

**Verify:** `supabase db diff` clean; regenerate `lib/supabase/database.types.ts` after all four are applied.

---

## Step 4 — Feature flag resolution layer

**Who:** Claude Code  
**What:** Implement `lib/features/resolve.ts` — the single function that determines whether a user can access a given feature.

Logic (from `docs/features/pricing/system-design.md` — "Feature flag resolution"):
1. Platform admin → all features unlocked
2. Org member → check `organisation_addons` → check plan tier ceiling
3. Standalone subscriber → check `subscription_addons` → check plan tier ceiling
4. Otherwise → locked

Signature:
```typescript
export async function canAccess(
  userId: string,
  featureKey: string,
  supabase: SupabaseClient
): Promise<boolean>
```

Write unit tests in `tests/unit/features/resolve.test.ts` covering all four paths.

---

## Step 5 — Pricing calculation helpers

**Who:** Claude Code  
**What:** Implement `lib/pricing/calculate.ts` with two pure functions:

- `calculateTotal(plan, addons, interval)` — standalone user total
- `calculateOrgTotal(plan, enabledAddons, seatCount, interval)` — employer total

Both are already specced in `docs/features/pricing/system-design.md` — "Pricing Calculation Logic". Add unit tests.

---

## Step 6 — Stripe checkout updated to read from DB plans

**Who:** Claude Code  
**What:** Update `app/api/stripe/checkout/route.ts` to:
1. Accept `{ plan_id, addon_ids[], billing_interval }` in the request body
2. Read the plan and add-ons from DB to resolve Stripe price IDs
3. Build the Stripe checkout session with all line items

Deprecate `priceIdForPlan()` in `lib/stripe/client.ts` once the new checkout route is live (leave a `// deprecated` note and a TODO to remove).

---

## Step 7 — Public pricing page

**Who:** Claude Code  
**What:** Implement `app/(app)/pricing/page.tsx` per the wireframe in `docs/features/pricing/system-design.md` Screen 1.

Requirements:
- Server component loads plans + plan_addons from DB via `GET /api/plans` and `GET /api/plan-addons`
- Monthly/Annual toggle is client-side state (no reload)
- Add-on checkboxes grey out below `min_tier`
- Running total updates live
- "Continue to checkout" passes `plan_id`, `addon_ids[]`, `billing_interval` as query params

Also implement the supporting API routes:
- `GET /api/plans/route.ts` — active plans from DB
- `GET /api/plan-addons/route.ts` — active add-ons from DB

---

## Step 8 — Account billing page (requires D2)

**Who:** Claude Code  
**What:** Implement `app/(app)/account/billing/page.tsx` per Screen 3 wireframe in system-design.md.

Sections:
- Current plan + renewal date
- Active add-ons with Remove button
- Available add-ons with Add button
- Test catalog (products from `products_public` view) with Order button
- Order history

API routes to implement alongside:
- `GET/POST/DELETE /api/subscription/addons/route.ts`
- `GET/POST /api/test-orders/route.ts`

---

## Step 9 — Admin: Plans and Add-ons management (requires D3)

**Who:** Claude Code  
**What:** Implement admin pages for managing the plan catalog:

- `app/(admin)/admin/plans/page.tsx` — list plans, create/edit plan form
- `app/(admin)/admin/addons/page.tsx` — list add-ons, create/edit add-on form

Admin API routes:
- `GET/POST /api/admin/plans/route.ts`
- `PUT /api/admin/plans/[id]/route.ts`
- `GET/POST /api/admin/plan-addons/route.ts`
- `PUT /api/admin/plan-addons/[id]/route.ts`

All routes gate on `is_admin`. Use the admin Supabase client for writes.

---

## Step 10 — Admin: Suppliers and Products catalog

**Who:** Claude Code  
**What:** Implement `app/(admin)/admin/suppliers/page.tsx` and `app/(admin)/admin/products/page.tsx` per Screens 5 and 6 in system-design.md.

Notes:
- Wholesale price column must never appear in `products_public` view or non-admin routes
- "Stripe Price ID" field: manual entry by admin (they create it in Stripe dashboard first)

Admin API routes:
- `GET/POST /api/admin/suppliers/route.ts`
- `PUT /api/admin/suppliers/[id]/route.ts`
- `GET/POST /api/admin/products/route.ts`
- `PUT /api/admin/products/[id]/route.ts`
- `GET /api/admin/test-orders/route.ts`
- `PUT /api/admin/test-orders/[id]/route.ts`

---

## Step 11 — Admin CRM metrics dashboard

**Who:** Claude Code  
**What:** Expand `app/(admin)/admin/page.tsx` with real data:

- **MRR** — count of active subscriptions × plan `base_price_cents / 100`; sum of active subscription_addons
- **Active members** — count of `subscriptions` where `status = 'active'`
- **Churn** — count of `subscriptions` where `status = 'cancelled'` in the last 30 days
- **Pipeline runs** — count of `risk_scores` rows with `created_at > now() - interval '24 hours'`; same for `supplement_plans`

All reads use the admin Supabase client. No PII in the aggregate display.

Write a helper file `lib/admin/metrics.ts` with typed query functions, unit tested in `tests/unit/admin/metrics.test.ts` (already exists — extend it).

---

## Step 12 — Update epic-status.md

**Who:** Claude Code  
**What:** After all steps complete, update:
- Epic 12 `Shipped` / `Outstanding` entries for plans UI, CRM metrics, corporate scaffolding
- Epic 13 `Shipped` / `Outstanding` entries for S1/S2 pricing
- Pipeline glyphs and `%` estimates for Epics 12 and 13

---

## Step 13 — Clinician Portal: James review session (Epic 9)

**Who:** James (read + decision) · Claude Code (note-taking and decision capture)

**Context:** The clinician portal has a detailed architecture reference at `docs/architecture/clinician-portal.md`, abstracted from the working Base44 prototype. The agent implementation (Janet-Clinician Brief) is being built in Plan B W2-9 without needing this review. The **portal UI** — the workspace clinicians actually use — is the part that needs James's input before a single page is coded.

**What James needs to read:**
- `docs/architecture/clinician-portal.md` — full design, role system, UI patterns, Base44 proven decisions

**Decisions to capture from the review session:**

| # | Decision | Notes from architecture doc |
|---|---|---|
| ⚠️ C1 | **Clinician invitation flow** — how does an admin invite a clinician? Admin sends email invite → clinician accepts → role assigned. Confirm this matches intended onboarding. | Section 7: explicitly absent from Base44 prototype — needs designing |
| ⚠️ C2 | **Patient consent for care-team access** — AHPRA requires a `consent_records` row before a clinician can see a patient. Where does the patient grant this? During onboarding? Or a separate consent surface? | Section 7: absent from prototype |
| ⚠️ C3 | **Appointment booking from patient side** — does the patient see available slots and book, or does the clinician initiate? | Section 7: absent from prototype |
| ⚠️ C4 | **Role expansion sign-off** — `profiles.role` currently only allows `user` and `admin`. Expanding to `clinician`, `coach`, `health_manager` requires a migration and proxy.ts changes. Confirm the full role list before the migration is written. | Section 6: role system delta |
| ⚠️ C5 | **Check-in review cadence** — Base44 runs this as a monthly review workflow. Confirm: monthly per Epic 9 spec, or triggered by each patient check-in? | Section 2: workflow |
| ⚠️ C6 | **`PROGRAM_READY` signal** — the Base44 prototype uses a text sentinel in the agent stream to trigger program delivery. Confirm we carry this pattern across or replace with a structured `tool_use` result. | Section 5: key design decisions |

**What Claude Code will do with the output:** Record each decision in a new `docs/architecture/clinician-portal-decisions.md` file as soon as the session ends. Plan B W2-9 references those decisions before portal UI steps begin.

---

## Manual tasks (last, or blocked on decisions)

| Task | Who | When |
|---|---|---|
| ⚠️ Seed `plans` table in Supabase with real Stripe price IDs after decisions D1-D4 resolved | James + Trac | After Step 3 migrations deployed |
| ⚠️ Create Stripe add-on price objects for each `plan_addons` row | James | After D1 resolved |
| ⚠️ Verify Stripe webhook secret in production matches `STRIPE_WEBHOOK_SECRET` env var | Trac | Before Step 6 goes to prod |
| ⚠️ Register `/api/cron/repeat-tests` in `vercel.json` crons block | Claude Code (trivial — can do now) | Any time |
| ⚠️ Clinician portal review session (Step 13 above) — decisions C1–C6 | James | Before Plan B portal UI steps begin |
