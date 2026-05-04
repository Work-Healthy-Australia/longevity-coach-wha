# QA Report: Signup redirect preservation — Wave 1

Date: 2026-05-04
Reviewer: dev-loop QA pass

## Build status

- `pnpm build`: PASS — no error or fail lines beyond pre-existing turbopack-root warning
- `pnpm test`: PASS — **702 passed, 4 skipped, 0 failed** across 91 test files (2 skipped suites)
- `pnpm test tests/unit/auth/`: PASS — 59 / 59 (27 safe-redirect + 9 sign-in-redirect + 7 sign-up-redirect + 12 auth-callback + 4 email-confirmed)

## Test results

| Suite | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| `tests/unit/auth/safe-redirect.test.ts` (existing) | 27 | 27 | 0 | 0 |
| `tests/unit/auth/sign-in-redirect.test.ts` (existing) | 9 | 9 | 0 | 0 |
| `tests/unit/auth/sign-up-redirect.test.ts` (new) | 7 | 7 | 0 | 0 |
| `tests/unit/auth/auth-callback-next.test.ts` (new) | 12 | 12 | 0 | 0 |
| `tests/unit/auth/email-confirmed-page.test.ts` (new) | 4 | 4 | 0 | 0 |
| Full project suite | 706 | 702 | 0 | 4 |

The 4 skipped tests are pre-existing.

## Findings

### Confirmed working
- Cross-form links forward `?redirect=` between `/login`, `/signup`, `/verify-email` via the new `authLinkWithRedirect()` helper.
- Unsafe redirect values (`//evil.com`, `/login` loops, control chars) are dropped from cross-form links rather than substituted with a default — the user just sees the bare link.
- Signup form emits hidden `redirect` input populated from `useSearchParams()`. `app/(auth)/signup/page.tsx` correctly wraps `<SignupForm />` in `<Suspense fallback={null}>` (mandatory for `useSearchParams()` to compile under Next 16).
- `signUp()` reads form `redirect`, validates via `safeRedirect(rawRedirect, "/dashboard")`, and embeds the validated target in `emailRedirectTo`'s `?next=` param. Verify-email URL carries `&redirect=` only when the user supplied a real, safe target (not the fallback).
- `/auth/callback` validates `next` via `safeRedirect()` for non-recovery flows. Recovery flows BYPASS `safeRedirect()` (the `/reset-password` target is in its block-list) and hard-code to `/reset-password`. Defensive `console.warn` if a recovery flow ever arrives with a different `next` (catches future bugs).
- `/email-confirmed` now uses `safeRedirect()` instead of the closed `ALLOWED_NEXT` allowlist — `/insights`, `/journal`, `/care-team`, etc. are all valid landing destinations now (was: only `/dashboard`, `/onboarding`, `/account`, `/report`).

### Spec compliance review
PASS — every acceptance criterion across all 6 tasks verified.

### Code quality review
APPROVED_WITH_NITS. Three nits flagged; one addressed (DRY refactor below), two left as-is:
- ✅ Three-page link-construction duplication → extracted `authLinkWithRedirect()` helper into `lib/auth/safe-redirect.ts`. Call sites collapsed to one line each.
- Left as-is: `hasRedirect` check couples to `target !== SIGNUP_FALLBACK` (harmless — a user wanting `/dashboard` as their explicit redirect lands on `/dashboard` either way).
- Left as-is: inline `style={{marginTop: 8}}` in `email-confirmed/page.tsx` — pre-existing, trivial.

### Security
- Open-redirect vector closed at every hop (form → action → callback → email-confirmed page).
- CRLF / control characters rejected by `safeRedirect()`.
- Recovery-flow attacker-supplied `next` cannot redirect a user away from `/reset-password`.
- No PII in any new console output (`console.warn` on recovery contains no email/token).
- Verify-email page reflects `email` only inside `<strong>` (auto-escaped by React) and `redirect` only after passing through `safeRedirect()` + `encodeURIComponent()`.

### Deferred items
None.

### Known limitations
- Local browser verification of the full flow requires Supabase env vars (proxy short-circuits when unconfigured). Will verify cross-form link forwarding + hidden field locally; full email-verify bounce verified on Vercel preview.

## Verdict

APPROVED — proceed to browser verification → push → merge.
