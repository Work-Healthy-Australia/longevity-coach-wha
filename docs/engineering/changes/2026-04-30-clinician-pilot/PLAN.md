# Clinician Pilot Runbook

**Date:** 2026-04-30
**Purpose:** Step-by-step walkthrough for running the first clinician pilot through the review workspace at `/clinician`. Covers pre-flight checks, the full review lifecycle, verification points, and known gaps.

---

## Pre-flight Checklist

Complete every item before the clinician opens `/clinician`.

### 1. Clinician user exists with correct role

```sql
SELECT id, full_name, role, is_admin
FROM public.profiles
WHERE role = 'clinician';
```

- `role` must be `'clinician'` (constraint: `profiles_role_check` allows `user`, `admin`, `clinician`, `coach`, `health_manager`).
- If the clinician was invited via `/admin/clinicians`, verify the `clinician_invites` row has `status = 'accepted'`.

### 2. Clinician profile is complete and active

```sql
SELECT user_uuid, full_name, qualifications, specialties, is_active,
       available_days, available_from, available_to, timezone
FROM public.clinician_profiles
WHERE user_uuid = '<CLINICIAN_UUID>';
```

- `is_active` must be `true`.
- `full_name` must be populated (used in the program delivery email as `clinicianName`).
- The clinician can self-edit at `/clinician/profile` (backed by `clinician_profiles_self_update` RLS policy).

### 3. Target patient has sufficient data

| Requirement | How to verify |
|---|---|
| Completed health profile | `SELECT id FROM health_profiles WHERE user_uuid = '<PATIENT_UUID>' AND status = 'complete';` |
| Risk scores computed | `SELECT * FROM risk_scores WHERE user_uuid = '<PATIENT_UUID>' ORDER BY created_at DESC LIMIT 1;` |
| At least 7 days of daily logs | `SELECT count(*) FROM biomarkers.daily_logs WHERE user_uuid = '<PATIENT_UUID>';` (must be >= 7) |
| At least 1 lab upload | `SELECT id FROM public.patient_uploads WHERE user_uuid = '<PATIENT_UUID>' AND upload_type = 'lab_result';` |

If any of these are missing, the Janet clinician agent will still function but its context will be thin (it loads patient context via `loadPatientContext()` which pulls risk scores, supplement plans, recent labs, and daily logs).

### 4. Patient assignment row exists

```sql
SELECT id, status, assigned_at
FROM public.patient_assignments
WHERE patient_uuid = '<PATIENT_UUID>'
  AND clinician_uuid = '<CLINICIAN_UUID>'
  AND status = 'active';
```

This row is required for non-admin clinicians. The layout at `/clinician` checks `patient_assignments` to filter the review queue (see `app/clinician/page.tsx` lines 86-91). Admin users bypass this filter.

If missing, insert:

```sql
INSERT INTO public.patient_assignments (patient_uuid, clinician_uuid, status)
VALUES ('<PATIENT_UUID>', '<CLINICIAN_UUID>', 'active');
```

---

## Step-by-step Walkthrough

### Step 1: Create a periodic review in `awaiting_clinician` status

The clinician-brief pipeline (`lib/ai/pipelines/clinician-brief.ts`) normally creates reviews automatically. For the pilot, seed one manually:

