# Clinician Portal — System Design

**Feature:** Epic 9 — The Care Team (Phase 5)  
**Date:** 2026-04-28  
**Status:** Pre-implementation (awaiting product owner sign-off)

---

## 1. Architecture overview

```
Browser (clinician)
  │
  ├── proxy.ts  ← role guard: /clinician/* requires role = 'clinician' | 'admin'
  │
  ├── app/(clinician)/layout.tsx
  │     └── ClinicianNav (sidebar: Dashboard, Patients, Reviews, Schedule)
  │
  ├── app/(clinician)/dashboard/page.tsx         ← Server Component
  ├── app/(clinician)/patients/page.tsx           ← Server Component
  ├── app/(clinician)/patients/[patientId]/page.tsx ← Server Component + Client tabs
  ├── app/(clinician)/reviews/page.tsx            ← Client Component (kanban + streaming)
  ├── app/(clinician)/schedule/page.tsx           ← Client Component
  └── app/(clinician)/notes/[patientId]/page.tsx  ← Client Component
       │
       ├── lib/supabase/server.ts   (all reads — RLS enforces patient_assignments)
       └── app/api/clinician/chat/route.ts  (Janet-Clinician real-time chat — streaming)
            └── lib/ai/janet-clinician.ts
```

---

## 2. Route protection

`proxy.ts` additions:

```typescript
// Add to existing protected routes
const CLINICIAN_ROUTES = ['/clinician']

// Role check for clinician routes
if (CLINICIAN_ROUTES.some(r => pathname.startsWith(r))) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  
  if (!profile || !['clinician', 'admin'].includes(profile.role)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
}
```

---

## 3. Data access layer

### 3.1 Reads — user Supabase client (RLS enforced)

All clinician reads go through `lib/supabase/server.ts`. RLS on `patient_assignments` automatically scopes results:

```typescript
// Returns only patients assigned to this clinician
const { data: patients } = await supabase
  .from('patient_assignments')
  .select(`
    patient_uuid,
    status,
    assigned_at,
    profiles!patient_uuid (full_name, date_of_birth, role),
    risk_scores (
      biological_age, composite_risk, risk_level,
      top_risk_drivers, computed_at
    ),
    care_notes (id, note_type, priority, content, created_at)
  `)
  .eq('clinician_uuid', clinicianUuid)
  .eq('status', 'active')
```

### 3.2 Writes — split by writer

| Write operation | Client | Reason |
|---|---|---|
| Clinician notes (`care_notes`) | user client | RLS allows clinician to write own notes |
| Appointment status update | user client | RLS allows clinician to update own appointments |
| Periodic review (AI section) | service-role | Pipeline worker; RLS denies user writes to AI section |
| `patient_assignments` create/delete | service-role | Admin operation only |

### 3.3 PatientContext for Janet-Clinician (real-time chat)

```typescript
// lib/ai/patient-context-clinician.ts
async function loadClinicianPatientContext(
  patientUuid: string,
  clinicianUuid: string,
  supabase: SupabaseClient
) {
  // Verify access before loading
  const { data: assignment } = await supabase
    .from('patient_assignments')
    .select('id')
    .eq('patient_uuid', patientUuid)
    .eq('clinician_uuid', clinicianUuid)
    .eq('status', 'active')
    .single()
  
  if (!assignment) throw new Error('Access denied')
  
  const [profile, riskScores, labResults, supplementPlan, reviews, careNotes] =
    await Promise.all([
      supabase.from('profiles').select('date_of_birth').eq('id', patientUuid).single(),
      supabase.from('risk_scores').select('*').eq('user_uuid', patientUuid).order('computed_at', { ascending: false }).limit(3),
      supabase.from('biomarkers.lab_results').select('*').eq('user_uuid', patientUuid).order('collected_at', { ascending: false }).limit(20),
      supabase.from('supplement_plans').select('*').eq('user_uuid', patientUuid).eq('status', 'active').single(),
      supabase.from('periodic_reviews').select('*').eq('patient_uuid', patientUuid).order('review_date', { ascending: false }).limit(6),
      supabase.from('care_notes').select('*').eq('patient_uuid', patientUuid).order('created_at', { ascending: false }).limit(10),
    ])
  
  return { profile, riskScores, labResults, supplementPlan, reviews, careNotes }
}
```

---

## 4. Screens and server actions

### 4.1 Dashboard (`/clinician/dashboard`)

