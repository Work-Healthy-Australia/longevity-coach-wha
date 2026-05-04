# Plan: Admin role assignment UI (extend /admin/users/[id])

Date: 2026-05-04
Phase: Phase 1 — Foundation (v1.1 backlog)
Status: Reviewed (rev 2)

## Objective

Let admins grant and revoke roles for a user through the UI instead of running SQL by hand. Surface current role assignments and recent audit history on the existing `/admin/users/[id]` detail page so it's a one-stop place to manage a member.

Done = an admin can: open `/admin/users/<id>`, see a "Roles" card listing current active assignments, pick a role from a dropdown and click Grant, click Revoke on any active assignment, and see the action reflected immediately. The DB-side privilege rules from migration 0068 (`grant_role()` / `revoke_role()` SECURITY DEFINER functions) are the single source of truth — the UI does not duplicate the policy logic; it surfaces the DB error if the actor lacks permission.

## Scope

**Defence-in-depth (intentional, three layers):**
- Layer 1 — `proxy.ts` (`/admin` in `PROTECTED_PREFIXES`) — catches unauthenticated direct hits
- Layer 2 — `app/(admin)/layout.tsx` — catches authenticated non-admin users navigating to admin routes
- Layer 3 — `requireAdminAndRequestMeta()` in the action — catches direct POSTs to the server-action endpoint that bypass the page render
Each catches a different failure mode; not redundant. Document this with a one-line comment in the action.

**In scope:**
- New "Roles" card on `app/(admin)/admin/users/[id]/page.tsx` — shows active `user_role_assignments` rows for the target user, plus a grant form (role dropdown + reason input + submit) and a revoke button on each row
- New "Recent role audit" card showing the last 10 `role_audit_log` entries for the target user (grant/revoke events + actor + reason + timestamp)
- Two new server actions in `app/(admin)/admin/users/[id]/actions.ts`:
  - `grantRole(formData)` — calls `grant_role()` RPC, errors surfaced inline
  - `revokeRoleAssignment(formData)` — calls `revoke_role()` RPC, errors surfaced inline
- A small client component for the grant form (needs `useActionState` for inline error feedback) and a revoke button form
- Shared role-list constant in `lib/auth/roles.ts` (new) — single source of truth for which roles are exposed in the UI dropdown (excludes `corp_health_manager` per the design decision)
- Tests: unit tests for the new server actions (mock the supabase client + RPC calls; verify happy path + error path + missing-form-field path)

**Out of scope:**
- `corp_health_manager` role — managed via Organisations (`billing.organisation_members`), not `user_role_assignments`. UI shows a one-line note pointing to organisations rather than offering it in the dropdown.
- Scoped grants (`segment` / `organisation` scopes) — MVP only handles `global` scope. Scoped role assignment is a separate UI concern; the DB supports it but no current role uses it.
- AHPRA registration management — granting `manager` requires `ahpra_verified_at` on the target. The DB error message is explicit ("manager role requires ahpra_verified_at on target user") and surfaced inline. A separate UI for AHPRA registration is its own change.
- Migrating `/admin/admins` (legacy `profiles.is_admin` flow) to the new role system — flagged as TECH-DEBT in `docs/qa/TECH-DEBT.md`. Two writers (old page + new role UI) for the admin role exists temporarily; PR #113 explicitly kept the old columns "for parallel reads + rollback" so removing now is premature.
- Phase B Role Builder (lifting `app_role` enum into a roles table) — separate Phase 1 backlog item.
- Bulk role grants, role search, role-by-org filters — out of scope.

## Data model changes

None. The schema already exists from PR #113 (migration 0068). This PR only adds UI + server actions that call existing RPC functions.

## Waves

### Wave 1 — Roles card + grant/revoke actions on user detail page (single wave)

**What James can see after this wave merges:**
- Open `/admin/users/<some-user-id>` → new "Roles" card visible at the top of the right column showing: current active assignments (e.g. "admin · global · granted 2026-05-02 by James") and a grant form (role dropdown + reason input + Grant button)
- Click "Grant" with role=clinician + reason="onboarding" → row appears in the active assignments list within the same page render
- Click "Revoke" on any row → assignment disappears from active list (still visible in audit history below)
- New "Recent role audit" card below shows the last 10 grant/revoke events with actor, action, role, scope, reason, and timestamp
- If the actor lacks permission (e.g. an admin tries to grant super_admin) → inline error "only super_admin can grant super_admin or admin roles" (from the DB function, not duplicated in the UI)
- If trying to grant `manager` to a user without AHPRA verification → inline error "manager role requires ahpra_verified_at on target user"

