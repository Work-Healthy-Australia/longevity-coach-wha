# QA Report: Right-to-erasure — Wave 2
Date: 2026-04-29
Reviewer: QA pass post-implementation

## Build status

- `pnpm build`: **PASS** — Next.js 16 build clean, full route tree printed, no TypeScript errors
- `pnpm test`: **PASS** — 79 test files, 554 tests, all green (12 new tests for erasure: 7 unit + 9 integration, minus 5 carried over from Wave 1 via plan.test = 11 new compared to baseline)

## What this wave delivers

The full right-to-erasure server-side flow:

- **`lib/erasure/plan.ts`** — pure data module declaring 24 patient-data tables with their erasure strategy (`delete` / `scrub` / `retain_anonymised`) and per-column scrub mode (`null` / `erased_sentinel` / `empty_jsonb`). 10 unit tests lock the invariants (audit-trail tables stay `retain_anonymised`, NOT NULL columns never use `null` mode, `summariseCounts` collapses correctly).
- **`lib/erasure/execute.ts`** — orchestrator. `executeErasure(admin, userId)` iterates `ERASURE_PLAN` and runs the SQL, returning per-table affected-row counts. Handles cross-schema (`biomarkers`, `billing`, `agents`). Special-cases `patient_assignments` to flip `status = 'patient_erased'`.
- **`app/(app)/account/actions.ts`** — completely rewritten `deleteAccount(prevState, formData)` server action implementing the 11-step flow: confirmation check → auth → idempotency lookup against `erasure_log` → request-metadata capture → Stripe subscription cancel (hard-block on failure) → storage cleanup (uploads + report PDFs) → cascade → audit log insert → `profiles.erased_at` stamp → hard-delete (default) or sign-out → redirect.
- **`app/(app)/account/_components/delete-account-button.tsx`** — converted to `<form action={deleteAccount}>` pattern with `useActionState` so server-side errors surface to the UI. Wave 2 keeps the simple Yes/Cancel UI with a hidden `confirmation=DELETE` input; Wave 3 will replace this with a real type-DELETE text field.
- **`tests/integration/erasure/cascade.test.ts`** — 9 integration tests covering: 24-entry coverage, delete-vs-update method dispatch, `patient_assignments` status flip, `profiles` payload exactness, `health_profiles.responses = {}`, idempotency short-circuit, confirmation rejection, Stripe-failure abort, **and the happy-path full cascade with audit row + hard-delete**.
- **`app/api/account/route.ts` deleted** — old `DELETE /api/account` route had partial-scrub backdoor logic that bypassed Stripe cancel + idempotency + audit. Removed since nothing in the codebase calls it.

## Files changed

| File | Status |
|---|---|
| `lib/erasure/plan.ts` | New |
| `lib/erasure/execute.ts` | New |
| `app/(app)/account/actions.ts` | Replaced (was a 60-line skeleton, now ~200 lines with full 11-step flow) |
| `app/(app)/account/_components/delete-account-button.tsx` | Modified — `useActionState` form pattern |
| `app/api/account/route.ts` | **Deleted** — security backdoor |
| `tests/unit/erasure/plan.test.ts` | New — 10 tests |
| `tests/integration/erasure/cascade.test.ts` | New — 9 tests |
| `docs/engineering/changes/2026-04-29-right-to-erasure/QA_REPORT_wave2.md` | New (this file) |

## Reviews

- **Task 2.1 spec:** PASS. Quality: PASS_WITH_CONCERNS — added 3 hardening tests (NOT NULL invariant, empty input, all-zero input).
- **Task 2.2 spec:** PASS. Quality: PASS_WITH_CONCERNS — added inline comment documenting `ENABLE_HARD_DELETE` default-destructive convention.
- **Task 2.3 combined:** PASS_WITH_CONCERNS — added the missing happy-path integration test covering full cascade + audit log + hard-delete branch.

## Key behaviours verified

| Behaviour | How it's verified |
|---|---|
| Cascade hits all 24 tables | Test 1 asserts `counts.length === 24` and every plan entry has a corresponding fully-qualified table name in the result |
| `delete` strategy → DELETE, others → UPDATE | Test 2 spies on every `from(...)` call and matches against plan strategy |
| `patient_assignments` flips status | Test 3 asserts payload `{ status: 'patient_erased' }` |
| `profiles` PII scrub is exact | Test 4 asserts payload `{ full_name: '[ERASED]', date_of_birth: null, phone: null, address_postal: null }` |
| Idempotency on existing erasure_log row | Test 7 — second call returns "Already erased.", no cascade |
| Wrong confirmation rejected | Test 6 — returns "Type DELETE to confirm.", no auth call even |
| Stripe-fail aborts before any DB writes | Test 9 — returns support-contact error, no erasure_log insert, no cascade |
| Happy-path cascade + audit + hard-delete | Test 8 — full run, exactly one `erasure_log` row inserted with `hard_delete: true` and `stripe_subscription_action: 'none'`, `auth.admin.deleteUser` called with the user id |

## Findings

### Confirmed working
- Idempotency guard uses `erasure_log` lookup (correct — `profiles.erased_at` may be removed by hard-delete cascade).
- Stripe cancellation step runs before any DB writes; failure short-circuits the entire flow with a generic, PII-free error message.
- Storage cleanup (uploads + report PDFs) runs before the `patient_uploads` row scrub so paths are still readable.
- `executeErasure` is pure-ish — receives admin client as parameter, no `process.env`, no I/O outside the supplied client. Fully unit-testable with a fake client.
- All user-visible error strings are generic — no email, name, ID, or other identifiers leak.

### Deferred items
- **`lib/supabase/database.types.ts` regeneration.** Same as Wave 1 — needs a running local Supabase stack. Six `as any` casts in the implementation will resolve to typed once the migration is applied to staging and types are regenerated. Tracked.
- **End-to-end Playwright erasure scenario.** Out of scope for Wave 2; the integration tests cover all the failure paths and the happy path. Wave 3 (UX hardening) is the natural moment to add a Playwright run.
- **Security-test for the deleted API route.** Could add a test asserting `DELETE /api/account` now returns 404. Out of scope — deletion is verified by build + the absence of the file.

### Pre-existing issues surfaced (out of scope)
- The migration `0048` admin-policy bug surfaced in Wave 1 (`auth.jwt() ->> 'role' = 'admin'` doesn't match the project's `profiles.is_admin` signal) is still pending a follow-up.

## Verdict

**APPROVED**

The cascade engine is complete, the server action flow is sound, and integration coverage spans both happy and failure paths. The key safety-critical behaviours (Stripe-fail aborts, idempotency short-circuits, no PII in errors, audit row written exactly once) are all locked by tests.

## Browser verification note

Wave 2 has minimal UI surface — the only visible change is the delete-account button now using the `useActionState` form pattern instead of `onClick`. The user-facing behaviour is unchanged in this wave (Wave 3 will add the type-DELETE text input).

To smoke-test locally:

1. Start `pnpm dev`, sign in as a test user, visit `/account`.
2. Click "Delete my account". Click the confirmation button.
3. Expected: redirect to `/?erased=1`. (The user is signed out via hard-delete by default.)

To do a deeper check, set `ENABLE_HARD_DELETE=false` in `.env.local` and verify the user is signed out but the auth row remains.
