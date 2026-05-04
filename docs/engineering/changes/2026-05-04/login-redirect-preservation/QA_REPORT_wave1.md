# QA Report: Login redirect preservation — Wave 1

Date: 2026-05-04
Reviewer: dev-loop QA pass

## Build status

- `pnpm build`: PASS — clean, all routes still listed (only pre-existing turbopack-root warning)
- `pnpm test`: PASS — **679 passed, 4 skipped (683 total), 0 failed** across 88 test files (2 skipped suites)
- `pnpm test tests/unit/auth/`: PASS — 36 / 36 (27 safe-redirect + 9 sign-in-redirect)

## Test results

| Suite | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| `tests/unit/auth/safe-redirect.test.ts` | 27 | 27 | 0 | 0 |
| `tests/unit/auth/sign-in-redirect.test.ts` | 9 | 9 | 0 | 0 |
| Full project suite | 683 | 679 | 0 | 4 |

The 4 skipped tests are pre-existing (vo2max v1.1 stale fixtures + 2 review-pack integration tests) and unrelated to this change.

## Findings

### Confirmed working
- `safeRedirect()` rejects open-redirect (`//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:`), control characters (CRLF, LF, tab, DEL `\x7f`, NUL `\x00`), and the auth-route block-list (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/callback`).
- Proxy now lists `/insights`, `/journal`, `/care-team`, `/alerts`, `/routines` in `PROTECTED_PREFIXES` so unauthenticated visitors get `?redirect=<path>` attached to the bounce.
- Proxy sets `x-pathname` request header on every authenticated request, forwarded to server components per the documented Next 16 pattern (`NextResponse.next({ request: { headers: requestHeaders } })`).
- `app/(app)/layout.tsx` reads `x-pathname` and constructs `/login?redirect=<encoded>` as a defence-in-depth fallback; falls back to bare `/login` when header missing or malformed.
- `LoginForm` emits a hidden `redirect` input populated from `useSearchParams()`.
- `signIn()` honours the form's `redirect` value via `safeRedirect()`, falling back to `/dashboard` on missing or unsafe input.
- Existing `signIn()` error paths (email echo, error message return) unchanged.

### Spec compliance review
PASS (full granular walkthrough in subagent report). Every acceptance criterion in PLAN.md tasks 1.1–1.5 verified. Two minor extras (additional safeRedirect test cases beyond required, defensive `next/headers` mock in sign-in test) — additions, not deviations.

### Code quality review
APPROVED_WITH_NITS. Findings addressed:
- ✅ Test file now uses explicit `\x7f` and `\x00` JS escape sequences (was already correct in bytes; explicit form is more durable against future editors).
- ✅ Comment added in proxy.ts noting `set()` overrides any browser-supplied `x-pathname`.

Findings deferred (out of scope, low value):
- DRY of `isSafeInternalPath` (layout) into shared helper — different policy from `safeRedirect` (no auth-loop list, no fallback), justifiable as separate.
- `loginUrl.searchParams.set(...)` idiomatic refactor of pre-existing proxy code — not in scope.
- Pre-existing `createAdminClient()` use in `app/(app)/layout.tsx` — flagged for follow-up but predates this PR.

### Deferred items
None for this change. `signUp()` `emailRedirectTo` callback still hard-coded to `?next=/dashboard` — explicitly out of scope per PLAN.md, deferred to a follow-up.

### Known limitations
- Browser must be JavaScript-enabled for the hidden `redirect` field to populate from `useSearchParams()`. If JS is disabled, `redirect` will be empty string and `safeRedirect()` falls back to `/dashboard` — same as current production behaviour, no regression.
- The `(app)/layout.tsx` fallback only fires for routes that actually mount the `(app)` layout. Non-app guarded routes that aren't in `PROTECTED_PREFIXES` would still be missed — but the additions in this PR cover all 5 routes the bug specifically called out.

## Verdict

APPROVED — proceed to browser verification → push → merge.