**Type:** Server Component  
**Data fetched at render:** Aggregated counts from `patient_assignments`, `periodic_reviews`, `appointments`, `care_notes`

KPI cards:
- Patients assigned (count of active `patient_assignments`)
- Pending reviews (count of `periodic_reviews` where status = 'patient_submitted' or 'pending')
- Upcoming appointments (count of `appointments` where status = 'confirmed' and date > now)
- Unread alerts (count of `care_notes` where note_type = 'alert' and priority IN ('high','urgent'))

Recent activity feed: Last 10 `care_notes` + `periodic_reviews` events across all assigned patients.

---

### 4.2 Patient List (`/clinician/patients`)

**Type:** Server Component  
**Data:** `patient_assignments` JOIN `profiles` JOIN `risk_scores` (latest)

Table columns: Name | Bio-age | Risk level | Last check-in | Status | Actions  
Sort: default by risk_level DESC (most critical first)  
Filter: by status (active / inactive) — client-side after first load

---

### 4.3 Patient Detail (`/clinician/patients/[patientId]`)

**Type:** Server Component with client tab switching  
**Route guard:** Additional check that `patient_assignments` row exists for this clinician + patient pair

Tabs:

| Tab | Data source | Notes |
|---|---|---|
| Overview | `risk_scores` (latest), `supplement_plans`, `health_profiles` | Read-only summary |
| Check-in History | `periodic_reviews` (all, patient section) | Read-only; clinician can annotate |
| Biomarkers | `biomarkers.lab_results`, `biomarkers.daily_logs` | Charts via Recharts |
| Care Notes | `care_notes` (all where author = this clinician OR is_visible_to_patient = true) | Read + write |
| 30-Day Program | `periodic_reviews` (latest, clinician section) + Janet chat | Review workspace |

**Server action: `submitClinicalNote`**
```typescript
// app/(clinician)/patients/actions.ts
'use server'
async function submitClinicalNote(
  patientUuid: string,
  input: { note_type: string; content: string; priority: string; is_visible_to_patient: boolean; follow_up_date?: string }
) {
  // 1. Verify clinician has active assignment to this patient
  // 2. Insert into care_notes with author_uuid = clinician, author_role = 'clinician'
  // 3. If priority = 'urgent', trigger notification to admin
}
```

---

### 4.4 Review Workspace (`/clinician/reviews`)

**Type:** Client Component (real-time streaming, kanban state)  
**Data:** `periodic_reviews` filtered to assigned patients, ordered by status priority

This is the direct production equivalent of `ClinicianCheckinReview.jsx` from Base44, adapted to:
- Use `periodic_reviews` instead of `CheckinReview` entity
- Use the Next.js streaming API route instead of base44.agents
- Respect the `patient_assignments` RLS join (clinician sees only their queue)

**Status columns:**
```
patient_submitted  → Awaiting Review
clinician_reviewing → In Review
approved           → Program Ready
sent               → Sent to Patient
```

**Panel tabs:** Patient Card | Janet Chat | 30-Day Program (identical logic to Base44 prototype — see `docs/architecture/clinician-portal.md` §3)

**API route: `POST /api/clinician/chat`**
```typescript
// app/api/clinician/chat/route.ts
export async function POST(req: Request) {
  const { patientUuid, reviewId, message } = await req.json()
  
  // 1. Authenticate: verify clinician session
  // 2. Verify patient_assignments row exists
  // 3. Load ClinicianPatientContext (Promise.all, ~50ms)
  // 4. Build system prompt (janet_clinician persona + PatientContext)
  // 5. Stream response via Anthropic SDK
  // 6. Detect PROGRAM_READY signal in stream
  // 7. If PROGRAM_READY: server action to update periodic_reviews.status → 'approved'
  // 8. Persist turn to agent_conversations (non-blocking)
}
```

**Server action: `approveAndSendProgram`**
```typescript
async function approveAndSendProgram(reviewId: string, programText: string) {
  // 1. Update periodic_reviews: status = 'sent', clinician_notes = programText, approved_at = now
  // 2. Send email to patient via Resend (program content)
  // 3. Create care_notes row (type='review', is_visible_to_patient=true, author_role='clinician')
}
```

---

### 4.5 Schedule (`/clinician/schedule`)

**Type:** Client Component  
**Data:** `appointments` filtered to clinician_uuid + `clinician_profiles` for own profile

Views: Upcoming | Past | My Profile

