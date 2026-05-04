# Executive Summary: Seed B2C billing.plans + flip tier model

Date: 2026-05-04
Audience: Product owner

## What was delivered

The `/pricing` page now shows the real B2C plan offering — three tiers (Core, Clinical, Elite), each with a Monthly and Annual price (20% discount for paying annually). Visitors can toggle between Monthly and Annual, see real prices, select a card, and click Continue to Checkout. Previously the page either showed nothing or rendered with broken sort order and broken add-on rules.

This was the most visible bug on the public site — the pricing page is the conversion funnel, and a `$0.00/mo` placeholder with no plan cards has been a regulatory and trust risk since launch.

The fix was bigger than just adding rows: there were two inconsistent representations of the tier model in the codebase (the database used Core/Clinical/Elite, but the application code used Individual/Professional/Corporate). The whole codebase now uses one consistent set of tier names, with the helper logic centralised in one place so future changes can't drift.

## What phase this advances

Phase 1 — Foundation. Closes **BUG-014** (the $0.00 pricing page bug from the QA sweep). Reduces the v1.1 backlog by one item.

## What comes next

**Most important next step you can take:** create the real Stripe products for each plan in the Stripe dashboard, then visit `/admin/plans` (signed in as admin) and replace the placeholder Stripe price IDs (`price_*_PLACEHOLDER`) on each row with the real ones. Until that happens, the pricing page renders correctly but clicking "Continue to checkout" will return an error from Stripe (it doesn't recognise the placeholder IDs). This is unchanged from before — the page just looks complete now.

After that, the next two items on your Phase 1 backlog (in your chosen order):
1. **Super Admin assignment UI at `/admin/users`** — currently you grant roles via SQL
2. **Re-enable full CI** (Gitleaks, pgTAP RLS regression, E2E, Lighthouse)

Then the larger Phase 1 thrust: **RLS rewrites** to route all patient-data tables through the new role helpers from PR #113. (The migration number 0070 is now taken by this PR; the RLS rewrite will be 0071.)

## Risks or open items

- The change ships to every visitor without a feature flag. Risk is low — the failure mode if something goes wrong is "pricing page goes back to broken", which it already was. Existing members with active subscriptions are unaffected (their subscription rows reference `plans.id` UUIDs, not tier names).
- B2B (corporate) pricing is intentionally out of scope. You confirmed it's negotiated per organisation and lives in a separate `b2b_plans` table, which already exists. No B2B work was done in this PR.
- One decision point: I assumed your "clinician" tier name was a typo for "clinical" (matches the existing seed and avoids collision with the `clinician` user role). If you actually want the B2C plan tier displayed as "Clinician" instead of "Clinical", let me know and I'll do a small follow-up that updates only the display labels (the underlying tier value can stay `clinical` — it's a one-line label change in the admin UI and pricing page).
