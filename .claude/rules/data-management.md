# Data Management Rules

These rules govern where each piece of patient data lives. They are not style preferences — violating them creates data drift, blocks PII rotation, and complicates clinical compliance.

---

## Rule 1 — Single source of truth

Each fact lives in exactly one column on one table. Derived facts are computed on read, never stored.

- **Canonical:** `profiles.full_name` — synced via `handle_new_user()` trigger on signup
- **Derived:** first name, last name — use `splitFullName()` from `lib/profiles/name.ts`. Never store first/last as separate columns or JSONB keys.
- **Canonical:** `profiles.date_of_birth` — **Derived:** age — compute from DOB at read time. Do not store age.

If you find yourself adding a column or JSONB key that could be computed from existing data, stop — write a helper instead.

---

## Rule 2 — PII boundary

PII (anything that identifies the patient) lives only on `profiles`. Questionnaire data in `health_profiles.responses` (JSONB) is de-identified.

PII columns on `profiles`: `full_name`, `date_of_birth`, `phone`, `address_postal`. Email lives in `auth.users` and stays there.

The form may collect PII via the same questionnaire UI, but server actions must split at write time. See `lib/profiles/pii-split.ts` and how `app/(app)/onboarding/actions.ts` uses it.

Never put PII keys (`date_of_birth`, `phone_mobile`, `address_postal`, etc.) inside `health_profiles.responses`. This blocks:
- Vault migration (you cannot vault a JSONB key)
- Right-to-erasure (becomes a JSON-blob scrub across all rows instead of a single-row update)
- Future re-identification audits

When adding a new onboarding field, decide PII vs questionnaire **before** writing the schema entry.

---

## Rule 3 — Typed columns over JSONB for queryable data

JSONB is for opaque-shape data the app never queries on (free-text answers, multi-select arrays, future-proofing for schema-less responses). For anything that will be filtered, range-queried, validated, or indexed — use a typed column.

- `date_of_birth` → `date` column, not a string inside `responses.basics.date_of_birth`
- Subscription status → `text` column with check constraint, not JSONB

When in doubt: if the risk engine, a webhook, or a SQL report would touch it, it gets a typed column.

---

## Rule 4 — Table ownership of writes

Each table has exactly one primary writer:

| Table | Primary writer |
|---|---|
| `profiles` | `handle_new_user()` trigger on signup; user via onboarding actions and profile forms |
| `health_profiles` | Onboarding server actions only |
| `risk_scores` | Service-role risk engine only (RLS denies user writes) |
| `subscriptions` | Stripe webhook only |
| `consent_records` | Consent server action only — append-only, never updated |
| `patient_uploads` | Upload server action only |

If you need a new writer for an existing table, flag it as a design discussion before proceeding.

---

## Schema map

| Schema | Purpose |
|---|---|
| `public` | Identity, clinical care, compliance, programs |
| `biomarkers` | All patient measurements, lab data, uploaded results |
| `billing` | Financial layer — will be extracted as a standalone platform in Phase 2 |