```sql
INSERT INTO public.periodic_reviews (
  patient_uuid,
  clinician_uuid,
  review_type,
  review_date,
  review_month,
  review_status,
  -- Patient-submitted section (simulate a completed check-in)
  wins,
  adherence_score,
  adherence_notes,
  stress_level,
  stress_notes,
  next_goals,
  support_needed,
  open_space,
  overall_sentiment,
  patient_submitted_at,
  -- AI section (simulate pipeline output)
  janet_brief,
  ai_summary,
  ai_processed_at
) VALUES (
  '<PATIENT_UUID>',
  '<CLINICIAN_UUID>',
  'monthly',
  current_date,
  date_trunc('month', current_date),
  'awaiting_clinician',
  ARRAY['Completed 5/7 supplement days', 'Started morning walks'],
  72,
  'Missed evening supplements 2x/week — forgetfulness, not resistance.',
  5,
  'Work deadline next week; otherwise manageable.',
  ARRAY['Increase adherence to 85%', 'Add 10 min stretching routine'],
  'Would like guidance on sleep optimisation.',
  'Considering adding magnesium glycinate — is this safe with current stack?',
  'positive',
  now(),
  'Patient showing solid adherence with room for evening routine improvement. Stress is moderate and situational. Sleep quality is the main area of concern — consider adding magnesium glycinate if not contraindicated by current protocol.',
  'Monthly review for April 2026. Key focus: sleep optimisation and evening supplement adherence.',
  now()
);
```

Note the `review_status` column (added in migration `0042`) with its own status lifecycle: `awaiting_clinician` -> `in_review` -> `program_ready` -> `sent_to_patient`. This is separate from the original `status` column (migration `0011`) which tracks the patient-side lifecycle: `pending` -> `patient_submitted` -> `clinician_reviewing` -> `approved` -> `sent`.

### Step 2: Clinician opens `/clinician`

- The layout (`app/clinician/layout.tsx`) verifies `role = 'clinician'` OR `is_admin = true` via the admin client. Unauthorized users are redirected to `/dashboard`.
- The page loads all `periodic_reviews` rows, filtered to the clinician's assigned patients (unless admin).
- Reviews are grouped by `review_status` into four columns: **Awaiting clinician**, **In review**, **Program ready**, **Sent to patient**.
- Reviews with `overall_sentiment = 'needs_attention'` or `stress_level >= 8` are flagged as urgent (red badge, sorted to top).

**Expected:** The seeded review appears under "Awaiting clinician" with patient identifier `Patient <first-8-chars-of-uuid>`.

### Step 3: Clinician clicks the patient card

- URL becomes `/clinician?id=<REVIEW_UUID>`.
- The `ReviewDetail` component renders with three tabs: **Patient card**, **Janet chat**, **30-Day program**.
- Patient card tab shows: Janet's brief, wins, adherence score + notes, stress level + notes, next goals, support needed, open space.
- A "Start review" button appears (only when `review_status = 'awaiting_clinician'`).

### Step 4: Clinician clicks "Start review"

- Calls `startReview()` server action (`app/clinician/actions.ts`).
- Updates `review_status` from `awaiting_clinician` to `in_review`.
- The action includes a guard: `.eq("review_status", "awaiting_clinician")` so double-clicks are safe.

**Verify:**

```sql
SELECT review_status FROM periodic_reviews WHERE id = '<REVIEW_UUID>';
-- Expected: 'in_review'
```

### Step 5: Clinician reviews patient data on Patient card tab

The clinician reads:
- **Janet's brief** — AI-generated summary from the clinician-brief pipeline
- **Wins** — patient-reported achievements
- **Adherence** — score out of 100 with notes
- **Stress** — level 1-10 with notes
- **Next goals** — patient-stated goals
- **Support needed** — patient's request for help
- **Open space** — freeform patient input

### Step 6: Clinician switches to Janet chat tab

- The `ClinicianJanetChat` component (`app/clinician/_components/janet-chat.tsx`) uses the Vercel AI SDK `useChat` hook.
- Chat hits `POST /api/clinician/chat` which verifies the caller is the assigned clinician or admin.
- The route calls `streamClinicianTurn()` from `lib/ai/agents/janet-clinician.ts`.
- Janet loads full patient context via `loadPatientContext()` (risk scores, supplement plan, recent labs, daily logs) and the review's structured check-in data.
- Three suggested starters are shown: "What stands out in this month's check-in?", "What's the biggest adherence concern?", "Draft the 30-day program."

**Expected:** Janet responds conversationally with clinical context. The clinician can ask follow-up questions.

