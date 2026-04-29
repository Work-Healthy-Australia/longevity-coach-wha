# Plan: Right-to-erasure flow + "we never train on your data" ToS clause

Date: 2026-04-29
Phase: Phase 2 — Intelligence (Trust Layer hardening)
Status: Revised after plan review (rev 2)

## Objective

Close two outstanding Epic 11 (Trust Layer) items so we can responsibly run an
Epic 9 clinician pilot with real PII:

1. A working **right-to-erasure** flow that cascades across every patient-data
   table, scrubs the JSONB blobs that hold de-identified-but-recoverable
   patient content, and leaves a single auditable record of the request.
2. A "**we never train on your data**" surface — a fourth versioned consent
   toggle on the onboarding consent step, a card on `/account` showing the
   user's acceptance state, and a `/legal/data-handling` page carrying the
   formal copy.

"Done" looks like: a logged-in member can request erasure from `/account`,
type `DELETE` to confirm, and after the action returns, **no SQL query or
storage path under any schema can reproduce that user's name, DOB, phone,
postal address, free-text health responses, journal body, conversation
history, or upload filenames** — while audit trails (consent records, export
log, erasure log) remain intact and queryable by service-role.

## Scope

**In scope:**
- New migration `0052_erasure_log_and_data_no_training.sql` — creates
  `public.erasure_log`, adds `profiles.erased_at`, adds the
  `data_no_training` consent policy.
- Server action rewrite of `app/(app)/account/actions.ts::deleteAccount` to
  cascade across all 20+ patient-data tables identified in research.
- Pure helper module `lib/erasure/` with the cascade plan (table list +
  strategy per table) so the logic is testable in isolation.
- `lib/consent/policies.ts` update to register the `data_no_training` policy.
- Questionnaire schema + onboarding action update to capture the new toggle.
- `/account` "How we use your data" card + hardened deletion confirmation.
- `/legal/data-handling` static page with the formal ToS clause.
- Vitest unit tests for the erasure plan helpers + an integration test that
  verifies cascade against a seeded test user.

**Out of scope:**
- Right-to-erasure for soft-deleted accounts (covered by hard-delete of
  `auth.users` at the end of the cascade — gated behind `ENABLE_HARD_DELETE`
  env var with default flipped to `true`).
- A self-service `pause_at` reactivation grace period (Epic 11 already ships
  pause/unpause separately).
- AHPRA breach-notification protocol document (Epic 14).
- Right-to-erasure across third-party processors (Resend, Stripe,
  Anthropic) — those are handled by their own DPAs, but we will document the
  list on `/legal/data-handling`.

## Critical schema findings from review

The plan reviewer surfaced facts about the existing schema that change several
strategy choices. Recording them up-front so every task below assumes the
correct shape:

- `consent_records.user_uuid` has `ON DELETE CASCADE` to `auth.users(id)`.
  Hard-delete of `auth.users` therefore **wipes the consent audit trail**.
  Wave 1 must drop this cascade (`ALTER TABLE ... DROP CONSTRAINT ... ADD
  ... ON DELETE SET NULL`) so the audit row survives. Same evaluation for
  `export_log.user_uuid` and `erasure_log.user_uuid` — the latter is created
  fresh in Wave 1 with `ON DELETE SET NULL`.
- Most other patient-data tables already cascade on `auth.users` delete.
  When `ENABLE_HARD_DELETE = true`, FK cascade does most of the table work.
  The explicit `delete`/`scrub` plan is the **soft-delete fallback path**
  (used when hard-delete is off, e.g. for accounts with active Stripe
  subscriptions where we have to retain the auth row to bill-cycle out
  cleanly). Both paths must produce the same end-state from the user's
  perspective.
- Column names corrected: `agent_conversations.content` (NOT `messages`);
  `patient_uploads.janet_findings` (NOT `findings`).
- `consent_records.policy_id` is free-text `text not null` — no CHECK
  constraint exists. Wave 1 does **not** modify a constraint here.
- `support_tickets.summary`, `care_notes.content`, `journal_entries.body`
  are `NOT NULL` — scrub strategy for these uses the sentinel `'[ERASED]'`,
  not `NULL`.

