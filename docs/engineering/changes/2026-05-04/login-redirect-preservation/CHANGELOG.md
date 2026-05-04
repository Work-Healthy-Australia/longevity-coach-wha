# Changelog: Login redirect preservation across guarded routes

Date: 2026-05-04
Phase: Phase 1 — Foundation (v1.1 backlog)
PR: [apps#131](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/131)
Bugs closed: BUG-018, BUG-024

## What was built

- `safeRedirect()` helper at `lib/auth/safe-redirect.ts` — a same-origin redirect-target validator that rejects open-redirect attempts (`//evil.com`, `/\evil.com`, absolute URLs, `javascript:` schemes), control characters (CRLF / LF / tab / DEL / NUL — defends against header injection), and auth-route loops (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/callback`).
- `signIn()` server action now honours a `redirect` form field via `safeRedirect()`, falling back to `/dashboard` on missing or unsafe values.
- `LoginForm` emits a hidden `redirect` input populated from `useSearchParams()`.
- Proxy `PROTECTED_PREFIXES` extended to include `/insights`, `/journal`, `/care-team`, `/alerts`, `/routines` — these were silently bypassing the proxy guard before.
- Proxy now sets `x-pathname` request header on every request (per the documented Next 16 pattern: `NextResponse.next({ request: { headers: requestHeaders } })`) so server components can read the original URL.
- `(app)/layout.tsx` reads `x-pathname` and falls back to `/login?redirect=<encoded>` if the proxy guard ever misses a route — defence in depth.
- 36 new unit tests: 27 for `safeRedirect()`, 9 for the `signIn()` redirect-resolution flow.

## What changed

| File | Change |
|---|---|
| `lib/auth/safe-redirect.ts` | New file — pure helper |
| `lib/supabase/proxy.ts` | +5 prefixes, set `x-pathname` header per Next 16 pattern |
| `app/(app)/layout.tsx` | Inline `isSafeInternalPath` + `?redirect=` fallback when bouncing unauthenticated users |
| `app/(auth)/login/login-form.tsx` | Hidden `redirect` input from `useSearchParams()` |
| `app/(auth)/actions.ts` | `signIn()` reads form `redirect`, gates through `safeRedirect()` |
| `tests/unit/auth/safe-redirect.test.ts` | New file — 27 cases |
| `tests/unit/auth/sign-in-redirect.test.ts` | New file — 9 cases |

## Migrations applied

None. Pure code-path change.

## Deviations from plan

None. All 5 tasks delivered as specified in the rev-2 plan. Two minor extras during implementation:
- Test file uses explicit `\x7f` and `\x00` JS escapes (not literal bytes) — applied during code-quality review for editor durability.
- Defensive `next/headers` mock added to `sign-in-redirect.test.ts` — `signIn` doesn't call `headers()`, but the mock prevents accidental coupling if the action grows in future.

## Known gaps / deferred items

- `signUp()` `emailRedirectTo` is still hard-coded to `?next=/dashboard`. Closing this requires capturing the user's intent across the email-verify hop. Deferred — open a follow-up issue when needed.
- Redundant page-level `redirect("/login")` calls in (app) child pages were left in place. Harmless given the layout now preserves the path, but a future cleanup PR should remove them.
- Local browser verification of the `/insights` → `/login?redirect=/insights` bounce was not possible without local Supabase env vars (proxy short-circuits when unconfigured). Vercel preview will exercise the live flow.