#### Task 1.1 — Shared roles constant

Files affected:
- `lib/auth/roles.ts` (new)

What to build:
- Export `ASSIGNABLE_ROLES` as a tuple of role values exposed in the assignment UI: `["super_admin", "admin", "manager", "clinician"] as const`
- Export the corresponding TypeScript type: `export type AssignableRole = typeof ASSIGNABLE_ROLES[number]`
- Export display labels: `export const ROLE_LABELS: Record<AssignableRole, string> = { super_admin: "Super Admin", admin: "Admin", manager: "Manager (clinical)", clinician: "Clinician" }`
- Export a constant explanation note: `export const CHM_NOTE = "Corporate Health Manager is managed via Organisations." as const`
- No I/O, pure constants

Acceptance criteria:
- File exists with the four exports above
- `corp_health_manager` is NOT in `ASSIGNABLE_ROLES`
- TypeScript types are correct (`AssignableRole` derived from the tuple)
- `pnpm build` passes

Rules to apply:
- `.claude/rules/nextjs-conventions.md` (file naming)

#### Task 1.2 — Server actions (grantRole, revokeRoleAssignment)

Files affected:
- `app/(admin)/admin/users/[id]/actions.ts`

What to build:

Add two new server actions to the existing file (alongside `markDeceased` / `unmarkDeceased`):

**`grantRole(prev, formData)`** — `useActionState` shape returning `{ error?: string; success?: string }`:
- Reads `target_user_id` (uuid), `role` (must be in `ASSIGNABLE_ROLES`), and `reason` (string, optional but trimmed) from formData
- Validates with Zod:
  ```ts
  z.object({
    target_user_id: z.string().uuid(),
    role: z.enum(ASSIGNABLE_ROLES),
    reason: z.string().trim().max(500).optional()
      .transform(v => (v === undefined || v === "") ? undefined : v),
  })
  ```
  The `transform` ensures an empty form input (which trims to `""`) is coerced to `undefined` so the RPC receives `null` for `grant_reason` rather than an empty string in the audit log.
- Calls `requireAdminAndRequestMeta()` (existing helper in this file) — UI gate (layer 3 of defence-in-depth: proxy → layout → action). The DB function also gates via `has_role('admin'|'super_admin')` — UI gate is defence-in-depth, not the single source of truth.
- **Self-grant guard:** If `target_user_id === actor user.id` AND `role` is `"super_admin"` or `"admin"`, return `{ error: "Self-grant of admin roles is blocked — ask another super_admin." }` without calling the RPC. Migration 0068 has no self-escalation check; this guard catches the dangerous lateral case (admin granting admin to themselves).
- Uses the user-context client (`createClient` from `@/lib/supabase/server`), NOT the admin client. **Why this matters:** SECURITY DEFINER functions execute as the function owner, but `auth.uid()` reads the JWT from the request's `request.jwt.claims` GUC. The admin client uses the service-role JWT where `auth.uid()` is NULL — which would silently bypass the actor privilege checks (migration lines 293, 359) and write a NULL `granted_by` / `actor_uuid` to the audit log. Inline this comment in the action so a future reviewer doesn't "fix" it back.
- Calls `supabase.rpc("grant_role", { target_user_uuid, grant_role: role, grant_scope_type: "global", grant_scope_id: null, grant_reason: reason ?? null })`. The parameter name `grant_role` shadowing the function name is intentional — matches migration 0068 line 275 and is legal in PostgREST's named-arg mode.
- **Error mapping:** if the RPC returns an error whose message contains `"duplicate key value violates unique constraint"` (the partial unique index at migration line 109 catches re-grants of an active assignment), map to a friendly `"User already has this role."`. Otherwise return the raw `error.message` (the DB messages for self-bootstrap, AHPRA gate, and privilege failure are already user-readable).
- On success, calls `revalidatePath(`/admin/users/${target_user_id}`)` and returns `{ success: "Role granted." }`
- No `redirect()` — keeps user on the same page so they see the updated list

