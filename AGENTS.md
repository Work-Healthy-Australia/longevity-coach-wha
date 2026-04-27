<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:data-management-rules -->
# Data management rules

These three rules govern where each piece of patient data lives. They are not style preferences — violating them creates data drift, blocks PII rotation, and complicates compliance.

## 1. Single source of truth

Each fact lives in exactly one column on one table. Derived facts are computed on read, never stored.

- **Canonical:** `profiles.full_name` (captured at signup → synced via `handle_new_user()` trigger)
- **Derived:** first name, last name → use `splitFullName()` from `lib/profiles/name.ts`. Never store first/last name as separate columns or JSONB keys.
- **Canonical:** `profiles.date_of_birth` — **Derived:** age → compute from DOB at read time, do not store.

If you find yourself adding a column or JSONB key that could be computed from existing data, stop — write a helper instead.

## 2. PII boundary

PII (anything that identifies the patient) lives only on `profiles`. Questionnaire data on `health_profiles.responses` (JSONB) is **de-identified**.

PII columns on `profiles`: `full_name`, `date_of_birth`, `phone`, `address_postal`. Email lives in `auth.users` and stays there.

- The form may collect PII via the same questionnaire UI, but server actions must split at write time. See `lib/profiles/pii-split.ts` and how `app/(app)/onboarding/actions.ts` uses it.
- Never put PII keys (`date_of_birth`, `phone_mobile`, `address_postal`, etc.) inside `health_profiles.responses`. They will block:
  - Vault migration (you can't vault a JSONB key)
  - Right-to-erasure (becomes a JSON-blob scrub across rows instead of a single-row update)
  - Future re-identification audits

When adding a new field to onboarding, decide PII vs questionnaire **before** writing the schema entry.

## 3. Typed columns over JSONB for queryable data

JSONB is for opaque-shape data the app doesn't query on (free-text answers, multi-select arrays, future-proofing for schema-less responses). For anything you'll filter, range-query, validate, or index, use a typed column.

- DOB → `date` column (not `responses.basics.date_of_birth` string). Lets the DB validate, lets the risk engine compute age without parsing JSON.
- Subscription status → `text` column with check constraint, not JSONB. Lets webhooks upsert with `onConflict`.

When in doubt: if the risk engine, a webhook, or a SQL report would touch it, give it a column.

## Table ownership of writes

Each table has one primary writer:

- `profiles` — trigger `handle_new_user()` writes id+full_name on signup; user (via onboarding actions, profile-edit forms) updates the rest. No other writer.
- `health_profiles` — onboarding server actions only. Never written from a webhook or trigger.
- `risk_scores` — service-role risk engine only (RLS denies user writes).
- `subscriptions` — Stripe webhook only.

If you need a new writer for an existing table, that's a design discussion — flag it.
<!-- END:data-management-rules -->
