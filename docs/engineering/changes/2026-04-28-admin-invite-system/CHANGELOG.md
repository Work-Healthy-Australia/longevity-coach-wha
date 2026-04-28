# Changelog: Admin Invite System
Date: 2026-04-28
Phase: Phase 1 — Foundation

## What was built

- `/admin/admins` page — lists current admins with individual revoke buttons, shows pending (not yet accepted) invites, and provides an invite-by-email form
- `inviteAdmin` server action — if the email already has an account, grants admin access immediately and sends a notification email; if new, sends a Supabase invite email and pre-authorises admin access on signup via the `admin_invites` table
- `revokeAdmin` server action — removes admin access from any user; blocks self-revoke
- `public.admin_invites` table — stores pending invitations by email with RLS deny-all (service-role only); trigger marks invites accepted on signup
- Updated `handle_new_user` trigger — auto-grants `is_admin = true` if the signing-up email matches an unaccepted invite row
- Main app nav (`/dashboard` layout) now shows an **Admin** tab only when `profiles.is_admin = true` for the current user
- Admin nav updated with **Overview** (was missing) and **Admins** links

## What changed

| File | Change |
|---|---|
| `app/(admin)/layout.tsx` | Added Overview + Admins nav links; removed Analytics link (route doesn't exist) |
| `app/(app)/layout.tsx` | Added admin client fetch of `is_admin`; conditionally renders Admin tab |
| `app/(admin)/admin/admins/page.tsx` | New — server page |
| `app/(admin)/admin/admins/_components/AdminAdminsUI.tsx` | New — client form component |
| `app/(admin)/admin/admins/actions.ts` | New — server actions |
| `supabase/migrations/0032_seed_admins.sql` | New — seeds existing users |
| `supabase/migrations/0033_admin_invites.sql` | New — admin_invites table + trigger update |
| `docs/features/admin/admin-feature-log.md` | New — admin feature build log |

## Side fix

Three migration files had conflicting numbers due to a prior branching error:
- `0020_risk_assessment_standards.sql` → renamed to `0035_risk_assessment_standards.sql`
- `0025_supplement_catalog.sql` → renamed to `0036_supplement_catalog.sql`
- `0026_health_knowledge_embeddings.sql` → renamed to `0037_health_knowledge_embeddings.sql`

All three applied cleanly (idempotent SQL with IF NOT EXISTS guards).

## Migrations applied

| Migration | Description |
|---|---|
| `0031_patient_uploads_file_hash.sql` | Pre-existing; pushed as part of this session |
| `0032_seed_admins.sql` | Sets is_admin = true for all existing profiles |
| `0033_admin_invites.sql` | admin_invites table + handle_new_user trigger update |
| `0034_risk_scores_unique_and_array_fixes.sql` | Pre-existing; pushed as part of this session |
| `0035_risk_assessment_standards.sql` | Renamed from 0020; risk assessment standards table |
| `0036_supplement_catalog.sql` | Renamed from 0025; supplement catalog table |
| `0037_health_knowledge_embeddings.sql` | Renamed from 0026; health knowledge embeddings table |

## Deviations from plan

None. All five tasks completed as planned.

## Known gaps / deferred items

- Self-revoke is blocked server-side but the Revoke button renders next to the current admin's own row — a small UX gap, not a security issue
- No unit tests for admin server actions (requires Supabase service-role mock; deferred)
- `admin_invites.email` is PII stored outside `profiles` — accepted trade-off at current scale; should be evaluated when Vault migration is planned