### Step 7: Clinician asks Janet to draft the 30-day program

- When the clinician says "Draft the 30-day program" (or similar), Janet calls the `submit_30_day_program` tool.
- The tool (`lib/ai/tools/submit-program-tool.ts`) writes the program body to `periodic_reviews.program_30_day` and flips `review_status` to `program_ready`.
- The tool requires `program_30_day` to be at least 80 characters (Zod `.min(80)` validation).
- In the chat, the tool call renders as: *"Janet drafted the 30-day program — open the program tab to review and approve."*

**Verify:**

```sql
SELECT review_status, length(program_30_day) as program_length
FROM periodic_reviews
WHERE id = '<REVIEW_UUID>';
-- Expected: review_status = 'program_ready', program_length >= 80
```

### Step 8: Clinician switches to 30-Day program tab

- The program text appears in an editable `<textarea>`.
- Two actions are available:
  - **Save draft** — calls `saveProgram()`, keeps `review_status = 'program_ready'`, saves edits.
  - **Approve & send to patient** — calls `approveAndSend()`, the final action.

The clinician can edit Janet's draft before approving.

### Step 9: Clinician clicks "Approve & send to patient"

- `approveAndSend()` server action (`app/clinician/actions.ts`):
  1. Validates program is non-empty.
  2. Updates `periodic_reviews` row: `review_status = 'sent_to_patient'`, `program_sent_at = now()`, `approved_at = now()`.
  3. Looks up patient email from `auth.users` and names from `profiles`.
  4. Calls `sendProgramDeliveryEmail()` from `lib/email/program-delivery.ts`.
  5. Email failure is **non-fatal** — the status transition has already landed. The patient can see the program in-app even if Resend rejects.

**Verify:**

```sql
SELECT review_status, program_sent_at, approved_at,
       length(program_30_day) as program_length
FROM periodic_reviews
WHERE id = '<REVIEW_UUID>';
-- Expected: review_status = 'sent_to_patient',
--           program_sent_at IS NOT NULL, approved_at IS NOT NULL
```

### Step 10: Patient receives program delivery email

- Email subject: "Your 30-day program is ready"
- Sent from the configured `RESEND_FROM_EMAIL` address.
- Body includes: greeting with patient name, clinician name attribution, full program in `<pre>` block, "Open my dashboard" CTA linking to `/dashboard`.
- Plain-text fallback is also sent.

**Verify in Resend dashboard:** Check the email was delivered. If `RESEND_API_KEY` is absent, the email silently no-ops.

---

## Verification Points

| Check | Table / endpoint | Expected state |
|---|---|---|
| Review status lifecycle | `periodic_reviews.review_status` | `awaiting_clinician` -> `in_review` -> `program_ready` -> `sent_to_patient` |
| Program body populated | `periodic_reviews.program_30_day` | Non-null, >= 80 chars |
| Approval timestamp set | `periodic_reviews.approved_at` | Non-null `timestamptz` |
| Send timestamp set | `periodic_reviews.program_sent_at` | Non-null `timestamptz` |
| Patient email delivered | Resend dashboard | Status: delivered |
| Janet chat functional | `POST /api/clinician/chat` | 200 with streaming response |
| Auth guard works | Visit `/clinician` as non-clinician | Redirected to `/dashboard` |
| Assignment filter works | Visit `/clinician` as clinician without assignment | Review queue is empty |

---

## Known Gaps and Risks

### Functional gaps

1. **No automated review creation.** The `clinician-brief` cron pipeline (`app/api/cron/clinician-briefs/route.ts`) creates reviews, but its trigger conditions and scheduling have not been verified end-to-end. For the pilot, reviews must be seeded manually per the SQL in Step 1.

2. **Conversation persistence not wired.** The `clinician_conversation_id` column exists on `periodic_reviews` (migration `0050`) but is not populated. Each page reload starts a fresh Janet chat session. Chat history is lost on navigation. This is noted in the code as "Wave 10 will populate this."

