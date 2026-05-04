# Plan: Login redirect preservation across guarded routes

Date: 2026-05-04
Phase: Phase 1 — Foundation (v1.1 backlog item)
Status: Reviewed (rev 2)

## Objective

Fix two related auth-flow defects so a user who tries to open a protected page while signed-out lands on the page they wanted after sign-in, not on `/dashboard`.

- **BUG-018** — `signIn()` server action hard-codes `redirect("/dashboard")`, throwing away the `?redirect=...` query param the proxy attaches.
- **BUG-024** — `lib/supabase/proxy.ts` `PROTECTED_PREFIXES` is missing `/insights`, `/journal`, `/care-team`, `/alerts`, `/routines`. These routes fall through the proxy and rely on `app/(app)/layout.tsx`'s bare `redirect("/login")`, which has no `?redirect=` param.

Done = a signed-out user opening any guarded route is bounced to `/login?redirect=<path>`, signs in, and lands on `<path>`. Open-redirect vector closed by a same-origin allowlist with control-char stripping.

## Scope

**In scope:**
- `lib/supabase/proxy.ts` — add the 5 missing prefixes to `PROTECTED_PREFIXES` AND set `x-pathname` request header so the layout has a guaranteed source of the original path
- `app/(app)/layout.tsx` — preserve current path when redirecting (defence-in-depth, reads `x-pathname` set by the proxy)
- `app/(auth)/actions.ts` — `signIn()` honours redirect target from hidden form field
- `app/(auth)/login/login-form.tsx` — emit hidden `redirect` input populated from `useSearchParams`
- `lib/auth/safe-redirect.ts` — new helper: validate that a redirect target is a same-origin internal path
- Tests: unit tests for `safeRedirect()` helper + integration-style test for `signIn()` redirect resolution

**Out of scope:**
- `signUp()` — `emailRedirectTo` callback is hard-coded to `?next=/dashboard`. Closing this gap requires capturing the user's intent before they verify their email; deferred to a follow-up
- Removing the redundant page-level `if (!user) redirect("/login")` in `(app)` child pages — they're harmless once the layout guard handles preservation, and removing them is a separate cleanup
- `(admin)/layout.tsx` — admin routes are already in `PROTECTED_PREFIXES` so the proxy handles them
- Server actions in `app/(app)/.../actions.ts` that call `redirect("/login")` — last-resort guards only reachable if the proxy & layout both miss; they fail safely

## Data model changes

None. Pure code-path change.

## Waves

### Wave 1 — Login redirect preservation (single wave)

**What James can see after this wave merges:** Open `/insights` (or any guarded route) while signed out → bounced to `/login?redirect=/insights` → sign in → land on `/insights`. Same for all other guarded routes. Pasting `/login?redirect=https://evil.com` or `/login?redirect=//evil.com` into the URL bar still lands on `/dashboard` after sign-in (open-redirect blocked). Header-injection attempts via `\r\n` in the redirect param are also blocked.

#### Task 1.1 — Add safe-redirect helper

Files affected:
- `lib/auth/safe-redirect.ts` (new)
- `tests/unit/auth/safe-redirect.test.ts` (new)

What to build:
- Export `safeRedirect(target: string | null | undefined, fallback: string = "/dashboard"): string`
- Returns `target` only if all of:
  - is a non-empty string
  - starts with exactly one `/` (rejects `//evil.com` and `/\evil.com` protocol-relative variants)
  - second character is not `\` (rejects `/\evil.com`)
  - contains no ASCII control characters (charCode < 0x20 OR charCode === 0x7F) — defends against CRLF / header injection
  - the **path portion** (everything before `?` or `#`) is not in the auth-route block-list. Block-list (don't loop the user back to auth pages):
    - `/login`
    - `/signup`
    - `/forgot-password`
    - `/reset-password`
    - `/verify-email`
    - `/auth/callback`
- Otherwise returns `fallback`
- Pure function, no I/O, no async

