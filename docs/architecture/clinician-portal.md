# Clinician Portal — Architecture Reference

**Source:** Abstracted from `base-44-longevity-coach` prototype (verified 2026-04-28).  
**Status in longevity-coach-wha:** Designed but not yet built — Phase 5 (Epic 9 — The Care Team).

This document captures every design decision proven in the Base44 prototype so that the production implementation does not re-derive them from scratch. Nothing here is speculative — every item was read from working source code or a validated entity schema.

---

## 1. What the prototype built

### 1.1 Pages

| Page | File (base-44) | Purpose |
|---|---|---|
| Clinician Review Workspace | `src/pages/ClinicianCheckinReview.jsx` | Tier 2 check-in review: kanban queue + Janet chat + 30-day program approval |
| Clinician Schedule | `src/pages/ClinicianSchedule.jsx` | Appointment list (upcoming/past) + post-session notes + clinician profile editor |
| Corporate Portal | `src/pages/CorporatePortal.jsx` | Employer-facing aggregate dashboard — separate from the clinical portal |

### 1.2 Entities (base44 schema)

| Entity | Key fields | RLS pattern |
|---|---|---|
| `ClinicianProfile` | user_email, full_name, title, specialties, interests, bio, qualifications, languages, available_days/from/to, lunch_break, session_duration_minutes, timezone, video_link, is_active | Read: public. Write: own record or admin. |
| `CheckinReview` | checkin_id, patient_email, clinician_email, month_year, status (enum), janet_brief, clinician_conversation_id, program_30_day, program_sent_at, clinician_notes | Read: own patient row OR own clinician_email OR role=clinician/admin. Update: own clinician_email or admin. |
| `PatientAssignment` | patient FK, clinician FK, status | Clinician reads own assigned patients only. |
| `Appointment` | patient_email, clinician_email, appointment_date, start_time, status, video_link, patient_notes, clinician_notes | Clinician reads own appointments. |

### 1.3 Agent: `janet_clinician`

- **Model:** `claude-sonnet-4-6`
- **Execution model:** Real-time agent (conversational, streaming)
- **Role in workflow:** Briefs clinician on a patient's monthly check-in data, answers clinical questions, then co-creates the 30-day health program on request.
- **Persona:** Janet speaking *to a clinician colleague*, not to a patient — professional, evidence-based, concise.
- **Tool reads:** `MonthlyCheckin`, `UserProfile`, `LabResult`, `Medication`, `RiskAssessment`, `HealthAssessment`, `Supplement`, `PatientAssignment`
- **Tool writes:** `CheckinReview` (status + clinician_conversation_id + program_30_day)
- **Completion signal:** Agent outputs `PROGRAM_READY` on its own line; UI captures this, strips the marker, surfaces the program in a dedicated tab, and transitions review status to `program_ready`.

### 1.4 Role system (`src/lib/roles.js`)

```
ROLES = {
  SYSTEM_ADMIN, CRM_MANAGER, CLINICIAN, COACH,
  CORPORATE_ADMIN, CORPORATE_HEALTH_MANAGER, PATIENT,
  ADMIN, USER  // legacy
}

canAccess.clinicalNotes(user)   → SYSTEM_ADMIN | ADMIN | CLINICIAN
canAccess.coaching(user)        → SYSTEM_ADMIN | ADMIN | CLINICIAN | COACH
canAccess.staff(user)           → all non-patient roles
```

---

## 2. Workflow: check-in review

```
Patient submits monthly check-in
  │
  ▼ (automated)
Janet generates janet_brief (structured patient summary)
CheckinReview row created → status: awaiting_clinician
  │
  ▼ (clinician opens workspace)
Clinician selects review card → reads patient_card tab
Clicks "Start review with Janet" → janet_clinician agent initialised
  │
  ▼ (conversation)
Janet briefs clinician (check-in data, risk flags, adherence, stress)
Clinician asks questions, gives directives
  │
  ▼ (program generation)
Clinician: "generate the 30-day program"
Janet produces structured plan → appends PROGRAM_READY marker
UI captures signal → CheckinReview.status = program_ready
  │
  ▼ (clinician review)
Clinician reviews program text → edits if needed
Clicks "Approve & send to patient"
  │
  ▼ (delivery)
CheckinReview.status = sent_to_patient
Patient notified via email with program content
```

### Status enum (proven in production)