3. **Program tab hidden value stale on edit.** In the `ProgramTab` component, the "Approve & send" form uses a hidden input with `value={review.program_30_day ?? ""}` which reflects the server-rendered value, not the clinician's edits in the textarea. If the clinician edits the program and clicks "Approve & send" without first clicking "Save draft", the sent program will be the pre-edit version. Workaround: always click "Save draft" before "Approve & send", then reload the page.

4. **No patient-facing view of the program.** The program is stored on `periodic_reviews.program_30_day` and emailed, but there is no patient-facing UI route to view the program in-app. The email CTA links to `/dashboard` which does not surface the program.

5. **TypeScript types not regenerated.** Multiple files reference `program_30_day`, `program_sent_at`, `review_status`, and `review_month` via the `loose()` helper to bypass type checking. These columns were added in migrations `0042` and `0050` but the generated types in `lib/supabase/database.types.ts` have not been regenerated.

6. **`overall_sentiment` mismatch.** Migration `0011` defines the check constraint as `('positive', 'neutral', 'concerning', 'critical')`, but `page.tsx` checks for `'needs_attention'` as the urgent sentinel. Reviews flagged `concerning` or `critical` will not trigger the urgent badge. The `isUrgent()` function should check for `concerning` or `critical` instead.

### Security considerations

- The clinician page uses `createAdminClient()` to bypass RLS for reading all reviews. This is acceptable because the layout already gates entry, but it means the page trusts the layout auth check completely.
- The `/api/clinician/chat` route performs its own auth check (role + assignment verification) independent of the layout, which is correct.

### Operational risks

- **Resend rate limits.** If multiple programs are approved in quick succession, Resend rate limits may cause silent email failures. The `approveAndSend` action catches email errors gracefully and reports status to the clinician.
- **No rollback on status.** Once a review reaches `sent_to_patient`, there is no UI action to revert it. Manual SQL update is required if the clinician sends prematurely.
- **ANTHROPIC_API_KEY required.** Janet chat will fail if the API key is missing or invalid. The error surfaces as a generic failure in the chat UI. Verify the key is set in the deployment environment before the pilot.

---

## Environment requirements

| Variable | Required for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All Supabase queries |
| `SUPABASE_SECRET_KEY` | Admin client (review queries, status updates) |
| `ANTHROPIC_API_KEY` | Janet clinician chat |
| `RESEND_API_KEY` | Program delivery email (silent no-op if absent) |
| `RESEND_FROM_EMAIL` | Sender address for program email |
| `NEXT_PUBLIC_SITE_URL` | Dashboard link in email body |

---

## Quick reference: key files

| File | Purpose |
|---|---|
| `app/clinician/layout.tsx` | Auth gate + nav shell |
| `app/clinician/page.tsx` | Review queue grouped by status |
| `app/clinician/actions.ts` | Server actions: `startReview`, `saveProgram`, `approveAndSend` |
| `app/clinician/_components/review-detail.tsx` | Patient card + program tab UI |
| `app/clinician/_components/janet-chat.tsx` | Chat component using Vercel AI SDK |
| `app/api/clinician/chat/route.ts` | Chat API route with auth |
| `lib/ai/agents/janet-clinician.ts` | Janet clinician agent (context loading + streaming) |
| `lib/ai/tools/submit-program-tool.ts` | `submit_30_day_program` tool |
| `lib/email/program-delivery.ts` | Program delivery email template |
| `supabase/migrations/0011_clinical_schema.sql` | `periodic_reviews`, `patient_assignments` tables |
| `supabase/migrations/0042_periodic_reviews_expand.sql` | `review_status`, `review_month`, `janet_brief` columns |
| `supabase/migrations/0050_periodic_reviews_program.sql` | `program_30_day`, `program_sent_at` columns + RLS updates |
