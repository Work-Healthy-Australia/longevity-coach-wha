# Plan: Admin Invite System
Date: 2026-04-28
Phase: Phase 1 — Foundation
Status: Completed

## Objective

Secure the existing admin CRM behind a proper role-based guard, seed the two founding-team accounts as admins, and build an invite mechanism so new admins can be added without touching the database directly. The outcome is: only users with `profiles.is_admin = true` can reach `/admin`, and any authenticated admin can invite or revoke other admins via a UI at `/admin/admins`.

## Scope

**In scope:**
- Seed migration setting existing two users to `is_admin = true`
- `admin_invites` table for pre-authorising new accounts
- Updated `handle_new_user` trigger to auto-grant admin on signup for invited emails
- `/admin/admins` page: list current admins, pending invites, invite form, revoke action
- Conditional Admin tab in the main app nav (visible to admins only)
- Admin nav updated with Overview and Admins links

**Out of scope:**
- Role hierarchy (super-admin vs admin) — not needed at current scale
- Audit log for admin grant/revoke actions — Phase 2 concern
- Email templates beyond plain HTML — follows existing project convention

## Data model changes

| Table | Column | Type | PII? | Writer |
|---|---|---|---|---|
| `profiles` | `is_admin` (existing) | `boolean` | No | Admin server action + trigger |
| `admin_invites` (new) | `email` | `text PK` | Yes — email | Admin server action only |
| `admin_invites` | `invited_by` | `uuid FK → profiles` | No | Admin server action |
| `admin_invites` | `invited_at` | `timestamptz` | No | Admin server action |
| `admin_invites` | `accepted_at` | `timestamptz` | No | `handle_new_user` trigger |

Note: `admin_invites.email` is technically PII. It is not queryable by members (RLS deny-all policy) and is only readable by service-role.

## Tasks

### Task 1 — Seed migration (0032)
Files: `supabase/migrations/0032_seed_admins.sql`
Sets `is_admin = true` for all existing profiles (2 accounts at time of writing).
Acceptance criteria: both founding accounts can reach `/admin` after migration runs.

### Task 2 — Admin invites table + trigger (0033)
Files: `supabase/migrations/0033_admin_invites.sql`
Creates `admin_invites` with RLS deny-all. Updates `handle_new_user` to check the table on signup and grant is_admin automatically.
Acceptance criteria: invited email gets is_admin on signup; trigger marks invite accepted.

### Task 3 — Server actions
Files: `app/(admin)/admin/admins/actions.ts`
`inviteAdmin(email)`: existing user → flip flag + send notification; new user → Supabase invite + insert into admin_invites.
`revokeAdmin(userId)`: sets is_admin = false, blocks self-revoke.
Acceptance criteria: both actions validate input, use service-role client, return typed `{ error }` or `{ success }` result objects.

### Task 4 — Admins page
Files: `app/(admin)/admin/admins/page.tsx`, `app/(admin)/admin/admins/_components/AdminAdminsUI.tsx`
Server page fetches current admins and pending invites. Client component renders the UI with useActionState.
Acceptance criteria: lists admins with revoke button; shows pending invites; invite form sends email and shows success/error inline.

### Task 5 — Nav updates
Files: `app/(admin)/layout.tsx`, `app/(app)/layout.tsx`
Admin nav: adds Overview and Admins links.
App nav: fetches is_admin for current user and conditionally renders Admin tab.
Acceptance criteria: Admin tab invisible to non-admin members; visible to admins.
