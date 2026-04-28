# Admin Feature — Build Log

## What was built

The admin CRM and access control system was built across two phases.

---

### Phase 1 — Initial schema & guard (migrations 0001, 0017)

**Date:** prior to 2026-04-28 (exact date in git history via `git log -- supabase/migrations/0017_admin_flag.sql`)

- `profiles.role` column added in `0001_init.sql` (text, default `'user'`)
- `profiles.is_admin` boolean column added in `0017_admin_flag.sql`
- Admin layout guard implemented in `app/(admin)/layout.tsx` — checks `is_admin` and redirects non-admins to `/dashboard`
- Admin nav built with links to Overview, Users, Agents

### Phase 1 — Admin dashboard & CRM pages

**Date:** 2026-04-28 (shipped on branch `feat/nova-research-pipeline`, merged to `main`)

Pages built:
- `/admin` — Overview dashboard: MRR, active members, new signups, churn, pipeline runs, uploads, recent signups table
- `/admin/users` — All users with subscription status, assessment status, bio age
- `/admin/users/[id]` — User detail: subscription, risk scores, health assessment, uploads, supplement plans
- `/admin/agents` — Agent manager: lists all agents from `agents.agent_definitions`, links to edit page
- `/admin/agents/[slug]` — Agent detail & config editor

Supporting lib: `lib/admin/metrics.ts` — all dashboard metric queries, fully unit-tested pure functions.

---

### Phase 2 — Admin invite system (migrations 0032, 0033)

**Date:** 2026-04-28

- `0032_seed_admins.sql` — seeded all existing profiles (2 founding team accounts) as `is_admin = true`
- `0033_admin_invites.sql` — created `public.admin_invites` table; updated `handle_new_user` trigger to auto-grant `is_admin` when an invited email signs up
- `/admin/admins` — Admins management page: lists current admins with revoke, shows pending invites, invite-by-email form
- Server actions `inviteAdmin` / `revokeAdmin` in `app/(admin)/admin/admins/actions.ts`
- Main app nav (`app/(app)/layout.tsx`) now conditionally shows an **Admin** tab for users where `is_admin = true`

---

## Access control summary

| Who can reach `/admin` | How |
|---|---|
| Users with `profiles.is_admin = true` | Checked in `app/(admin)/layout.tsx` on every request |
| All others | Redirected to `/dashboard` |

Inviting a new admin:
1. Go to `/admin/admins`
2. Enter their email and click Invite
3. If they have an account → access granted immediately + notification email sent
4. If they don't → Supabase invite email sent; admin flag set automatically on sign-up via DB trigger