| Status | Meaning |
|---|---|
| `awaiting_clinician` | Check-in submitted; no clinician has opened it |
| `in_review` | Clinician has opened; Janet conversation started |
| `program_ready` | Janet emitted PROGRAM_READY signal |
| `sent_to_patient` | Clinician approved and email sent |

---

## 3. Review workspace UI patterns

### Left panel (queue)
- Grouped by status column (vertical stacked, not horizontal kanban — mobile-first)
- `PatientCard` shows: patient identifier, month, status badge, sentiment icon, adherence score, stress level flag (≥ 7/10)
- Urgent flag: `overall_sentiment === 'needs_attention' || stress_level >= 8` → red background

### Right panel (detail) — tabs
| Tab | Content |
|---|---|
| Patient Card | Janet's AI summary (teal callout) + structured check-in fields (wins, adherence, stress, goals, support, open space) |
| Janet Chat | Real-time streaming chat; agent initialises on first open; persists conversation_id to resume |
| 30-Day Program | Program text in editable textarea (pre-populated from PROGRAM_READY output); "Approve & send" CTA |

### Sentiment/adherence signals
```
thriving       → 🌟 emerald
on_track       → ✅ green
struggling     → ⚠️ amber
needs_attention → 🚨 red  (also triggers urgent flag)
```

---

## 4. Schedule UI patterns

### Views: `upcoming | past | profile`
- **Upcoming:** Confirmed appointments in future (sorted asc by date)
- **Past:** Non-confirmed or past datetime (sorted desc)
- **Profile:** Self-service clinician profile editor

### `AppointmentRow` (expandable)
- Collapsed: patient identifier, date/time, status badge
- Expanded: patient note, video link, "Start Live Session" link, status transition buttons, post-session notes textarea

### Status transitions (clinician-initiated)
`confirmed → completed | no_show | cancelled`
`no_show → confirmed | completed | cancelled`

### Clinician profile fields
Identity: title, full_name, qualifications  
Professional: specialties (array), interests (array), bio  
Contact: contact_email, phone, languages (array), video_link  
Working hours: available_days (0–6 bitmask), available_from, available_to, lunch_break_from/to, session_duration_minutes, timezone

---

## 5. Key design decisions from prototype

| Decision | Rationale |
|---|---|
| janet_brief pre-generated before clinician opens | Clinician sees summary instantly; no LLM wait in the UI |
| conversation_id persisted on CheckinReview | Resumable sessions across browser refreshes / logins |
| PROGRAM_READY as a text signal, not a tool call | Simpler to detect in streaming; avoids structured output parsing mid-stream |
| Admin sees all unassigned reviews; clinician sees only assigned | Role-gated queue separation — admins can triage unassigned work |
| Email notification on send, not on program_ready | Clinician has editorial control; patient only gets email after explicit approval |
| Profile fields: is_active boolean | Soft-delete for clinicians who leave; preserves historical appointment data |

---

## 6. Mapping to longevity-coach-wha schema

| Base44 entity | longevity-coach-wha equivalent | Delta |
|---|---|---|
| `ClinicianProfile` | Not yet migrated | Needs new table `clinician_profiles` |
| `CheckinReview` | `periodic_reviews` | periodic_reviews is more complete (patient section + AI section + clinician section) — use it |
| `PatientAssignment` | `patient_assignments` | Already in migration 0011 ✓ |
| `Appointment` | Not yet migrated | Needs new table `appointments` |
| `CareTeamShare` | `patient_assignments` | Same concept ✓ |
| `ClinicalNote` | `care_notes` | Already in migration 0011 ✓ |
| `CoachSuggestion` | `coach_suggestions` | Already in migration 0011 ✓ |
| `janet_clinician` agent | Janet-Clinician Brief pipeline (P4) | Execution model differs: base44 = real-time; wha = pipeline worker (monthly cron) |

### Role system delta

`profiles.role` in longevity-coach-wha currently has `CHECK in ('user', 'admin')`. Clinician portal requires expanding this constraint to include `'clinician'`, `'coach'`, `'health_manager'`. Migration required before any role-gated routes can be protected via `proxy.ts`.

---

## 7. What the prototype did NOT build

These were absent from the base-44 prototype and must be designed from scratch:

- Clinician onboarding / invitation flow (admin sends invite → clinician accepts → role assigned)
- Patient consent capture for care-team access (AHPRA requirement — `consent_records` row)
- Clinician-patient assignment UI (admin assigns patient to clinician)
- Out-of-range biomarker alert feed
- Appointment booking from the patient side (5.2.4)
- Periodic review scheduler (monthly cron triggering Janet-Clinician brief)
