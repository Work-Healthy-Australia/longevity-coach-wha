# Clinician Portal — Decisions Log
Date: 2026-04-29
Status: PENDING — awaiting James review session

This file captures decisions from the Clinician Portal review session driven by
the Sprint 2 plan (`docs/engineering/plan/sprint-1/2026-04-29-plan-business-features.md`,
Step 13). The session is **not yet held**: every entry below is `PENDING` until
James reviews `docs/architecture/clinician-portal.md` and records a verdict.

Plan B Wave-2-9 (clinician portal UI build) must NOT begin until C1–C6 are
resolved.

---

## C1 — Clinician invitation flow

**Question:** How does an admin invite a clinician? The Base44 prototype assumes
the clinician already exists in the system; the email-invite onboarding path was
absent.

**Status:** PENDING

**Default proposal (subject to James):** mirror the existing admin-invite flow
in `app/(admin)/admin/admins/actions.ts` — admin sends an email invite, the
invitee accepts via a single-use token, and the role is assigned on accept.
Reuse `billing.org_invites` shape (single-use token, 14-day expiry, append-only
status enum) but in a separate `clinician_invites` table to keep care-team and
billing concerns isolated.

---

## C2 — Patient consent for care-team access

**Question:** AHPRA requires a `consent_records` row before a clinician can see
a patient. Where does the patient grant this — onboarding, or a separate consent
surface?

**Status:** PENDING

**Default proposal:** new step in `/account` (or onboarding's consent step) —
"Care team access" — patient explicitly nominates a clinician by email. Consent
record written to `consent_records` (append-only, never updated, per
`.claude/rules/security.md`).

---

## C3 — Appointment booking direction

**Question:** Does the patient see available slots and book, or does the
clinician initiate?

**Status:** PENDING

**Default proposal:** clinician initiates in v1 (matches Base44). Patient-facing
self-booking deferred until calendar integration (Phase 5+).

---

## C4 — Role expansion sign-off

**Question:** `profiles.role` currently allows `user` and `admin`. Expanding to
`clinician`, `coach`, `health_manager` requires a migration and `proxy.ts`
changes.

**Status:** PENDING

**Default proposal:** add the four new roles in one migration. `health_manager`
is already on `billing.organisation_members.role` — extend `profiles.role`'s
check constraint to align.

---

## C5 — Check-in review cadence

**Question:** Base44 runs check-in reviews monthly. Confirm: monthly per Epic 9
spec, or triggered per check-in?

**Status:** PENDING

**Default proposal:** monthly bulk review (matches Base44 + the
`pt-plan` / `clinician-briefs` cron schedule already in `vercel.json`).

---

## C6 — `PROGRAM_READY` signal

**Question:** Base44 prototype uses a text sentinel in the agent stream to
trigger program delivery. Carry the pattern across, or replace with a structured
`tool_use` result?

**Status:** PENDING

**Default proposal:** structured `tool_use` is the project convention
(`.claude/rules/ai-agents.md` — Janet sub-agent pattern). Replace the text
sentinel; the Base44 streaming pattern was a workaround for an environment
without tool-call results.

---

## How to use this document

1. James reviews `docs/architecture/clinician-portal.md` end-to-end.
2. For each entry above, James either accepts the default proposal (write
   "ACCEPTED — see proposal above" plus initials and date) or records a
   different decision with rationale.
3. Once all six are resolved, set the file `Status:` line to `RESOLVED YYYY-MM-DD`
   and Plan B Wave-2-9 can begin.
