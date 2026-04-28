# QA Report: Admin Invite System
Date: 2026-04-28
Reviewer: QA subagent

## Build status
pnpm build: PASS
pnpm test: PASS (298 tests)

## Test results
| Suite | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| All suites (50 files) | 298 | 298 | 0 | 0 |

No new test suites were added for this feature. Coverage of the new server actions (`inviteAdmin`, `revokeAdmin`) relies on manual verification and the build typecheck only.

## Findings

### Confirmed working
- Build compiles cleanly: 37 routes, zero TypeScript errors, `/admin/admins` rendered as a dynamic server route (`ƒ /admin/admins`).
- All 298 pre-existing tests pass with no regressions.
- Migration `0033_admin_invites.sql` creates `public.admin_invites` with RLS deny-all — table is inaccessible to authenticated users and readable only via the service-role client, consistent with security rules.
- Migration `0032_seed_admins.sql` backfills `is_admin = true` for all existing profiles.
- `handle_new_user` trigger updated to auto-grant `is_admin` on signup for pre-invited emails — prevents a race between signup and manual grant.
- Admin nav in `app/(admin)/layout.tsx` exposes Overview and Admins links.
- Main nav in `app/(app)/layout.tsx` conditionally renders the Admin tab based on `is_admin` — non-admin users see no entry point.
- Duplicate-numbered migration files (`0020`, `0025`, `0026`) renamed to `0035`–`0037` and applied cleanly; all use `IF NOT EXISTS` guards so re-application is safe.

### Deferred items
- No unit or integration tests for `inviteAdmin` and `revokeAdmin` server actions. Testing these requires a Supabase mock; deferred out of scope for this change. Follow-up ticket recommended.
- `admin_invites.email` stores PII (email address). Currently protected by RLS deny-all and service-role access only, but not vaulted. Vaulting is consistent with the current phase's approach to PII; revisit in Phase 2 Vault migration.

### Known limitations
- **Self-revoke UI**: The Revoke button is rendered next to the currently logged-in admin's own name. The server action blocks self-revoke correctly, but no visual feedback (disabled state, tooltip, or hidden button) indicates this before submission. The user will submit the form and receive an error response with no prior warning. Low severity; UX polish only.
- Pre-existing workspace root warning (`pnpm-workspace.yaml` + `package-lock.json` coexisting) appears in build output. Unrelated to this change; pre-dates this branch.

## Verdict
APPROVED — build is clean, all tests pass, security posture (RLS deny-all, service-role writes only) is correct. One UX gap (self-revoke button visibility) and missing server-action unit tests are noted but do not block ship.