Acceptance criteria (test cases):
- Valid passes:
  - `safeRedirect("/dashboard")` → `"/dashboard"`
  - `safeRedirect("/insights?tab=heart")` → `"/insights?tab=heart"`
  - `safeRedirect("/care-team#booking")` → `"/care-team#booking"`
- Invalid → fallback:
  - `safeRedirect("//evil.com")` → `"/dashboard"`
  - `safeRedirect("/\\evil.com")` → `"/dashboard"`
  - `safeRedirect("https://evil.com")` → `"/dashboard"`
  - `safeRedirect("javascript:alert(1)")` → `"/dashboard"`
  - `safeRedirect("")` → `"/dashboard"`
  - `safeRedirect(null)` → `"/dashboard"`
  - `safeRedirect(undefined)` → `"/dashboard"`
  - `safeRedirect("dashboard")` (no leading slash) → `"/dashboard"`
- Auth-loop blocked:
  - `safeRedirect("/login")` → `"/dashboard"`
  - `safeRedirect("/login?next=/foo")` → `"/dashboard"` (path portion = `/login`)
  - `safeRedirect("/signup")` → `"/dashboard"`
  - `safeRedirect("/forgot-password")` → `"/dashboard"`
  - `safeRedirect("/reset-password")` → `"/dashboard"`
  - `safeRedirect("/verify-email")` → `"/dashboard"`
  - `safeRedirect("/auth/callback?code=x")` → `"/dashboard"`
- Control chars rejected:
  - `safeRedirect("/insights\r\nSet-Cookie: x=y")` → `"/dashboard"`
  - `safeRedirect("/insights\n")` → `"/dashboard"`
  - `safeRedirect("/insights\t")` → `"/dashboard"`
- Custom fallback honoured:
  - `safeRedirect(null, "/onboarding")` → `"/onboarding"`
- Test file follows the vitest style of `tests/unit/profiles/pii-split.test.ts`

Rules to apply:
- `.claude/rules/security.md` (input validation at server boundary)
- `.claude/rules/nextjs-conventions.md` (file naming)

#### Task 1.2 — Add missing prefixes to proxy guard + set `x-pathname` header

Files affected:
- `lib/supabase/proxy.ts`

What to build:

Part A — additions to `PROTECTED_PREFIXES`:
- Verified to exist as routes: `/insights`, `/journal`, `/care-team`, `/alerts`, `/routines`
- Add all 5. Note: `/org` is already in the list — do NOT re-add.

Part B — set `x-pathname` request header on every request so the `(app)` layout has a reliable source of the original path:
- Inside `updateSession`, after computing `const { pathname, search } = request.nextUrl;`, set `request.headers.set("x-pathname", pathname + search)` BEFORE the early returns so it's set on all paths including the ones that fall through to the response.
- The `request` is then passed to `NextResponse.next({ request })` calls — Next 16 forwards modified request headers to server components automatically when you re-construct the response from the modified request. (Confirm against `node_modules/next/dist/docs/` for the Next 16 pattern before implementing — this is the project convention per `AGENTS.md`.)
- The early-return `NextResponse.next({ request })` at the very top (no env vars) does NOT need the header; if Supabase isn't configured, the layout won't run anyway.

Acceptance criteria:
- All 5 new prefixes appear in `PROTECTED_PREFIXES`. `/org` not duplicated.
- `x-pathname` header is set on the request for every path that reaches the auth/role logic
- File still compiles; `pnpm build` passes
- Manual sanity check (after merge): `/insights` while signed out → URL becomes `/login?redirect=%2Finsights`

#### Task 1.3 — Preserve path in (app) layout guard (defence-in-depth)

Files affected:
- `app/(app)/layout.tsx`