**`revokeRoleAssignment(prev, formData)`** — `useActionState` shape returning `{ error?: string; success?: string }`:
- Reads `assignment_id` (uuid) and `target_user_id` (uuid, for revalidation only) from formData
- Validates with Zod: `z.object({ assignment_id: z.string().uuid(), target_user_id: z.string().uuid() })`
- Calls `requireAdminAndRequestMeta()`
- Uses user-context client (same reasoning as grantRole — see WHY comment above)
- Calls `supabase.rpc("revoke_role", { assignment_id, revoke_reason: null })` — Reason input is optional in this MVP; keep the form lean
- On error, returns `{ error: error.message }` (DB messages "role assignment not found", "role assignment already revoked", "only super_admin can revoke super_admin or admin roles" are all user-readable)
- On success, `revalidatePath(`/admin/users/${target_user_id}`)` and returns `{ success: "Role revoked." }`

Acceptance criteria:
- Both actions exported, typed, and call the correct RPC
- `requireAdminAndRequestMeta()` is reused (do not duplicate the admin check)
- Uses user-context client (not admin client) so `auth.uid()` is preserved into the RPC
- Zod gates both — invalid inputs return `{ error }` without calling the RPC
- `revalidatePath` is called on success so the page re-renders with fresh data
- `pnpm build` passes

Rules to apply:
- `.claude/rules/security.md` (Zod at server boundary; admin gate)
- `.claude/rules/nextjs-conventions.md` (server actions, useActionState shape, user-context vs admin client)

#### Task 1.3 — Roles card + audit card on detail page

Files affected:
- `app/(admin)/admin/users/[id]/page.tsx`
- `app/(admin)/admin/users/[id]/_components/RolesCard.tsx` (new — small client component for the grant form)
- `app/(admin)/admin/users/[id]/_components/RevokeRoleButton.tsx` (new — small client component, single-button form using `useActionState` for inline error feedback)

What to build:

In `page.tsx`:
- After the existing `Promise.all` fetch, add two more queries (run them inside the same `Promise.all` for parallelism):
  - `admin.from("user_role_assignments").select("id, role, scope_type, scope_id, granted_by, granted_at, reason").eq("user_uuid", id).is("revoked_at", null).order("granted_at", { ascending: false })` — active assignments only
  - `admin.from("role_audit_log").select("id, actor_uuid, action, role, scope_type, scope_id, reason, ahpra_check_passed, created_at").eq("target_uuid", id).order("created_at", { ascending: false }).limit(10)` — last 10 audit events
- Resolve actor display names: collect all unique `actor_uuid` / `granted_by` values, fetch `profiles.full_name` for them in one query, build a `Map<userId, displayName>` (fallback to `userId.slice(0, 8) + "…"` if no profile found)
- Pass the current admin's `user.id` (from `getUser()` in the page or a helper) to `<RolesCard actorUserId={...} />` so it can render the self-grant hint
- Inline comment near the audit-log query: `// Layout already gates on is_admin; admin client used for parity with rest of page (RLS would also permit, since admin policy on role_audit_log allows SELECT for has_role('admin')|has_role('super_admin') callers — see migration 0068 line 252).`
- Render two new cards in the existing `detail-grid`:
  - **Roles card** (placed first or near the subscription card): title "Roles", lists each active assignment as a row "{role} · {scope_type}{scope_id ? ' / ' + scope_id : ''} · granted {date} by {actor}", with `<RevokeRoleButton assignmentId={...} targetUserId={id} />` inline. Below the list, render `<RolesCard targetUserId={id} />` containing the grant form.
  - **Recent role audit card** (in `full-width` style at the bottom, like the supplement plans card): title "Recent role audit", table with columns Date, Action, Role, Scope, Actor, Reason. Show "—" for missing reason.

In `RolesCard.tsx`:
- `"use client"` component, takes `targetUserId: string` and `actorUserId: string` props (actor passed from page so the form can pre-detect self-grant of sensitive roles)
- Uses `useActionState(grantRole, {})` from `react`
- Renders: hidden input `target_user_id={targetUserId}`, `<select name="role">` with options from `ASSIGNABLE_ROLES` mapped through `ROLE_LABELS`, `<input name="reason" placeholder="Optional reason">`, submit button "Grant"
- **Client-side self-grant hint:** if `targetUserId === actorUserId`, render a small inline note above the form: "You're viewing your own user — admin/super_admin self-grants will be blocked." The action enforces this server-side; the UI hint just reduces surprise.
- Below the form, render the `CHM_NOTE` text in muted style
- Show success or error inline above the form

