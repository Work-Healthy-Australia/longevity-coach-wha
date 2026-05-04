# Plan: Signup + email-verify redirect preservation

Date: 2026-05-04
Phase: Phase 1 — Foundation (v1.1 backlog, follow-up to PR #131)
Status: Reviewed (rev 2)

## Objective

Carry the user's original `?redirect=` destination through every step of the new-account flow so that a signed-out user who tries to open `/insights`, clicks "Create account", verifies their email, and signs in lands on `/insights` — not `/dashboard`.

Done = the `?redirect=` query param survives:
1. `/login` ↔ `/signup` (cross-form link)
2. `/signup` → `/verify-email` (cross-form link via "Sign up again")
3. Signup form → `signUp()` server action (hidden field)
4. `signUp()` → email verification link (`emailRedirectTo` `?next=`)
5. `/auth/callback` → `/email-confirmed?next=` → final destination

All redirect targets are validated by the existing `safeRedirect()` from PR #131 — no new helper.

## Scope

**In scope:**
- `app/(auth)/signup/page.tsx` — wrap `<SignupForm />` in `<Suspense fallback={null}>` (mandatory for `useSearchParams()`); forward `?redirect=` to "Sign in" cross-form link
- `app/(auth)/login/page.tsx` — forward `?redirect=` to "Create one" cross-form link
- `app/(auth)/verify-email/page.tsx` — forward `?redirect=` to "Sign up again" cross-form link
- `app/(auth)/signup/signup-form.tsx` — read `?redirect=` via `useSearchParams()`, emit hidden `redirect` input
- `app/(auth)/actions.ts` — `signUp()` reads form `redirect`, validates with `safeRedirect`, embeds in `emailRedirectTo`'s `?next=`; forwards through to `/verify-email?email=…&redirect=…`
- `app/auth/callback/route.ts` — `next` query param validated through `safeRedirect()`; **recovery flow preserved** (see Task 1.4)
- `app/(auth)/email-confirmed/page.tsx` — replace closed `safeNext()` allowlist with `safeRedirect()`
- Tests:
  - Unit: `signUp()` redirect resolution
  - Unit: `/auth/callback` `next`-param handling — token_hash, code, AND recovery branches
  - Unit: `/email-confirmed` page server-component output for the four behavioural cases

**Out of scope:**
- `requestPasswordReset()` `redirectTo` — already correct (`?next=/reset-password`); leave alone
- Restructuring the email-confirmed intermediary — keep the soft-landing page, just open up the next-target via `safeRedirect`
- Cross-form link rendering tests — covered by manual QA in browser verification step
- Server-side rendering of redirect param into Supabase email body — `emailRedirectTo` only changes the link target, not the email copy

## Data model changes

None. Pure auth-flow change. Redirect param holds a URL path only (no PII).

## Waves

### Wave 1 — End-to-end signup redirect preservation (single wave)

**What James can see after this wave merges:**
- Open `/insights` while signed out → bounced to `/login?redirect=/insights`
- Click "Create one" → `/signup?redirect=/insights`
- Submit form → email arrives with link to `/auth/callback?token_hash=…&type=signup&next=/insights`
- Click email link → `/email-confirmed?next=/insights` → click Continue → land on `/insights`
- Same flow but with `?redirect=//evil.com` at any hop → safely resolves to `/dashboard`
- Password reset flow still works: request reset → email link → land on `/reset-password`

#### Task 1.1 — Cross-form link forwarding + Suspense wrap

Files affected:
- `app/(auth)/login/page.tsx`
- `app/(auth)/signup/page.tsx`
- `app/(auth)/verify-email/page.tsx`

What to build:

For each page:
- Convert to async server component using Next 16 `searchParams: Promise<{ redirect?: string }>` API.
- Read the incoming `redirect` param, validate via `safeRedirect()` (use a custom fallback like `""` so unsafe inputs are silently dropped — we don't want to embed `/dashboard` in a cross-form link, just omit the param).
- Construct the cross-form `<a href>` with `?redirect=<encoded>` only when `safeRedirect` returned a non-empty value.
- Encode via `encodeURIComponent()`.

Additionally, in `app/(auth)/signup/page.tsx` only:
- **MANDATORY** — wrap `<SignupForm />` in `<Suspense fallback={null}>`, mirroring `app/(auth)/login/page.tsx`. Required for `useSearchParams()` in the signup form (Task 1.2) to compile under Next 16.
- Add `import { Suspense } from "react"` to the page.

Acceptance criteria:
- `/login?redirect=/insights` → cross-form link is `<a href="/signup?redirect=%2Finsights">`
- `/login?redirect=//evil.com` → cross-form link is `<a href="/signup">` (param dropped)
- `/login` → cross-form link is `<a href="/signup">`
- Same three-case mirror for `/signup` → `/login` and `/verify-email` → `/signup`
- `app/(auth)/signup/page.tsx` wraps `<SignupForm />` in `<Suspense fallback={null}>`
- `pnpm build` passes

Rules to apply:
- `.claude/rules/security.md` (validate user input — same-origin allowlist via `safeRedirect`)
- `.claude/rules/nextjs-conventions.md` (Next 16 `searchParams: Promise<…>` API)
- `AGENTS.md`

#### Task 1.2 — Signup form hidden field

Files affected:
- `app/(auth)/signup/signup-form.tsx`

What to build:
- Read `redirect` from `useSearchParams()`
- Emit `<input type="hidden" name="redirect" value={redirectParam ?? ""} />` inside the `<form>`
- No other UI change

Acceptance criteria:
- Form renders the hidden input with value populated from search params
- `pnpm build` passes (Suspense wrap from Task 1.1 must be in place first)

Rules to apply:
- `.claude/rules/nextjs-conventions.md`

#### Task 1.3 — `signUp()` honours redirect param

Files affected:
- `app/(auth)/actions.ts`

What to build:
- Add a module-level constant `const SIGNUP_FALLBACK = "/dashboard";` to avoid coupling the noise-suppression check to a literal default
- `signUp()` reads `formData.get("redirect")` as `string | null`
- Compute `target = safeRedirect(redirectParam, SIGNUP_FALLBACK)`
- Compute `hasRedirect = typeof redirectParam === "string" && redirectParam.length > 0 && target !== SIGNUP_FALLBACK` — only true when the user supplied a real redirect AND it survived validation
- `emailRedirectTo: ${origin}/auth/callback?next=${encodeURIComponent(target)}`
- Build verify-email URL: `/verify-email?email=${encodeURIComponent(email)}` plus `&redirect=${encodeURIComponent(target)}` IFF `hasRedirect`
- `redirect(verifyEmailUrl)` — preserves the intermediate page's awareness of where the user was originally heading
- Leave `signOut`, `requestPasswordReset`, `updatePassword` alone

Acceptance criteria:
- `signUp()` reads redirect form value, validates, embeds in email link via `?next=`
- Verify-email URL carries `&redirect=` only when user supplied a real, safe target
- Existing error paths (echo email/full_name, return error) unchanged
- `pnpm build` passes

Rules to apply:
- `.claude/rules/security.md`
- `.claude/rules/nextjs-conventions.md`

#### Task 1.4 — `/auth/callback` validates `next` via `safeRedirect()` AND preserves recovery flow

Files affected:
- `app/auth/callback/route.ts`

What to build:
- Replace `const next = url.searchParams.get("next") ?? "/dashboard";` with:
  - `const rawNext = url.searchParams.get("next");`
  - `const next = type === "recovery" ? (rawNext ?? "/reset-password") : safeRedirect(rawNext);`
- Why: recovery (password reset) flows MUST land on `/reset-password`. The `safeRedirect()` block-list rejects `/reset-password` as an auth-loop. Bypass `safeRedirect()` for the recovery type and pass the bare `next` (the only writer of the recovery `redirectTo` is `requestPasswordReset()` in `app/(auth)/actions.ts`, which hard-codes `?next=/reset-password` — not user-controllable, so safe to trust).
- Defensive: if `type === "recovery"` and `rawNext` is anything other than `/reset-password`, log a warning (`console.warn`) and force `next = "/reset-password"`. This catches future bugs where someone tries to repurpose the recovery callback.
- The `type === "signup"` branch that adds `&next=…` to `/email-confirmed` continues to forward the validated `next` value
- The bare-fallback redirect at the bottom uses `next` directly (already a safe value at this point)

Acceptance criteria:
- Recovery flow: `?token_hash=…&type=recovery&next=/reset-password` → 307 to `/reset-password` (unchanged from current behaviour)
- Recovery flow with missing next: `?token_hash=…&type=recovery` → 307 to `/reset-password` (defensive default)
- Recovery flow with attacker-supplied next: `?token_hash=…&type=recovery&next=/insights` → console.warn + 307 to `/reset-password` (defensive override)
- Signup with next=/insights → 307 to `/email-confirmed?next=%2Finsights`
- Signup with next=//evil.com → 307 to `/email-confirmed?next=%2Fdashboard`
- Email confirmation (type=email) with next=/insights → 307 to `/insights`
- Email confirmation with next=//evil.com → 307 to `/dashboard`
- Code path with valid next → 307 to `/<next>`
- All error paths still 307 to `/login?error=auth_callback_failed`
- `pnpm build` passes

Rules to apply:
- `.claude/rules/security.md`

#### Task 1.5 — `/email-confirmed` uses `safeRedirect()` instead of closed allowlist

Files affected:
- `app/(auth)/email-confirmed/page.tsx`

What to build:
- Delete the local `ALLOWED_NEXT` array and `safeNext()` helper
- Replace with `import { safeRedirect } from "@/lib/auth/safe-redirect"` and `const continueUrl = safeRedirect(next);`
- Page text and styling unchanged

Acceptance criteria:
- `/email-confirmed?next=/insights` renders Continue link to `/insights`
- `/email-confirmed?next=//evil.com` renders Continue link to `/dashboard`
- `/email-confirmed?next=/login` renders Continue link to `/dashboard` (auth-loop blocked by `safeRedirect`)
- `/email-confirmed` (no param) renders Continue link to `/dashboard`

Rules to apply:
- `.claude/rules/security.md` (centralise validation in one helper)

#### Task 1.6 — Tests

Files affected:
- `tests/unit/auth/sign-up-redirect.test.ts` (new)
- `tests/unit/auth/auth-callback-next.test.ts` (new)
- `tests/unit/auth/email-confirmed-page.test.ts` (new)

What to build:

**`sign-up-redirect.test.ts`** — mirrors `tests/unit/auth/sign-in-redirect.test.ts` pattern with `vi.hoisted` for mock factories.

Mocks:
- `next/navigation` `redirect` → throws `NEXT_REDIRECT:<url>`
- `next/cache` `revalidatePath` → no-op
- `next/headers` `headers` → returns `{ get(key) }` with `host: "example.com"`, `x-forwarded-proto: "https"`, else null
- `@/lib/supabase/server` `createClient` → stub with `auth.signUp = vi.fn().mockResolvedValue({ error: null })`

Cases:
1. Auth success + valid redirect=/insights → throws `NEXT_REDIRECT:/verify-email?email=u%40x.com&redirect=%2Finsights`; assert `signUp` mock was called with `emailRedirectTo: https://example.com/auth/callback?next=%2Finsights`
2. Auth success + redirect=//evil.com → throws `NEXT_REDIRECT:/verify-email?email=u%40x.com` (no `&redirect=`); `emailRedirectTo: https://example.com/auth/callback?next=%2Fdashboard`
3. Auth success + missing redirect → throws `NEXT_REDIRECT:/verify-email?email=u%40x.com`
4. Auth success + redirect=/login (loop) → throws `NEXT_REDIRECT:/verify-email?email=u%40x.com` (sanitised away)
5. Auth error from Supabase → returns `{ error, values: { email, full_name } }`, `redirect` mock NOT called
6. Missing email → returns `{ error: "Email and password are required.", values }`, no auth call, no redirect
7. Password too short (<8 chars) → returns "Password must be at least 8 characters." error, no auth call, no redirect

**`auth-callback-next.test.ts`** — covers the GET handler.

Mocks:
- `@/lib/supabase/server` `createClient` → stub returning `auth.verifyOtp`, `auth.exchangeCodeForSession`, `auth.getUser` (default: returns `data: { user: null }` so welcome-email logic skipped)
- `@/lib/email/welcome` `sendWelcomeEmail` → no-op vi.fn (must mock to avoid network call)

Helper:
- `function buildRequest(qs: string): NextRequest` — `new NextRequest(`http://localhost/auth/callback?${qs}`)`

Cases:
1. token_hash + type=email + valid next=/insights → 307, Location ends `/insights`
2. token_hash + type=signup + valid next=/insights → 307, Location ends `/email-confirmed?next=%2Finsights`
3. token_hash + type=signup + missing next → 307, Location ends `/email-confirmed?next=%2Fdashboard`
4. token_hash + type=email + open-redirect attempt next=//evil.com → 307, Location ends `/dashboard`
5. token_hash + type=signup + open-redirect attempt next=//evil.com → 307, Location ends `/email-confirmed?next=%2Fdashboard`
6. token_hash + type=recovery + next=/reset-password → 307, Location ends `/reset-password`
7. token_hash + type=recovery + missing next → 307, Location ends `/reset-password` (defensive default)
8. token_hash + type=recovery + attacker next=/insights → 307, Location ends `/reset-password` (defensive override; assert `console.warn` called once)
9. code path + valid next=/insights → 307, Location ends `/insights`
10. verifyOtp returns error → 307 to `/login?error=auth_callback_failed`
11. exchangeCodeForSession returns error → 307 to `/login?error=auth_callback_failed`
12. neither token_hash nor code → 307 to `/login?error=auth_callback_failed`

**`email-confirmed-page.test.ts`** — server-component snapshot of the Continue link href.

Mocks: none required (page is pure server component with no I/O).

Approach: import `EmailConfirmedPage` and call it as an async function with stubbed `searchParams`. Render to string via `renderToStaticMarkup` from `react-dom/server` and extract the Continue href via regex, OR use `@testing-library/react` `render` (already in devDeps per existing code).

Cases:
1. `next=/insights` → Continue href = `/insights`
2. `next=//evil.com` → Continue href = `/dashboard`
3. `next=/login` → Continue href = `/dashboard` (auth-loop blocked)
4. no `next` param → Continue href = `/dashboard`

Acceptance criteria:
- All cases pass
- Tests follow vitest patterns from existing `tests/unit/auth/sign-in-redirect.test.ts`
- `pnpm test` full suite passes (no regressions)

Rules to apply:
- `.claude/rules/nextjs-conventions.md`