What to build:
- Read `headers().get("x-pathname")` (set by the proxy in Task 1.2)
- If the header is present AND the value passes a strict same-origin check (starts with `/`, second char not `\`, no control chars), redirect to `/login?redirect=<encodeURIComponent(pathname)>`
- Otherwise fall back to bare `redirect("/login")` — never use `safeRedirect`'s `/dashboard` default here, and never construct a redirect from referer
- Inline the validation (don't import `safeRedirect` because the auth-loop block-list is irrelevant here — we're only guarding against header tampering); 4–5 lines is fine

Acceptance criteria:
- Layout still redirects unauthenticated users to `/login`
- When `x-pathname` is set and passes validation: redirect URL is `/login?redirect=<encoded path>`
- When `x-pathname` is missing or fails validation: bare `redirect("/login")` (no crash, no `/dashboard`)
- `pnpm build` passes

Rules to apply:
- `AGENTS.md` (read Next 16 docs before writing Next 16 code — specifically `headers()` semantics in server components)
- `.claude/rules/nextjs-conventions.md`

#### Task 1.4 — Pass redirect target through login form

Files affected:
- `app/(auth)/login/login-form.tsx`
- `app/(auth)/actions.ts` (`signIn()` only — leave `signUp`, `signOut`, `requestPasswordReset`, `updatePassword` alone)

What to build:

In `login-form.tsx`:
- Read `redirect` from `useSearchParams()`
- Render a hidden `<input type="hidden" name="redirect" value={redirectParam ?? ""} />` inside the form
- No other UI change

In `actions.ts` `signIn()`:
- Read `formData.get("redirect")` as `string | null`
- After successful auth, compute `target = safeRedirect(redirectParam, "/dashboard")`
- `redirect(target)` instead of the current `redirect("/dashboard")`
- All existing error paths unchanged (echoes email back, etc.)
- `revalidatePath("/", "layout")` still called before redirect

Acceptance criteria:
- Hidden field present in rendered form (verify by reading rendered HTML or reading source)
- `signIn()` honours `redirect` form value when valid
- `signIn()` falls back to `/dashboard` when `redirect` is missing or unsafe
- Existing error-path behaviour unchanged (email echo, error messages)
- `pnpm build` passes

Rules to apply:
- `.claude/rules/nextjs-conventions.md` (server actions, useActionState)
- `.claude/rules/security.md`

#### Task 1.5 — Tests for signIn redirect resolution

Files affected:
- `tests/unit/auth/sign-in-redirect.test.ts` (new)

What to build:

Mock setup:
- `vi.mock("next/navigation", () => ({ redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }) }))` — must throw to match production behaviour where `redirect()` throws `NEXT_REDIRECT` and stops control flow. Test uses `expect(...).rejects.toThrow("NEXT_REDIRECT:/insights")` to assert the captured target.
- `vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))`
- `vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))` — return a stub that exposes `auth.signInWithPassword(...)`, configured per test
- See `tests/unit/account/security-actions.test.ts` for the established mocking pattern

Test cases:
- Auth success + valid redirect → throws `NEXT_REDIRECT:/insights`
- Auth success + valid redirect with query → throws `NEXT_REDIRECT:/insights?tab=heart`
- Auth success + open-redirect attempt (`//evil.com`) → throws `NEXT_REDIRECT:/dashboard`
- Auth success + missing redirect → throws `NEXT_REDIRECT:/dashboard`
- Auth success + empty-string redirect → throws `NEXT_REDIRECT:/dashboard`
- Auth success + redirect = `/login` (loop) → throws `NEXT_REDIRECT:/dashboard`
- Auth error from Supabase → returns `{ error, values: { email } }`, `redirect` mock NOT called
- Missing email → returns `{ error: "Email and password are required.", values: { email: "" } }`, `signInWithPassword` NOT called, `redirect` NOT called
- Missing password → same as above

Acceptance criteria:
- All 9 cases pass
- Tests follow the vitest patterns in `tests/unit/account/security-actions.test.ts`
- `pnpm test` passes the full suite (no regressions in other tests)
