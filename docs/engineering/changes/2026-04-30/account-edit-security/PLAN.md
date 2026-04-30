# Plan: Account edit + security feature
Date: 2026-04-30
Phase: Platform UX (sits alongside Phase 2 — Intelligence; does not advance a Phase 2 epic, but unblocks self-service support load)
Status: Draft
Branch: `feat/account-page-updates`
Scope position: Scope 1 of 2 (Scope 2 = `feat/account-polish`, planned separately later)

## Objective

Let signed-in members self-serve their identity and credentials from `/account` instead of routing through support or the password-reset email flow. After this lands, members can: (1) edit name, date of birth, phone, and postal address inline on the Identity card, (2) change their password without leaving the app, (3) initiate an email-change with verification, and (4) sign out from the Account page. The nav-level sign-out is removed to keep the navigation cluster focused on destinations rather than account actions.

Done looks like:
- Identity card has Edit / Save / Cancel; phone + postal are visible (currently invisible despite being stored).
- A new Security card on `/account` exposes password change, email change, and sign-out.
- AppHeader and MobileNav no longer contain a Sign-out button.
- All form mutations validate server-side via Zod, return `{error?, success?, values?}`, and use `revalidatePath`.
- `pnpm build` clean, `pnpm test` green.

## Scope

**In scope**
- Server actions: `updateIdentity`, `changePassword`, `changeEmail` (account-scoped — never redirect away from `/account`).
- Identity card editable form (read ↔ edit toggle, repopulating values on validation error).
- Security card: password change, email change, sign-out — all in one card.
- Removal of sign-out from `AppHeader` (desktop) and `MobileNav` (mobile drawer), plus their CSS rules and the `signOutAction` prop wiring in `app/(app)/layout.tsx`.
- Unit tests for the validation logic on each new server action.

**Out of scope (deferred to Scope 2 branch `feat/account-polish`)**
- Card grouping / IA reorder
- NotificationPrefs CSS migration off inline styles
- Type regeneration (existing `as any` casts stay)
- Pause-banner / pause-card UX dedup
- Page metadata
- "Last sign-in" surfacing
- "Sign out everywhere" (global scope) — only single-session sign-out in this scope
- Requiring current password to change password (Supabase default — no current-pw check; revisit later if desired)

## Data model changes

**None.** All four PII columns already exist on `profiles` ([database.types.ts:1757](lib/supabase/database.types.ts:1757)):
- `full_name text`
- `date_of_birth date`
- `phone text`
- `address_postal text`

Rule check ([.claude/rules/data-management.md](.claude/rules/data-management.md)):
- ✅ Single source of truth — all four are canonical on `profiles`.
- ✅ PII boundary — no PII goes to `health_profiles.responses`.
- ✅ Typed columns — `date_of_birth` stays a `date` column (Zod parses to ISO string before write).
- ✅ Table ownership — `profiles` is written by user actions; this adds a new one (the Identity action) but stays within the allowed writer set.

Email lives in `auth.users` — `auth.updateUser({email})` is the only writer, triggering Supabase's own verification flow.

## Architectural decisions

1. **One file per concern, not one mega-actions.ts.** New files:
   - `app/(app)/account/identity-actions.ts` — `updateIdentity`
   - `app/(app)/account/security-actions.ts` — `changePassword`, `changeEmail`
   These follow the existing pattern (`pause-actions.ts`, `notification-actions.ts`, `care-team-actions.ts`).

2. **No new generic `accountSignOut` action.** Re-use `signOut` from `app/(auth)/actions.ts` — already does the right thing (revalidate root layout, redirect to `/`).

