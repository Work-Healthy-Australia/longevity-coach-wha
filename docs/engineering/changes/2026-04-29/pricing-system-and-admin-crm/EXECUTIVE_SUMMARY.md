# Executive Summary: Pricing System + Admin CRM
Date: 2026-04-29
Audience: Product owner, clinical advisor

## What was delivered

Members can now compare plans on a public pricing page, choose monthly or
annual billing, optionally add features like the supplement protocol or branded
PDF export, and complete checkout — all driven from data the admin team
controls in the back office. Once subscribed, members can manage those add-ons
(add or remove without re-checking out) and order one-off tests like DEXA scans
or blood panels straight from their billing page.

The admin team has a new back-office for the catalog: pages to create and edit
plans, add-ons, suppliers, and products, with an active/inactive toggle and the
correct visibility rules (wholesale prices stay admin-only). The admin overview
also gained a metrics dashboard with monthly recurring revenue, active members,
churn, and pipeline activity at a glance.

The corporate offering has its scaffolding in the database: organisations now
get one flat-priced subscription, add-ons billed as flat one-line items, and a
new invitation table that supports both email invites and bulk CSV imports.

## What phase this advances

This work moves Epic 12 (The Distribution) and Epic 13 (The Business Model)
forward substantially:

- Epic 12 → ~55% (was 20%): admin CRM is now a real back-office, and corporate
  invites + add-on billing are wired at the schema layer.
- Epic 13 → ~45% (was 0%): the customer-facing pricing rail, member add-on
  management, and admin catalog are all live in code; only Stripe price-ID
  seeding and the employer-facing UI remain.

## What comes next

- James + Trac seed `billing.plans` with the real Stripe price IDs; create the
  Stripe price objects for each `plan_addons` row.
- Build the employer dashboard (`/employer`) on top of the existing schema and
  add the CSV invite intake handler.
- James runs the Clinician Portal review session (Sprint 2 Step 13) so Plan B
  Wave-2-9 can start.

## Risks or open items

- The regenerated TypeScript types file (`lib/supabase/database.types.ts`) has
  not been refreshed — code uses runtime-safe casts where the new columns are
  referenced. Refresh on next deploy.
- The legacy Stripe checkout body (`{ plan: 'monthly' | 'annual' }`) is still
  accepted; remove once all signup buttons migrate to the new DB-driven body.
