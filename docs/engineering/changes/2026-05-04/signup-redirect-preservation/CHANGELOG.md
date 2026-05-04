# Changelog: Signup + email-verify redirect preservation

Date: 2026-05-04
Phase: Phase 1 — Foundation (v1.1 backlog)
PR: [apps#133](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/133)
Builds on: PR [#131](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/131)

## What was built

- `authLinkWithRedirect()` helper added to `lib/auth/safe-redirect.ts` — builds cross-form auth links that forward `?redirect=` when the value is safe and silently drop the param otherwise. Eliminates 3-place duplication across `/login`, `/signup`, `/verify-email` pages.
- Signup form (`app/(auth)/signup/signup-form.tsx`) now reads `?redirect=` via `useSearchParams()` and emits a hidden `redirect` input — same pattern as the login form.
- `signUp()` server action validates the form's `redirect` value via `safeRedirect()`, embeds it in the `emailRedirectTo` `?next=` parameter sent to Supabase, and forwards it to `/verify-email?redirect=` (only when the user supplied a real, safe target — fallback values are dropped to keep the URL clean).
- `/auth/callback` now validates `next` via `safeRedirect()` for non-recovery flows. Recovery flows are explicitly hard-coded to `/reset-password` (the `safeRedirect` block-list rejects `/reset-password` as an auth-route loop, so this dedicated bypass is required). Defensive `console.warn` if a recovery flow ever arrives with an unexpected `next` — catches future bugs.
- `/email-confirmed` page replaces the closed `ALLOWED_NEXT` 4-route allowlist (`/dashboard`, `/onboarding`, `/account`, `/report`) with `safeRedirect()` — any safe internal path is now a valid landing target.
- 23 new unit tests across 3 files (sign-up-redirect, auth-callback-next, email-confirmed-page) including recovery-hijack and open-redirect cases at every hop.
- Suspense wrap added to `app/(auth)/signup/page.tsx` (mandatory for `useSearchParams()` to compile under Next 16).

## What changed

| File | Change |
|---|---|
| `lib/auth/safe-redirect.ts` | +`authLinkWithRedirect()` helper |
| `app/(auth)/login/page.tsx` | Async server component, forwards `?redirect=` to "Create one" link |
| `app/(auth)/signup/page.tsx` | Async server component + Suspense wrap, forwards `?redirect=` to "Sign in" link |
| `app/(auth)/signup/signup-form.tsx` | `useSearchParams()` + hidden `redirect` input |
| `app/(auth)/verify-email/page.tsx` | Async server component, forwards `?redirect=` to "Sign up again" link |
| `app/(auth)/actions.ts` | `signUp()` honours `redirect` form field via `safeRedirect()`; new `SIGNUP_FALLBACK` constant |
| `app/auth/callback/route.ts` | `next` validated via `safeRedirect()`; recovery flow hard-coded to `/reset-password` with defensive warn |
| `app/(auth)/email-confirmed/page.tsx` | `safeRedirect()` replaces local closed allowlist |
| `tests/unit/auth/sign-up-redirect.test.ts` | New — 7 cases |
| `tests/unit/auth/auth-callback-next.test.ts` | New — 12 cases |
| `tests/unit/auth/email-confirmed-page.test.ts` | New — 4 cases |

## Migrations applied

None. Pure auth-flow change.

## Deviations from plan

None. All 6 tasks delivered as specified in the rev-2 plan. One post-implementation refactor: the inline link-construction in 3 pages was extracted to `authLinkWithRedirect()` per code-quality reviewer's NIT, collapsing each call site to a single line.

## Known gaps / deferred items

- Cross-form link rendering tests deferred to manual browser QA (per plan rev 2 scope decision); verified locally for all three pages.
- Local browser verification of the end-to-end email-verify bounce (callback → email-confirmed) requires Supabase env vars; covered by 12 unit tests for the callback handler and proven on Vercel preview after merge.
- Removing redundant page-level `redirect("/login")` calls in (app) child pages — left in place; harmless follow-up cleanup.