In `RevokeRoleButton.tsx`:
- `"use client"` component, takes `{ assignmentId: string; targetUserId: string }` props
- Uses `useActionState(revokeRoleAssignment, {})`
- Renders a single-button form with hidden inputs and a confirm step (small inline confirm — `<button>` text changes to "Confirm revoke?" on first click, actually submits on second click within 5s, OR use native `confirm()` for MVP simplicity)
- Show error inline if revoke fails

Acceptance criteria:
- Page renders the new Roles card showing active assignments
- Grant form submits and the new assignment appears in the list after revalidation
- Revoke removes the assignment from the active list
- Audit log shows the last 10 events with correct columns
- Actor names resolve to full_name (fallback to truncated UUID)
- CHM note visible
- DB error messages (e.g. "only super_admin can grant super_admin or admin roles") render inline as the `error` state
- `pnpm build` passes
- No PII in console logs (per .claude/rules/security.md)

Rules to apply:
- `.claude/rules/nextjs-conventions.md` (server actions, useActionState, server component → client component composition)
- `.claude/rules/security.md` (no PII in logs)
- `.claude/rules/data-management.md` (no derived data stored)

#### Task 1.4 — Tests

Files affected:
- `tests/unit/admin/role-actions.test.ts` (new)

What to build:

Mocks (using `vi.hoisted` for factory-hoisting):
- `next/headers` `headers()` → returns `{ get(key) }` matching the existing `requireAdminAndRequestMeta` helper expectations (host, x-forwarded-proto, x-forwarded-for, user-agent)
- `next/navigation` `redirect()` → throws `NEXT_REDIRECT:<url>` (so the admin gate failure case is observable)
- `next/cache` `revalidatePath` → no-op vi.fn
- `@/lib/supabase/server` `createClient` → stub with `auth.getUser`, `from(...).select(...).eq(...).maybeSingle()` for the admin-check, and `rpc(...)` for the grant/revoke calls

Test cases for `grantRole`:
1. Happy path: admin caller, valid uuid + role + reason → calls `rpc("grant_role", ...)` with correct args, returns `{ success: "Role granted." }`, calls `revalidatePath`
2. Non-admin caller (caller's `is_admin` is false) → `redirect("/dashboard")` is called (throws `NEXT_REDIRECT:/dashboard`)
3. Unauthenticated caller (`auth.getUser` returns no user) → `redirect("/login")` is called
4. Invalid uuid → returns `{ error: <zod issue message> }`, no RPC call
5. Invalid role (e.g. "corp_health_manager") → returns `{ error: <zod issue message> }`, no RPC call
6. RPC returns error (e.g. "only super_admin can grant super_admin or admin roles") → returns `{ error: <that message> }`, no `revalidatePath` call

Test cases for `revokeRoleAssignment`:
7. Happy path: admin caller, valid assignment_id → calls `rpc("revoke_role", ...)`, returns `{ success: "Role revoked." }`, calls `revalidatePath`
8. Non-admin → redirect("/dashboard")
9. Invalid assignment_id (non-uuid) → `{ error }` without RPC call
10. RPC returns error (e.g. "role assignment already revoked") → returns `{ error: <that message> }`

Additional test cases (added in plan rev 2 per code-review):
11. Self-grant of admin: actor.id === target_user_id AND role === "admin" → returns `{ error: "Self-grant of admin roles is blocked — ask another super_admin." }`, RPC NOT called
12. Self-grant of super_admin → same blocked behaviour
13. Self-grant of clinician (allowed) → RPC IS called normally
14. Duplicate active grant: RPC returns error containing "duplicate key value violates unique constraint" → action maps to friendly `{ error: "User already has this role." }`
15. AHPRA gate: grant role=manager, RPC returns error "manager role requires ahpra_verified_at on target user" → action returns `{ error: <raw message> }` (no mapping, message is already user-readable)
16. Empty `reason` field → Zod transform yields `undefined` → RPC receives `null` for `grant_reason` (verify the call args, not just success)

Acceptance criteria:
- All 10 cases pass
- Tests follow the vitest patterns in `tests/unit/auth/sign-in-redirect.test.ts` and `tests/unit/account/security-actions.test.ts`
- `pnpm test` full suite passes (no regressions)

Rules to apply:
- `.claude/rules/nextjs-conventions.md`