## Data model changes

| Change | Schema | Type | PII? | Owner-writes? |
|---|---|---|---|---|
| `public.erasure_log` (new table) | public | typed | Meta-PII only (`request_ip`, `request_user_agent` retained as audit; documented as such) | Service-role only |
| `profiles.erased_at` (new column) | public | `timestamptz` nullable | No | Service-role only |
| `consent_records.user_uuid` FK changed from `ON DELETE CASCADE` to `ON DELETE SET NULL`; column made **nullable** | public | constraint + nullability change | n/a | n/a |
| `export_log.user_uuid` FK changed from `ON DELETE CASCADE` to `ON DELETE SET NULL`; column made **nullable** | public | constraint + nullability change | n/a | n/a |
| `consent_records.policy_id = 'data_no_training'` (new value) | public | free-text, no constraint change needed | No | Existing pattern |

`erasure_log` columns:
- `id uuid primary key default gen_random_uuid()`
- `user_uuid uuid` (nullable; FK to `auth.users(id) ON DELETE SET NULL` so the audit row survives a hard-delete)
- `erased_at timestamptz not null default now()`
- `request_ip text`
- `request_user_agent text`
- `confirmation_text text not null` — exact string the user typed (must equal `DELETE`)
- `table_counts jsonb not null` — `{ "profiles": 1, "health_profiles": 1, "lab_results": 23, ... }`
- `hard_delete bool not null default false` — was the auth.users row also removed
- `stripe_subscription_action text` — one of `none`, `cancelled`, `blocked` (see Task 2.2 Stripe step)
- RLS: service-role insert only, owner-select **disabled** (the user is gone), admin-select via `is_admin`

Single source of truth check: `profiles.erased_at` is canonical for "is this
account erased". `erasure_log` is the immutable audit; `auth.users` may or
may not exist depending on hard-delete flag.