**Server action: `updateAppointmentStatus`**
```typescript
async function updateAppointmentStatus(
  appointmentId: string,
  status: 'confirmed' | 'completed' | 'no_show' | 'cancelled',
  clinicianNotes?: string
) {
  // Update appointments row — user client (clinician_uuid RLS check)
}
```

**Server action: `upsertClinicianProfile`**
```typescript
async function upsertClinicianProfile(data: ClinicianProfileInput) {
  // Upsert clinician_profiles on conflict(user_uuid)
  // Validate: available_from < available_to
  // Validate: all available_days in 0–6
}
```

---

## 5. Janet-Clinician Brief — pipeline worker

**Priority:** P4 (build in Phase 5)  
**Type:** Pipeline worker (async, monthly cron)  
**Trigger:** `POST /api/cron/clinician-brief` — Vercel Cron on 1st of each month  
**Auth:** `x-pipeline-secret` header check

```typescript
// app/api/cron/clinician-brief/route.ts
export async function POST(req: Request) {
  // 1. Verify x-pipeline-secret header
  // 2. Fetch all active patient_assignments
  // 3. For each assignment, in parallel (batched):
  //    a. Load patient context (admin client — reads patient data for pipeline)
  //    b. Build clinical brief prompt
  //    c. Call claude-sonnet-4-6 (no streaming, awaited)
  //    d. Zod validate output (brief + program suggestion + flags)
  //    e. Upsert periodic_reviews row (status = 'pending', AI section populated)
  //    f. Upsert care_notes row (type='review', author_role='ai', is_visible_to_patient=false)
  //    g. If output.flags.length > 0: upsert care_notes (type='alert', priority='urgent')
  // 4. Return { processed: N, failed: M }
}
```

**Output schema (Zod):**
```typescript
const ClinicalBriefSchema = z.object({
  ai_summary: z.string().max(500),
  overall_sentiment: z.enum(['positive', 'neutral', 'concerning', 'critical']),
  top_findings: z.array(z.string()).max(5),
  program_suggestion: z.string(),  // Draft 30-day program for clinician to review
  flags: z.array(z.object({
    domain: z.string(),
    severity: z.enum(['warning', 'urgent']),
    description: z.string(),
  })),
})
```

**Idempotency key:** `(patient_uuid, clinician_uuid, review_date)` — upsert on conflict.

---

## 6. Patient care-team consent flow

Before a `patient_assignments` row is created, the patient must consent. This is an AHPRA requirement.

```
Patient: "Invite Dr Smith to my care team"
  │
  ▼
Server action: initiateCareteamInvite(clinicianUuid)
  │
  ├── Fetch clinician_profiles for display (name, specialties, photo)
  ├── Show consent modal: "You are granting Dr Smith access to your health data…"
  └── Patient clicks "Grant Access"
        │
        ▼
     Server action: grantCareTeamAccess(clinicianUuid, consentDetails)
       1. Insert consent_records row (policy_id='care_team_access', policy_version='v1')
       2. Insert patient_assignments row (patient_uuid, clinician_uuid, status='active')
       3. Send notification email to clinician
```

Consent record columns captured: user_uuid, policy_id, policy_version, accepted_at, ip_address, user_agent.

---

## 7. Environment variables

New variables required:

```bash
CLINICIAN_BRIEF_CRON_SECRET    # x-pipeline-secret for monthly brief cron
```

Add to `.env.example` and Vercel environment (preview + production).

---

## 8. proxy.ts registration

New protected routes to add:

```typescript
const PROTECTED_ROUTES = [
  '/dashboard',
  '/onboarding',
  '/admin',
  '/report',
  '/account',
  '/clinician',   // ← NEW: requires role = clinician | admin
]
```

---

## 9. Test plan

| Test | Type | Coverage |
|---|---|---|
| `proxy.ts` redirects non-clinician from `/clinician/*` | Playwright | Route guard |
| Clinician cannot read patients not in their `patient_assignments` | Vitest + Supabase local | RLS |
| `submitClinicalNote` rejects if no active assignment | Vitest | Server action |
| `approveAndSendProgram` creates care_notes row + sends email | Vitest | Server action |
| `upsertClinicianProfile` validates time ordering | Vitest | Input validation |
| Brief pipeline is idempotent when run twice | Vitest | Pipeline worker |
| PROGRAM_READY signal correctly captured in stream | Vitest | Agent output parsing |
| Patient consent creates both consent_records + patient_assignments | Vitest | Consent flow |
