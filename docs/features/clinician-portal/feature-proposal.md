# Feature Proposal — Clinician Portal

**Epic:** Epic 9 — The Care Team  
**Phase:** Phase 5 — Care Network  
**Owner:** James Murray  
**Drafter:** Claude Code (2026-04-28)  
**Status:** AWAITING PRODUCT OWNER SIGN-OFF before implementation begins

> Phase 5 work requires explicit sign-off. Do not start implementation without confirmation.

---

## Problem statement

Clinicians assigned to Longevity Coach patients currently have no first-party interface. They cannot see the patient's risk picture, review check-in history, write clinical notes, or approve the monthly 30-day health program — all of which are required for the care-team model (Epic 9) to work.

The Base44 prototype proved the core UX (check-in review workspace + Janet-Clinician collaboration). This proposal translates those proven patterns into the production Next.js app.

---

## Scope

### In scope (Phase 5 — Epic 9)

| Story | Reference |
|---|---|
| Clinician can access a secure portal showing assigned patients | 5.1.1 |
| Clinician can review bio-age, domain risk, biomarkers, and supplement protocol on one screen | 5.1.2 |
| Clinician can read and write structured clinical notes | 5.1.3 |
| Clinician can review daily check-in history | 5.1.4 |
| Clinician receives alerts when a marker moves outside a safe range | 5.1.5 |
| Member can invite a clinician by sending a secure invitation | 5.2.1 |
| Member controls which data a care team member can access | 5.2.2 |
| Member can revoke care team access | 5.2.3 |

### Out of scope (Phase 5 deferral)

- In-platform appointment booking / calendar integration (5.2.4) — deferred to Phase 6
- Community feed and challenges (5.3.x) — separate epic
- Corporate portal — already separate (`app/(admin)/`)
- Janet-Clinician real-time chat during appointment — deferred; monthly brief pipeline is Phase 5

---

## Build order (per `new-feature` workflow)

```
1. Migration: expand profiles.role + add clinician_profiles + add appointments tables
2. Type regeneration
3. proxy.ts: add /clinician/* route protection (role = clinician)
4. Route group: app/(clinician)/
5. Server actions
6. UI components
7. Janet-Clinician Brief pipeline worker (P4 in ai-agents.md)
8. Tests
```

---

## Database changes required

### 1. Expand `profiles.role` constraint (migration 0038 or next)

Current: `CHECK role IN ('user', 'admin')`  
Required: `CHECK role IN ('user', 'admin', 'clinician', 'coach', 'health_manager')`

**PII note:** `clinician_profiles` stores professional data that is NOT PII (specialties, bio, working hours). The clinician's name and contact details are PII and live on `profiles`. Do not duplicate PII columns on `clinician_profiles`.

### 2. New table: `clinician_profiles`

Stores professional identity for clinicians. One row per clinician user.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_uuid | uuid NOT NULL UNIQUE | FK → auth.users(id) ON DELETE CASCADE |
| title | text | e.g. 'Dr.', 'Dr Med.' |
| specialties | text[] NOT NULL DEFAULT '{}' | e.g. ['longevity', 'metabolic'] |
| interests | text[] NOT NULL DEFAULT '{}' | Clinical research interests |
| bio | text | |
| photo_url | text | |
| qualifications | text | e.g. 'MB BCh, MRCGP, Dip Longevity Medicine' |
| languages | text[] NOT NULL DEFAULT '{"English"}' | |
| session_duration_minutes | smallint NOT NULL DEFAULT 30 | |
| available_days | smallint[] NOT NULL DEFAULT '{1,2,3,4,5}' | 0=Sun … 6=Sat |
| available_from | time NOT NULL DEFAULT '09:00' | |
| available_to | time NOT NULL DEFAULT '17:00' | |
| lunch_break_from | time | |
| lunch_break_to | time | |
| timezone | text NOT NULL DEFAULT 'Australia/Sydney' | |
| video_link | text | Default meeting link |
| is_active | boolean NOT NULL DEFAULT true | |
| created_at | timestamptz NOT NULL DEFAULT now() | |
| updated_at | timestamptz NOT NULL DEFAULT now() | |

**Writer:** Admin (creates); clinician (updates own record).  
**RLS:** Public read (clinician directory); clinician update own; admin all.

### 3. New table: `appointments`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| patient_uuid | uuid NOT NULL | FK → auth.users(id) ON DELETE CASCADE |
| clinician_uuid | uuid NOT NULL | FK → auth.users(id) ON DELETE RESTRICT |
| appointment_date | date NOT NULL | |
| start_time | time NOT NULL | |
| duration_minutes | smallint NOT NULL DEFAULT 30 | |
| status | text NOT NULL DEFAULT 'confirmed' | CHECK in ('confirmed','completed','no_show','cancelled') |
| video_link | text | |
| patient_notes | text | |
| clinician_notes | text | |
| created_at | timestamptz NOT NULL DEFAULT now() | |
| updated_at | timestamptz NOT NULL DEFAULT now() | |

**Writer:** Admin or future booking system (insert); clinician (update status + notes); patient (update patient_notes).  
**RLS:** Patient reads own; clinician reads own assigned; admin all.

Index: `(clinician_uuid, appointment_date, start_time)`, `(patient_uuid, appointment_date DESC)`.

---

## AI execution model

The Janet-Clinician component in this app differs from the Base44 prototype:

| | Base44 prototype | longevity-coach-wha |
|---|---|---|
| Execution | Real-time agent (conversational, per review session) | Pipeline worker (monthly cron per assignment) + real-time chat on-demand |
| Trigger | Clinician opens review card | 1st of month cron per active `patient_assignments` row |
| Output | 30-day program in CheckinReview | Clinical brief + program suggestion in `periodic_reviews` + `care_notes` |
| Agent rule | P4 in `ai-agents.md` | Build in Phase 5 only |

The pipeline worker pre-generates the clinical brief (so it is instant when the clinician opens the patient). The real-time chat is additive — clinicians can converse with Janet after reading the brief to refine the program.

---

## Route structure

```
app/
  (clinician)/
    layout.tsx              ← clinician shell (sidebar nav, role guard)
    dashboard/
      page.tsx              ← KPI cards + recent activity
    patients/
      page.tsx              ← assigned patient list
      [patientId]/
        page.tsx            ← patient detail (tabbed)
        actions.ts
    reviews/
      page.tsx              ← check-in review workspace (kanban + detail)
      actions.ts
    schedule/
      page.tsx              ← appointment list + profile editor
      actions.ts
    notes/
      [patientId]/
        page.tsx            ← care notes for a patient
        actions.ts
```

---

## Security checklist (pre-implementation)

- [ ] `proxy.ts` must gate `/clinician/*` to `role = clinician` (and `admin`)
- [ ] Clinician reads ONLY use the user-context Supabase client (RLS enforces `patient_assignments` join)
- [ ] Janet-Clinician pipeline uses service-role client for writes to `periodic_reviews` and `care_notes`
- [ ] `care_notes.is_visible_to_patient` defaults to `false` — explicit opt-in per note
- [ ] Patient consent for care-team access must be captured via `consent_records` (AHPRA requirement) before any `patient_assignments` row is created
- [ ] New env var `CLINICIAN_BRIEF_CRON_SECRET` required for cron authentication

---

## Success criterion (from Epic 9)

> A clinician opening a patient for the first time can summarise the patient's risk picture in under 3 minutes.  
> Patient consent for care-team access is captured via the consent-record flow (AHPRA audit).
