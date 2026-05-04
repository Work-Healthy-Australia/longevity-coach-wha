# QA Report: Admin role assignment UI — Wave 1

Date: 2026-05-04
Reviewer: dev-loop QA pass

## Build status

- `pnpm build`: PASS — clean
- `pnpm test`: PASS — **726 passed, 4 skipped, 0 failed** across 93 test files
- `pnpm test tests/unit/admin/`: PASS — 16 / 16

## Test results

| Suite | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| `tests/unit/admin/role-actions.test.ts` (new) | 16 | 16 | 0 | 0 |
| Full project suite | 730 | 726 | 0 | 4 |

## Findings

### Confirmed working
- New `lib/auth/roles.ts` is the single source of truth for which roles are exposed in the assignment UI; `corp_health_manager` correctly excluded
- `grantRole()` uses the user-context client (preserves `auth.uid()` for the SECURITY DEFINER `grant_role()` actor checks and `granted_by` audit population)
- Self-grant of `super_admin` / `admin` blocked at the action layer (catches lateral admin escalation; migration 0068 has no DB-side self-check)
- Duplicate-grant Postgres error (SQLSTATE 23505) mapped to user-friendly "User already has this role." — uses error code rather than message substring for stability across PG versions
- `revokeRoleAssignment()` calls `revoke_role()` RPC with correct named args; passes `target_user_id` only to support `revalidatePath` (not to the RPC)
- `/admin/users/[id]` extended with two new cards (Roles + Recent role audit) without disturbing existing cards
- Actor names resolved in one query; falls back to truncated UUID when no profile name exists
- 16 unit tests cover happy paths, all three guard layers (auth, admin, action), Zod validation, RPC error paths, self-grant blocks, duplicate-grant mapping, AHPRA gate, and empty-reason → null transform

### Spec compliance review
PASS — every acceptance criterion across all 4 tasks verified.

### Code quality review
APPROVED_WITH_NITS. Three nits identified:
- ✅ Addressed: PG error code (`23505`) replaces brittle substring match for duplicate-grant detection
- ⏭ Deferred: update `lib/supabase/loose-table.ts` JSDoc to list the two new tables it wraps (trivial doc edit, separate cleanup)
- ⏭ Deferred: replace native `confirm()` in RevokeRoleButton with a styled dialog (UX polish, not blocking — destructive action is reversible via re-grant and audit-logged)

### Defence-in-depth (intentional)
Three guard layers retained:
1. `proxy.ts` — `/admin` in `PROTECTED_PREFIXES` (catches unauthenticated direct hits)
2. `app/(admin)/layout.tsx` — auth + `is_admin` check (catches authenticated non-admins navigating)
3. `requireAdminAndRequestMeta()` in the action — catches direct POSTs to the server-action endpoint that bypass the page render

### Deferred items
- AHPRA registration management UI — granting `manager` requires `ahpra_verified_at` on the target. The DB error message is explicit and surfaced inline; a separate UI for AHPRA registration is its own change.
- Scoped grants (`segment` / `organisation` scopes) — DB supports them but no current role uses them.
- Migrating `/admin/admins` (legacy `profiles.is_admin` flow) to the new role system — flagged separately as TECH-DEBT.
- Phase B Role Builder — separate Phase 1 backlog item.

### Known limitation
Local browser verification of the UI requires Supabase env vars (admin pages call `createClient` and `createAdminClient`). Same constraint as PRs #131, #133, #135. The UI flow is covered by 16 unit tests; visual / interaction QA is on Vercel preview after merge.

## Verdict

APPROVED — proceed to push → merge.