JSONB scrub targets are already de-identified per Rule 2; we still null them
because they may contain free-text answers ("my mother died of breast cancer
at 47") that re-identify in narrow circumstances.

## Waves

### Wave 1 — Schema + policy registration

**What James can see after this wave merges:** No visible UI change yet.
What he can verify: the migration applies cleanly, `lib/supabase/database.types.ts`
regenerates with the new table, the test suite still passes. This wave is a
non-breaking foundation — `deleteAccount` keeps its existing skeleton
behaviour until Wave 2 lands.

#### Task 1.1 — Migration `0052_erasure_log_and_data_no_training.sql`

Files affected:
- `supabase/migrations/0052_erasure_log_and_data_no_training.sql` (new)
- `supabase/schema/public/tables/erasure_log.sql` (new canonical)
- `supabase/schema/public/tables/profiles.sql` (update — add `erased_at`)
- `supabase/schema/public/tables/consent_records.sql` (update — reflect FK change to `ON DELETE SET NULL` and `user_uuid` nullable)
- `supabase/schema/public/tables/export_log.sql` (update — same FK change)

What to build:
- `CREATE TABLE IF NOT EXISTS public.erasure_log (...)` with columns above (FK uses `ON DELETE SET NULL`).
- `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS erased_at timestamptz`.
- `ALTER TABLE public.consent_records DROP CONSTRAINT consent_records_user_uuid_fkey, ADD CONSTRAINT consent_records_user_uuid_fkey FOREIGN KEY (user_uuid) REFERENCES auth.users(id) ON DELETE SET NULL` (also drop `NOT NULL` on `consent_records.user_uuid`). The constraint name is verified in `0004_consent_records.sql`.
- Same FK change for `public.export_log.user_uuid` (verify constraint name from migration `0026`).
- `consent_records.policy_id` is **already free-text** (no CHECK constraint per `0004_consent_records.sql`). No constraint work needed; new value `'data_no_training'` will be accepted as-is.
- Enable RLS on `erasure_log`. Policies:
  - `service_role can insert`
  - `is_admin can select` (re-use existing admin pattern)
  - No owner-select policy (user is gone).
- Index: `(user_uuid)`, `(erased_at desc)`.

Acceptance criteria:
- `supabase db diff` shows only the intended changes.
- Running the migration twice is a no-op (`IF NOT EXISTS` + guarded `DROP/ADD CONSTRAINT` block).
- `pnpm exec supabase gen types typescript --local > lib/supabase/database.types.ts` adds an `erasure_log` table type and reflects the FK changes.
- Existing pgTAP RLS suite still passes; add one new pgTAP assertion: `service_role can insert into erasure_log`, `anon cannot select from erasure_log`.
- Hard-delete a test user via SQL: assert `consent_records` row for that user survives with `user_uuid IS NULL` (proves the FK change works).

Rules to apply:
- `.claude/rules/database.md` — idempotent migration, canonical schema file, RLS on every new table.
- `.claude/rules/data-management.md` — `erasure_log.user_uuid` is identifier-as-anchor only, no PII columns.

#### Task 1.2 — Register `data_no_training` policy

Files affected:
- `lib/consent/policies.ts`

What to build:
- Add `data_no_training: { version: "2026-04-29-1" }` to `CONSENT_POLICIES`.
- The PolicyId union type updates automatically.

Acceptance criteria:
- `pnpm typecheck` passes — no callers reject the new union member.
- `recordConsents()` accepts `'data_no_training'` as input.

Rules to apply:
- `.claude/rules/security.md` — consent records are append-only, version bumps with copy changes.

---

### Wave 2 — Cascade engine + audited server action

**What James can see after this wave merges:** A working delete-my-account
flow on `/account` that, when triggered, irreversibly removes the user's
PII across every table, leaves a row in `erasure_log`, and signs the user
out. The button still says "Delete my account" (Wave 3 hardens the
confirmation UX) but the **server-side cascade is complete and tested**.

#### Task 2.1 — Pure cascade plan helper

Files affected:
- `lib/erasure/plan.ts` (new)
- `lib/erasure/plan.test.ts` (new — unit)

What to build:
- Export `ERASURE_PLAN: ErasurePlanEntry[]` — one entry per table, each:
  ```ts
  {
    schema: "public" | "biomarkers" | "billing" | "agents",
    table: string,
    userColumn: "user_uuid" | "patient_uuid" | "id",
    strategy: "delete" | "scrub" | "retain_anonymised",
    scrubFields?: { column: string; mode: "null" | "erased_sentinel" | "empty_jsonb" }[],
  }
  ```
  The `mode` per column is mandatory because several scrub targets are
  `NOT NULL` (`care_notes.content`, `support_tickets.summary`,
  `journal_entries.body` — all use `erased_sentinel = '[ERASED]'`). JSONB
  blobs (`agent_conversations.content` is text; `health_profiles.responses`,
  `patient_uploads.janet_findings`, `coach_suggestions.rationale` if jsonb)
  use `empty_jsonb` (`'{}'::jsonb`).

- **24 entries**, exactly:
  1. `public.profiles` (id) — scrub: `full_name=erased_sentinel`, `date_of_birth=null`, `phone=null`, `address_postal=null`; also set `erased_at=now()`.
  2. `public.health_profiles` (user_uuid) — scrub: `responses=empty_jsonb`.
  3. `public.risk_scores` (user_uuid) — delete.
  4. `public.subscriptions` (user_uuid) — delete (Stripe-side cancellation handled separately in Task 2.2).
  5. `public.consent_records` (user_uuid) — retain_anonymised: `ip_address=null`, `user_agent=null` (rows kept; AHPRA audit trail).
  6. `public.patient_uploads` (user_uuid) — scrub: `original_filename=erased_sentinel`, `janet_findings=empty_jsonb`. Storage object removal handled in Task 2.2 before scrub.
  7. `public.family_members` (user_uuid) — delete.
  8. `public.agent_conversations` (user_uuid) — scrub: `content=erased_sentinel`. (Column is **text**, not jsonb; not `messages`.)
  9. `public.support_tickets` (user_uuid) — scrub: `summary=erased_sentinel` (NOT NULL).
 10. `public.appointments` (patient_uuid) — delete.
 11. `public.care_notes` (patient_uuid) — retain_anonymised: `content=erased_sentinel` (NOT NULL); rows kept for clinician's professional record (AHPRA records-keeping). Decision recorded in Risks below.
 12. `public.patient_assignments` (patient_uuid) — retain_anonymised: status flipped to `'patient_erased'`; clinician keeps the relationship row but cannot reach back to the patient.
 13. `public.periodic_reviews` (patient_uuid) — retain_anonymised: scrub `wins=null`, `stress_notes=null`, `ai_summary=null`, `program_30_day=empty_jsonb`. Same rationale as care_notes.
 14. `public.coach_suggestions` (patient_uuid) — delete.
 15. `public.journal_entries` (user_uuid) — scrub: `body=erased_sentinel` (NOT NULL).
 16. `public.member_alerts` (user_uuid) — delete.
 17. `public.export_log` (user_uuid) — retain_anonymised: `request_ip=null`.
 18. `biomarkers.lab_results` (user_uuid) — delete.
 19. `biomarkers.biological_age_tests` (user_uuid) — delete.
 20. `biomarkers.daily_logs` (user_uuid) — delete.
 21. `billing.subscription_addons` (user_uuid) — delete.
 22. `billing.test_orders` (user_uuid) — delete.
 23. `billing.organisation_members` (user_uuid) — delete.
 24. `agents.conversation_summaries` (user_uuid) — scrub: `summary=erased_sentinel` if NOT NULL else `null`.

- Pure helper `summariseCounts(results: { table: string; count: number }[]): Record<string, number>` for the audit row.

Acceptance criteria:
- All 24 tables enumerated, each with `strategy` and (for scrubs) explicit
  per-column `mode`.
- Unit tests verify: every NOT NULL column gets `erased_sentinel`, every
  jsonb gets `empty_jsonb`, every nullable text/text-that-can-be-null gets
  `null`. Tests pull column nullability from `lib/supabase/database.types.ts`
  to detect drift.
- `consent_records`, `export_log`, `care_notes`, `periodic_reviews`,
  `patient_assignments` are `retain_anonymised`, never `delete`.
- `summariseCounts` collapses correctly.
- No table appears twice.

Rules to apply:
- `.claude/rules/data-management.md` — Rule 2 (PII boundary: every PII scrub anchored on `profiles`).
- `.claude/rules/security.md` — append-only audit tables (`consent_records`, `export_log`) get retain_anonymised, never delete.

#### Task 2.2 — Server action `deleteAccount` rewrite

Files affected:
- `app/(app)/account/actions.ts` (replace)
- `lib/erasure/execute.ts` (new — orchestrator; thin wrapper around `ERASURE_PLAN`)

What to build:
- New signature: `deleteAccount(prevState, formData)` (server action with a typed result).
- Validates `formData.get("confirmation") === "DELETE"` — return `{ error: "Type DELETE to confirm." }` otherwise.
- Loads `userId` from `supabase.auth.getUser()`. Bail if no user.
- **Idempotency guard**: `SELECT 1 FROM erasure_log WHERE user_uuid = $1 LIMIT 1` — if a row exists, return `{ error: "Already erased." }` (cannot use `profiles.erased_at` since the row may have been hard-deleted).
- Captures `request_ip` + `request_user_agent` from `headers()`.
- **Stripe step (before any DB writes):**
  - Lookup `subscriptions WHERE user_uuid = $1 AND status IN ('active','trialing','past_due')`.
  - If found: call `stripe.subscriptions.cancel(subscriptionId, { invoice_now: false, prorate: false })`. Record outcome as `stripe_subscription_action = 'cancelled'`.
  - If `stripe.subscriptions.cancel` throws: bail with `{ error: "Could not cancel your subscription. Please contact support." }` and write **no** erasure_log row. Do not proceed to scrub. Reasoning: an orphaned active Stripe customer post-erasure is worse than a failed delete.
  - If no active subscription: `stripe_subscription_action = 'none'`.
- **Storage step (before scrub of `patient_uploads`):**
  - List objects under `patient-uploads/<userId>/` and remove with `admin.storage.from('patient-uploads').remove(paths)`.
  - List objects under `report-pdfs/<userId>/` (the report bucket — verify exact bucket name from existing PDF code) and remove. Non-fatal: log on failure but proceed.
- Calls `executeErasure(admin, userId)` from `lib/erasure/execute.ts`:
  - Runs each `ERASURE_PLAN` entry sequentially: `delete` → `DELETE`; `scrub` → `UPDATE` per the per-column `mode` mapping; `retain_anonymised` → `UPDATE` nulling/sentinel-ing only the specified columns.
  - Tracks per-table `count` of affected rows.
- Inserts one `erasure_log` row with `table_counts`, `confirmation_text="DELETE"`, `hard_delete = (ENABLE_HARD_DELETE !== 'false')`, `stripe_subscription_action`.
- Sets `profiles.erased_at = now()`.
- **Dual mode finalisation:**
  - If `ENABLE_HARD_DELETE !== 'false'` (default `true` from this wave): `admin.auth.admin.deleteUser(userId)`. Existing FK cascades will remove most plan-listed rows, which is fine — the explicit cascade above is idempotent and just-in-case (and the row counts have already been written to `erasure_log`).
  - If `ENABLE_HARD_DELETE === 'false'`: leave `auth.users` row in place. Add `profiles.full_name = '[ERASED]'` and `auth.users.email` is already non-PII-by-design but sign the user out via `supabase.auth.signOut()`. The plan-driven scrub/delete is the only path here.
- Calls `redirect('/?erased=1')`.

Acceptance criteria:
- A seeded user with rows in 10+ tables is fully erased on action call.
- Verification query (in test): no row anywhere has the test name / DOB / phone / address / original filename / journal body.
- `erasure_log` has exactly one row with `table_counts` summing to actual DB activity, and `stripe_subscription_action` set correctly.
- `consent_records` and `export_log` rows for the user are still present (after hard-delete `user_uuid` will be NULL on those rows; before hard-delete `ip_address` / `user_agent` / `request_ip` are NULL).
- `care_notes`, `periodic_reviews`, `patient_assignments` rows are retained and anonymised (clinician's professional record stands).
- Idempotent: re-invocation returns `{ error: "Already erased." }` based on `erasure_log` lookup, not `profiles.erased_at` (which may not exist post-hard-delete).
- Stripe cancellation hard-blocks erasure if it fails; no `erasure_log` row is written in that case.
- Non-fatal: storage delete failure is logged, doesn't roll back the DB cascade.

Rules to apply:
- `.claude/rules/security.md` — service-role admin client only; user can never call this without auth; never log the user's PII in error messages.
- `.claude/rules/nextjs-conventions.md` — server action returns typed result; redirects on success.

#### Task 2.3 — Integration test: full cascade against test DB

Files affected:
- `tests/integration/erasure/cascade.test.ts` (new)

What to build:
- Test fixture seeds one user across `profiles`, `health_profiles`, `risk_scores`, `agent_conversations`, `journal_entries`, `lab_results`, `daily_logs`, `consent_records`, `patient_uploads` (storage row + Storage object).
- Calls `deleteAccount` server action.
- Asserts:
  - `profiles.full_name = '[ERASED]'` and `erased_at IS NOT NULL`.
  - `health_profiles.responses = '{}'::jsonb`.
  - `agent_conversations.content = '[ERASED]'`.
  - `journal_entries.body = '[ERASED]'`.
  - `lab_results` rows for that user_uuid count = 0 (delete strategy).
  - `consent_records` rows still exist but `ip_address IS NULL`.
  - `erasure_log` has exactly 1 row with `user_uuid` = seeded user.
  - Storage bucket has zero objects under that user's prefix.

Acceptance criteria:
- `pnpm test tests/integration/erasure/` passes against an isolated Supabase branch DB (or a transaction-wrapped fixture that rolls back on teardown) — must not leave residue in any shared dev DB.
- Test runs in CI (Vitest already in CI workflow).
- Both modes covered: one test with `ENABLE_HARD_DELETE=true`, one with `=false`. Both must produce equivalent end-state from a "no PII reachable" perspective.

Rules to apply:
- `.claude/rules/database.md` — RLS-respecting test isolation; service-role used only for assertions.

---

### Wave 3 — UX surfaces: ToS clause + hardened confirmation

**What James can see after this wave merges:**
- A new user signing up will see a fourth toggle "We never train AI models
  on your personal data" on the consent step, with a link to the new
  `/legal/data-handling` page.
- Any logged-in member can visit `/account` and see a "How we use your
  data" card showing the policy text + their acceptance date.
- Clicking "Delete my account" now requires typing `DELETE` into a text
  input before the destructive button enables.
- A new `/legal/data-handling` page exists carrying the formal data-use
  statement and the list of named third-party processors.

#### Task 3.1 — Add `data_no_training` to consent step

Files affected:
- `lib/questionnaire/questions.ts` (consent step at line 336)
- `app/(app)/onboarding/actions.ts` (the consent-acceptance branch at line 165)

What to build:
- Append a fourth toggle to the consent step:
  ```ts
  {
    id: "data_no_training",
    label:
      "I understand Longevity Coach does not train AI models on my personal data. (See: data handling page)",
    type: "toggle",
    helpText: "Required.",
  }
  ```
- In `onboarding/actions.ts`, push `'data_no_training'` into the accepted
  array if the toggle is true.
- Update the consent step's `description` if needed to mention the four
  confirmations now (was three).

Acceptance criteria:
- A new signup writes one `consent_records` row with `policy_id =
  'data_no_training'`.
- Form validation rejects submission without all four toggles accepted.
- Existing 14 questionnaire schema tests still pass; add 1 new test for
  the 4-toggle case.

Rules to apply:
- `.claude/rules/security.md` — versioned consent records, append-only.

#### Task 3.2 — `/legal/data-handling` page

Files affected:
- `app/(public)/legal/data-handling/page.tsx` (new)
- `app/(public)/legal/data-handling/page.css` (new — co-located scoped CSS)

What to build:
- Static page (`export const dynamic = 'force-static'`).
- Sections:
  1. **What we do with your data** — short bullet list, plain language.
  2. **What we never do** — explicit "we never train ML / AI models on
     your personal data; we never sell or rent your data; we never share
     your data with employers without your explicit consent."
  3. **Named third-party processors** — table of: Anthropic (LLM
     inference), Resend (email), Stripe (payments), Supabase (storage +
     auth), Vercel (hosting). Each row: vendor, purpose, region, link to
     their DPA.
  4. **Your rights** — link to /account erasure flow + export download.
- Match the styling of the existing `/legal/collection-notice` page.
- Footer link added in `app/(public)/_components/footer.tsx` (or
  equivalent — discover the actual file).

Acceptance criteria:
- Page renders at `/legal/data-handling` for both signed-in and signed-out
  users.
- Lighthouse score ≥ 95 (matches existing legal pages).
- Footer link visible site-wide.

Rules to apply:
- `.claude/rules/nextjs-conventions.md` — `(public)` route group, scoped
  CSS, no Tailwind utilities where scoped CSS exists.

#### Task 3.3 — `/account` "How we use your data" card

Files affected:
- `app/(app)/account/page.tsx` (insert new section between "Identity" and "Care team")
- `app/(app)/account/account.css` (style the new card)

What to build:
- Server-side query: `SELECT MAX(accepted_at) FROM consent_records WHERE
  user_uuid = ? AND policy_id = 'data_no_training' AND policy_version = ?`
  (current version from `policyVersion('data_no_training')`).
- Card content:
  - Heading: "How we use your data".
  - Body: one-paragraph plain-English statement, with a link to
    `/legal/data-handling`.
  - Acceptance line: "You agreed to this on [date]" (or "Not yet
    confirmed — please review →" linking to the legal page if no record
    exists; existing users pre-clause).
- No interactive toggle on this card — re-acceptance only happens on the
  next material change (when policy version bumps).

Acceptance criteria:
- New users see "You agreed to this on [signup date]".
- Existing users (no `data_no_training` record yet) see the
  not-yet-confirmed CTA.
- Page renders without errors when consent_records is empty.

Rules to apply:
- `.claude/rules/data-management.md` — single source of truth (consent
  acceptance lives in `consent_records`, not derived/cached).

#### Task 3.4 — Hardened delete confirmation

Files affected:
- `app/(app)/account/_components/delete-account-button.tsx` (replace)
- `app/(app)/account/page.tsx` (pass `formAction={deleteAccount}`)
- `app/(app)/account/account.css` (style the typed-confirmation input)

What to build:
- After clicking "Delete my account", show:
  - Strong warning copy listing what will be removed (PII, uploads,
    conversations, journal) and what is retained anonymised (consent
    history, lab observations).
  - Text input: "Type **DELETE** to confirm".
  - Submit button disabled until input value === "DELETE".
  - Cancel button.
- Use `useActionState` to surface server-side errors back into the UI.
- On success the server redirects, no client-side handling needed.

Acceptance criteria:
- The destructive action cannot be triggered without typing `DELETE`.
- Server-side check matches client-side check (defence in depth).
- Cancel returns to the idle state with no destructive call made.

Rules to apply:
- `.claude/rules/nextjs-conventions.md` — `useActionState` from `react`,
  not `react-dom`.
- `.claude/rules/security.md` — never echo the typed string back; the
  action discards it after the equality check.

---

## Build order (overall)

Wave 1 (schema + policy registration) → Wave 2 (server cascade + tests) →
Wave 3 (UX surfaces). Each is independently mergeable and deployable.

After all three waves:
- Epic 11 outstanding items "Right-to-erasure flow" and "We never train on
  your data clause" close.
- `epic-status.md` Epic 11: `●●●○○` 90% → `●●●●○` ~95% (stages: + Regression
  Tested if Playwright erasure scenario added; otherwise estimate-only bump).
- Epic 9 pilot is unblocked — real PII can flow through the system.

## Risks

- **Test-DB seeding for the cascade integration test**: requires care to
  avoid bleeding into a shared local Supabase instance. Will use a
  per-test transaction/cleanup wrapper or a Supabase branch DB.
- **Hard-delete default flip**: changing `ENABLE_HARD_DELETE` default from
  off to on is the correct behaviour but must be flagged in EXECUTIVE_SUMMARY
  for James — removes the auth.users row entirely. User cannot sign back
  in with the same email until they re-register.
- **Clinician-side data fate (decision, not risk):** `care_notes`,
  `periodic_reviews`, `patient_assignments` are scoped as
  `retain_anonymised`, NOT `delete`. Reasoning: AHPRA records-keeping
  guidelines require clinicians to retain clinical notes for a minimum
  retention period (typically 7 years for adults). Patient erasure removes
  the patient's identifiers but leaves the clinician's professional record
  with `'[ERASED]'` in place of patient-authored content. The patient is
  unreachable; the clinician's compliance record stands. This decision
  should be confirmed with the clinical advisor before Wave 2 ships — flag
  in EXECUTIVE_SUMMARY.
- **Stripe orphan prevention**: Erasure now hard-blocks if Stripe
  cancellation fails. Failure mode is rare (Stripe API outage); user
  receives a "contact support" message and remains intact until support
  manually resolves. Better than silently leaving an active subscription
  attached to an erased user.
- **Existing users without `data_no_training` consent**: they will see
  "Not yet confirmed" on `/account` until they next interact with a
  consent surface. Not a legal blocker (positive commitment — it's
  something we promise them, not something we need their consent to do).
  One-shot in-app modal is out of scope for v1; revisit if friction surfaces.
- **Storage outside `patient-uploads/`**: report PDFs are scoped for
  removal in Task 2.2; if any other patient-content bucket exists (e.g.
  Janet-generated artifacts), it must be added to the storage step.
  Wave 2 implementer should grep `admin.storage.from(` across the codebase
  before claiming the storage step complete.