3. **Identity edit triggers `revalidatePath("/", "layout")`, not just `/account`.** The AppHeader reads `full_name` from `profiles` ([(app)/layout.tsx:23](app/(app)/layout.tsx:23)) — without layout-scope revalidation, the header would still show the stale name until a hard refresh. Trade-off: layout-scope revalidate also invalidates other layout-cached reads (e.g. the admin-flag lookup at [(app)/layout.tsx:21](app/(app)/layout.tsx:21)). That cost is accepted in exchange for not needing client-side coordination to refresh the header. The `is_admin` flicker is non-existent in practice (admin status doesn't change inside a session).

4. **Email-change `emailRedirectTo` lands users back on `/account`.** Use `${origin}/auth/callback?next=/account` so verification clicks return to the account page rather than dashboard. SDK call shape: `supabase.auth.updateUser({ email: new_email, emailRedirectTo: ... })` — `emailRedirectTo` is part of the `UserAttributes` arg, not a second options arg. Subagent must confirm by reading `@supabase/supabase-js` types before writing code.

5. **Password change: no current-password check.** Matches Supabase default. The user is already authenticated; requiring current password is an extra security layer we can add in Scope 2 if desired.

6. **Confirmation for sign-out: none.** Standard pattern across the web. Don't add friction for an undo-able action (users can sign back in).

## Waves

### Wave 1 — Identity inline edit

**What James can see after this wave merges:** On `/account`, the Identity card has an "Edit" link. Clicking it switches the read-only view into a form pre-populated with current Name, Date of birth, Phone, and Postal address. Saving updates the profile and surfaces the new values; the AppHeader name updates without a hard refresh. Cancelling restores the previous view. Phone + postal address are now visible (read-only) on the card even when not editing.

#### Task 1.1 — `updateIdentity` server action
Files affected:
- `app/(app)/account/identity-actions.ts` (new)
- `tests/account/identity-actions.test.ts` (new — Zod validation only)

What to build:
- File starts with `"use server";`
- Define `IdentityState = { error?: string; success?: string; values?: { full_name?: string; date_of_birth?: string; phone?: string; address_postal?: string } }`
- Define a Zod schema. Use `z.preprocess(v => (v === "" ? null : v), z.string().nullable().refine(...))` for the optional fields so empty strings coerce to null **before** other refinements run. Concrete shapes:
  - `full_name`: `z.string().trim().min(2, "Name must be at least 2 characters").max(120)`. Required.
  - `date_of_birth`: `z.preprocess(v => (typeof v === "string" && v.trim() === "") ? null : v, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use format YYYY-MM-DD").refine(s => { const d = new Date(s); return !isNaN(d.getTime()) && d < new Date(); }, "Date of birth must be in the past").refine(s => { const d = new Date(s); const today = new Date(); const ageMs = today.getTime() - d.getTime(); return ageMs >= 13 * 365.25 * 24 * 60 * 60 * 1000; }, "You must be at least 13 years old").nullable())`. Threshold is **13 years** (matches platform minimum age — confirm with product owner during plan review if 13 is wrong; if so, swap to 18).
  - `phone`: `z.preprocess(v => (typeof v === "string" && v.trim() === "") ? null : (typeof v === "string" ? v.trim() : v), z.string().min(5).max(30).nullable())`.
  - `address_postal`: `z.preprocess(v => (typeof v === "string" && v.trim() === "") ? null : (typeof v === "string" ? v.trim() : v), z.string().min(2).max(200).nullable())`.
- Empty-string-to-null transform for optional fields (matches existing `splitPii` semantics in `lib/profiles/pii-split.ts`).
- Action signature: `updateIdentity(_: IdentityState, formData: FormData): Promise<IdentityState>`
- Auth check: `supabase.auth.getUser()`, return `{ error: "Not signed in." }` if absent.
- On Zod failure: return `{ error: <first issue message>, values: <echo back submitted strings> }`.
- On success: `supabase.from("profiles").update({...}).eq("id", user.id)` writing only the four fields. Then `revalidatePath("/", "layout")`. Return `{ success: "Saved.", values: <new values> }`.
- Never throw — always return a state object.

Acceptance criteria:
- File exists with the action and exported `IdentityState` type.
- Zod schema rejects: empty/short name, future DOB, < 13yo DOB, malformed DOB, phone > 30, postal > 200.
- Zod schema accepts: empty phone/postal/DOB → coerced to null.
- Vitest unit tests cover at least: valid full payload, valid with empty optional, invalid name (too short), invalid DOB (too young), invalid DOB (future).
- `pnpm test` includes the new file and passes.
- No PII written anywhere except `profiles`.

Rules to apply: [.claude/rules/data-management.md](.claude/rules/data-management.md), [.claude/rules/security.md](.claude/rules/security.md), [.claude/rules/nextjs-conventions.md](.claude/rules/nextjs-conventions.md).

#### Task 1.2 — Identity card editable component
Files affected:
- `app/(app)/account/_components/identity-card.tsx` (new — `"use client"`)
- `app/(app)/account/page.tsx` (modify: replace inline `<dl>` with `<IdentityCard ... />`)
- `app/(app)/account/account.css` (extend: add input + form styles consistent with care-team form)

What to build:
- `IdentityCard` is a client component that takes `initial: { full_name, email, date_of_birth, phone, address_postal }`.
- Default view: read-only `<dl>` with all five rows (Name, Email, Date of birth, Phone, Postal address). Email is read-only here — change is in Security card. Phone/postal show "Not provided" when null.
- Header has an "Edit" button (`.lc-account-button-secondary`) on the right.
- Clicking Edit → toggles to form view. Email row stays read-only with a small note "Change in Security below".
- Form view: four labelled inputs (text for name/phone/postal, `type="date"` for DOB), Save (`.lc-account-button`) + Cancel (`.lc-account-button-secondary`) at the bottom.
- Use `useActionState(updateIdentity, { values: initial })` so values repopulate on validation error.
- On `state.success` truthy: render success notice (`.lc-account-success`) + flip back to read-only after 1.5s OR on next user interaction. Simplest: keep showing the form with success notice, and let the `revalidatePath` re-render the page with new values; user can click Cancel to dismiss. (Decision: stay in edit mode after save, show success banner; user dismisses via Cancel or Edit-toggle on parent.)
- On `state.error`: render error notice (`.lc-account-error`) at top of form.
- Pending state: disable Save and show "Saving…".
- Use `splitFullName` from `lib/profiles/name.ts` only if needed for derived display; not stored.

Acceptance criteria:
- `/account` renders all five identity rows in read-only mode by default. Phone + postal visible (showing "Not provided" if null).
- Clicking Edit reveals a form pre-filled with current values.
- Submitting an invalid DOB shows an inline error and keeps the user in edit mode with their typed values intact.
- Submitting a valid form saves to DB; the page re-renders with new values and AppHeader name updates without a hard refresh.
- Cancel returns to read-only with original values.
- No new Tailwind utilities — all styling via `account.css` classes.
- `pnpm build` passes; no TypeScript errors.

Rules to apply: [.claude/rules/nextjs-conventions.md](.claude/rules/nextjs-conventions.md), [.claude/rules/data-management.md](.claude/rules/data-management.md).

---

### Wave 2 — Security card + sign-out relocation

**What James can see after this wave merges:** On `/account`, a new Security card sits between Identity and "How we use your data". Inside: a password-change form (new + confirm), an email-change form (verification banner after submit), and a Sign out button. The desktop nav and mobile drawer no longer show Sign out — that affordance lives in the Security card only.

**Build order — strict, do not parallelise.** Within Wave 2 the tasks must land in this order in a single PR/commit sequence so the user is never without a sign-out path:
1. Task 2.1 — `changePassword` action
2. Task 2.2 — `changeEmail` action
3. Task 2.3 — Security card client component (includes the sign-out button)
4. Task 2.4 — Mount the card on `/account`
5. **Manual verification gate** — confirm sign-out works from the Security card on `/account` in the browser before proceeding
6. Task 2.5 — Remove sign-out from AppHeader
7. Task 2.6 — Remove sign-out from MobileNav
8. Task 2.7 — Remove signOut wiring from layout
9. Task 2.8 — Manual verification of email-change flow

Tasks 2.5–2.7 must not merge before Tasks 2.3–2.4 are confirmed working. If executing as separate commits in a single PR, that's fine — but no intermediate state can ship to main where sign-out exists in neither place.

#### Task 2.1 — `changePassword` server action
Files affected:
- `app/(app)/account/security-actions.ts` (new — both actions live here)
- `tests/account/security-actions.test.ts` (new)

What to build:
- File starts with `"use server";`
- `PasswordState = { error?: string; success?: string }`
- Zod: `password` ≥ 8, `confirm_password` must equal `password`.
- Signature: `changePassword(_: PasswordState, formData: FormData): Promise<PasswordState>`
- Auth check.
- On Zod failure: return `{ error }` (do not echo passwords).
- Call `supabase.auth.updateUser({ password })`. On error return `{ error: error.message }`.
- On success: `revalidatePath("/account")`, return `{ success: "Password updated." }`. Do NOT redirect.

Acceptance criteria:
- Action exists; never redirects.
- Zod rejects passwords < 8 chars and mismatched confirmation.
- Vitest unit tests cover validation branches (valid, too short, mismatch).
- No password values are returned in `values` (security rule).
- `pnpm test` passes.

Rules: [.claude/rules/security.md](.claude/rules/security.md) — never echo passwords.

#### Task 2.2 — `changeEmail` server action
Same file: `app/(app)/account/security-actions.ts`.

What to build:
- `EmailState = { error?: string; success?: string; values?: { new_email?: string } }`
- Zod: `new_email` must be a valid email and must differ from current `user.email` (case-insensitive).
- Auth check.
- Compute origin via `headers()` (mirror pattern in `(auth)/actions.ts`).
- Call `supabase.auth.updateUser({ email: new_email, emailRedirectTo: \`${origin}/auth/callback?next=/account\` })`.
  - `emailRedirectTo` is part of `UserAttributes` (the first and only arg), **not** a separate options object. Subagent must verify by reading `node_modules/@supabase/supabase-js/dist/module/lib/types.d.ts` (or equivalent types file) before writing the call — confirm `UserAttributes` includes `emailRedirectTo?: string`.
- On Supabase error (e.g. duplicate email): return `{ error: error.message, values: { new_email } }`.
- On success: return `{ success: "Verification email sent to <new_email>. Click the link to confirm.", values: { new_email } }`. No revalidate needed (email actually rotates only after verification).

Acceptance criteria:
- Action exists; rejects invalid format, rejects same-as-current.
- Vitest unit tests cover the validation branches. Test strategy: extract the Zod schema as a top-level export and unit-test the schema in isolation (no Supabase mock needed). The action body is one straight-line happy path — covering the schema covers 90% of the risk. If a Supabase mock is needed for the same-as-current check, mock `createClient` from `@/lib/supabase/server` to return a stub with `auth.getUser()` resolving to a fixed user — pattern already used in repo if any test exists; otherwise pure schema test is sufficient.
- Verified that `emailRedirectTo` plumbing is correct (subagent must confirm via SDK types as noted in implementation step).
- `pnpm test` passes.

#### Task 2.3 — Security card client component
Files affected:
- `app/(app)/account/_components/security-card.tsx` (new — `"use client"`)
- `app/(app)/account/account.css` (extend: form rows, divider between subsections)

What to build:
- Three subsections inside one `.lc-account-card`, separated by `<hr>` or a `.lc-account-divider`:
  1. **Change password** — two inputs (`type="password"`, names `password` + `confirm_password`), Save button. `useActionState(changePassword, {})`. On success: clear inputs and show success banner.
  2. **Change email** — one input (`type="email"`, name `new_email`), Save button. `useActionState(changeEmail, {})`. On success: show "Verification sent to <new_email>" notice; do not clear input (so user can see what they typed).
  3. **Sign out** — single form `action={signOut}` with a primary `.lc-account-button` "Sign out". No confirmation prompt.
- Card heading: `<h2>Security</h2>`. Each subsection has a small `<h3>` (or strong label) like "Password", "Email", "Sign out".
- Visual style consistent with care-team-section.tsx patterns — no inline `style={{}}`, all classes.

Acceptance criteria:
- Three subsections render; each has its own form scoped to its action.
- Pending state shows on each Save button independently. Pending state must `disabled={pending}` the submit button so a double-click cannot fire a second request before the first resolves (especially relevant for `changeEmail` where Supabase returns rate-limit errors on repeat calls).
- No PII or password values appear in client-visible state outside the `<input>` itself.
- Sign-out form submits to `signOut` from `(auth)/actions.ts` and redirects to `/`. The form uses `action={signOut}` directly — do NOT wrap with `useActionState` (signOut returns `void`).
- `pnpm build` passes.

#### Task 2.4 — Mount Security card on `/account`
Files affected: `app/(app)/account/page.tsx`

What to build:
- Import `SecurityCard` from `./_components/security-card`.
- Render `<SecurityCard />` immediately after the `<IdentityCard ... />` and before the "How we use your data" section.
- No props needed (Security actions don't take server-rendered initial state).

Acceptance criteria:
- Card appears in correct position on `/account`.
- No server-side data leakage (e.g. don't pass password values from server).

#### Task 2.5 — Remove sign-out from AppHeader
Files affected:
- `app/(app)/_components/app-header.tsx`
- `app/(app)/_components/app-header.css`

What to build:
- Remove `signOutAction` from props (component and type).
- Remove the `<form action={signOutAction}>` block in the desktop nav.
- Remove `signOutAction={signOutAction}` from the `<MobileNav />` invocation (Task 2.6 also removes it from MobileNav itself).
- Delete `.app-nav-signout-form`, `.app-nav-signout`, `.app-nav-signout:hover` rules from `app-header.css`.

Acceptance criteria:
- Component compiles without `signOutAction` prop.
- No CSS dead rules referencing removed classes.

#### Task 2.6 — Remove sign-out from MobileNav
Files affected:
- `app/(app)/_components/mobile-nav.tsx`
- `app/(app)/_components/mobile-nav.css`

What to build:
- Remove `signOutAction` prop from MobileNav.
- Remove the `<form action={signOutAction}>` block at the bottom of the drawer.
- Delete `.mobile-nav-signout-form`, `.mobile-nav-signout` rules from `mobile-nav.css`.

Acceptance criteria:
- Drawer no longer shows Sign out.
- No CSS dead rules.

#### Task 2.7 — Update layout to drop sign-out wiring
Files affected: `app/(app)/layout.tsx`

What to build:
- Remove `import { signOut } from "../(auth)/actions";`
- Remove `signOutAction={signOut}` from `<AppHeader />` invocation.
- (Mobile prop removed via header changes.)

Acceptance criteria:
- Layout compiles.
- `signOut` not imported in layout (still imported in `account/_components/security-card.tsx` from `(auth)/actions`).
- `pnpm build` passes.

#### Task 2.8 — Account-page metadata for security verification flow
Files affected: none if test confirms working — keep this as a verification-only task.

What to verify (no code change unless broken):
- After `changeEmail` runs, clicking the verification link in the Supabase email lands at `/auth/callback?token_hash=...&type=email_change`, the callback's `verifyOtp` succeeds, and the user lands on `/account`.
- This already works in principle ([auth/callback/route.ts:25](app/auth/callback/route.ts:25)) — confirm with a manual test in Phase 7.

Acceptance criteria:
- Confirmed during user-verification step in the wave's Phase 7 (manual click-through).

---

## Cross-cutting acceptance

After both waves merge:
- `/account` Identity card editable, with all five rows visible read-only and four editable.
- `/account` Security card has password change, email change, and sign-out — all functional.
- AppHeader and MobileNav contain only navigation links (no Sign out).
- Sign-out from Security card returns the user to `/`.
- `pnpm build` clean.
- `pnpm test` green; new test files cover validation branches.
- No new ESLint warnings.
