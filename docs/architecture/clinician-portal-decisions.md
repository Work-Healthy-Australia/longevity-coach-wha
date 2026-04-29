# Clinician Portal — Decisions Log
Date: 2026-04-29
Status: RESOLVED 2026-04-29 (all six accepted with default proposals — JM)

This file captures decisions from the Sprint 2 Clinician Portal review session
driven by `docs/engineering/plan/sprint-1/2026-04-29-plan-business-features.md`,
Step 13. Reference architecture: `docs/architecture/clinician-portal.md`.

James reviewed the architecture document on 2026-04-29 and accepted every
default proposal below verbatim. Plan B Wave-2-9 (clinician portal UI build)
is now unblocked.

---

## C1 — Clinician invitation flow

**Question:** How does an admin invite a clinician? The Base44 prototype assumes
the clinician already exists in the system; the email-invite onboarding path was
absent.

**Status:** ACCEPTED — JM 2026-04-29

**Decision:** mirror the existing admin-invite flow in
`app/(admin)/admin/admins/actions.ts` — admin sends an email invite, the
invitee accepts via a single-use token, and the role is assigned on accept.
Reuse the `billing.org_invites` shape (single-use token, 14-day expiry,
append-only status enum) but in a separate `clinician_invites` table to keep
care-team and billing concerns isolated.

---

## C2 — Patient consent for care-team access

**Question:** AHPRA requires a `consent_records` row before a clinician can see
a patient. Where does the patient grant this — onboarding, or a separate consent
surface?

**Status:** ACCEPTED — JM 2026-04-29

**Decision:** new step in `/account` (or onboarding's consent step) — "Care
team access" — patient explicitly nominates a clinician by email. Consent
record written to `consent_records` (append-only, never updated, per
`.claude/rules/security.md`).

---

## C3 — Appointment booking direction

**Question:** Does the patient see available slots and book, or does the
clinician initiate?

**Status:** ACCEPTED — JM 2026-04-29

**Decision:** clinician initiates in v1 (matches Base44). Patient-facing
self-booking deferred until calendar integration (Phase 5+).

---

## C4 — Role expansion sign-off

**Question:** `profiles.role` currently allows `user` and `admin`. Expanding to
`clinician`, `coach`, `health_manager` requires a migration and `proxy.ts`
changes.

**Status:** ACCEPTED — JM 2026-04-29

**Decision:** add the four new roles in one migration. `health_manager`
is already on `billing.organisation_members.role` — extend `profiles.role`'s
check constraint to align.

Final role list on `profiles.role`: `user`, `admin`, `clinician`, `coach`,
`health_manager`.

---

## C5 — Check-in review cadence

**Question:** Base44 runs check-in reviews monthly. Confirm: monthly per Epic 9
spec, or triggered per check-in?

**Status:** ACCEPTED — JM 2026-04-29

**Decision:** monthly bulk review (matches Base44 + the
`pt-plan` / `clinician-briefs` cron schedule already in `vercel.json`).

---

## C6 — `PROGRAM_READY` signal

**Question:** Base44 prototype uses a text sentinel in the agent stream to
trigger program delivery. Carry the pattern across, or replace with a structured
`tool_use` result?

**Status:** ACCEPTED — JM 2026-04-29

**Decision:** structured `tool_use` is the project convention
(`.claude/rules/ai-agents.md` — Janet sub-agent pattern). Replace the text
sentinel; the Base44 streaming pattern was a workaround for an environment
without tool-call results.

---

## What this unblocks

Plan B Wave-2-9 may now begin building:

1. Migration: extend `profiles.role` check constraint to add `clinician`,
   `coach`, `health_manager` (per C4).
2. Migration: `clinician_invites` table mirroring `billing.org_invites` (per C1).
3. `proxy.ts` route gates for `/clinician/*` and `/coach/*` paths (per C4).
4. Patient consent surface in `/account` writing to `consent_records` (per C2).
5. Admin clinician-invite flow at `/admin/clinicians` (per C1).
6. Clinician portal entry point: `/clinician` landing → review workspace,
   schedule, profile (per C3, C5).
7. Janet-Clinician agent migration from text-sentinel to `tool_use` (per C6).
