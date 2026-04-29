# Plan: Patient Upload Portal
Date: 2026-04-27 → 2026-04-28
Phase: Phase 2 (Intelligence) + Phase 4 (Clinical Depth)
Status: Complete

## Objective

Build a patient file upload portal (Step 4 of the intake workflow) where members can
upload previous pathology, imaging, and test results. Janet (Claude Opus 4.7) reads
each uploaded file, auto-detects its category, extracts structured findings, and stores
them in the database. This data feeds the risk engine and supplement protocol pipelines.
Upload access is gated behind a completed health assessment. The portal supports
multiple files in parallel — each file runs its own independent async pipeline.

## Scope

**In scope:**
- Supabase Storage bucket (`patient-uploads`) with private access, 50 MB limit, PDF + image MIME types
- Folder-based storage RLS: `{user_uuid}/` prefix isolates each member's files
- `patient_uploads` metadata table with Janet status, category, summary, and findings columns
- Janet analysis using Claude Opus 4.7 with adaptive thinking and prompt caching
- Auto-detection of document category from: blood_work, imaging, genetic, microbiome, metabolic, other
- Server actions: `recordUpload` (insert row → download → analyse → write results) and `deleteUpload`
- Client: drag-drop zone, multi-file selection, per-file independent async pipeline, per-file progress tiles
- Gate: `/uploads` page checks for completed health assessment; shows CTA to onboarding if not done
- Dashboard card: shows file count; CTA adapts based on assessment state and upload count
- `/uploads` added to proxy protected prefixes
- `patient_uploads` types added to `database.types.ts`

**Out of scope:**
- Janet chat agent (separate Phase 3 item)
- Risk engine re-run triggered by upload (deferred — risk engine not yet ported)
- Supplement protocol trigger from upload (dependency: pipeline not yet built)
- Wearable data uploads
- Admin visibility of patient uploads
- File preview in-app

## Data model changes

| Table / Bucket | Column / Policy | Type | PII? | Writer |
|---|---|---|---|---|
| `storage.buckets` | `patient-uploads` bucket | — | No | Migration only |
| `storage.objects` | `uploads_owner_select/insert/delete` | RLS | No | Supabase Storage |
| `storage.objects` | `uploads_admin_select` | RLS | No | Supabase Storage |
| `patient_uploads` | `id`, `user_uuid`, `storage_path`, `original_filename`, `mime_type`, `file_size_bytes` | typed columns | No | User (via server action) |
| `patient_uploads` | `janet_status` | `text` (check constraint) | No | Service role (Janet) |
| `patient_uploads` | `janet_category`, `janet_summary`, `janet_error` | `text` | No | Service role (Janet) |
| `patient_uploads` | `janet_findings` | `jsonb` | No | Service role (Janet) |
| `patient_uploads` | `janet_processed_at` | `timestamptz` | No | Service role (Janet) |

No PII stored. `original_filename` is the patient's file name (not PII under AHPRA rules).
All Janet columns written via service role admin client — users have no UPDATE RLS policy.

## Tasks

### Task 1 — Migration: Storage bucket + patient_uploads table
Files: `supabase/migrations/0006_patient_uploads.sql`
What: Create the `patient-uploads` storage bucket (private, 50 MB, PDF + images). Add
storage RLS policies. Create `patient_uploads` metadata table with all Janet columns and
an `updated_at` trigger reusing the existing `set_updated_at()` function.
Acceptance criteria:
- Bucket exists and is private
- Users can only access their own `{user_uuid}/` prefix
- `patient_uploads` table has RLS: owner select/insert/delete, no owner update, admin select
- `janet_status` is constrained to: pending, processing, done, error

### Task 2 — Janet analyser: lib/uploads/janet.ts
Files: `lib/uploads/janet.ts`
What: Anthropic SDK integration using Claude Opus 4.7 with adaptive thinking and prompt
caching on the large system prompt. Handles both PDF (document content block) and images
(image content block). Returns a typed `JanetResult` with category, summary, and findings.
Acceptance criteria:
- Model is `claude-opus-4-7`
- Thinking mode is `{type: "adaptive"}` (not `budget_tokens`)
- System prompt has `cache_control: {type: "ephemeral"}`
- PDF uses `type: "document"` content block
- Images use `type: "image"` content block
- Returns valid JSON matching `JanetResult` shape

### Task 3 — Server actions: app/(app)/uploads/actions.ts
Files: `app/(app)/uploads/actions.ts`
What: `recordUpload` inserts a metadata row (janet_status = processing), downloads the
file from storage using the admin client (bypasses RLS), runs Janet, writes results back.
`deleteUpload` removes from storage and the metadata table. Both use `revalidatePath`.
Acceptance criteria:
- Auth check on every action (`!user` → return error)
- Janet updates written via admin client (not user client)
- `revalidatePath("/uploads")` and `revalidatePath("/dashboard")` called after write
- Download failure sets `janet_status = error` gracefully, does not throw

### Task 4 — Upload client: app/(app)/uploads/upload-client.tsx
Files: `app/(app)/uploads/upload-client.tsx`
What: "use client" component. Drag-drop zone + `<input multiple>`. Per-file progress tracked
in a `Map<localId, InFlightFile>`. All files register atomically in one `setInFlight` call,
then each fires `processFile(localId, file)` without awaiting siblings. Each file transitions
phase (uploading → analysing) and refetches independently on completion.
Acceptance criteria:
- Multiple files can be selected or dropped simultaneously
- Each file's pipeline is independent — one failure does not affect others
- Progress tiles appear for all files simultaneously
- Tiles transition from "Uploading…" to "Janet is reading…" mid-flight
- Each tile removed when its file completes (success or error)
- Errors collected per-file in a list, not as a blocking state

### Task 5 — Page + gate: app/(app)/uploads/page.tsx
Files: `app/(app)/uploads/page.tsx`, `app/(app)/uploads/uploads.css`
What: Server component fetches completed assessment and existing uploads. If no completed
assessment, shows a gate card with CTA to `/onboarding`. Otherwise renders `UploadClient`
with initial uploads.
Acceptance criteria:
- Gate checks `completed_at IS NOT NULL`
- Passes `initialUploads` to client for SSR
- CSS matches dashboard design token set

### Task 6 — Wiring: proxy, database types, dashboard card
Files: `lib/supabase/proxy.ts`, `lib/supabase/database.types.ts`, `app/(app)/dashboard/page.tsx`
What: Add `/uploads` to `PROTECTED_PREFIXES`. Add `patient_uploads` Row/Insert/Update
types. Add uploads card to dashboard showing file count, CTA adapts to assessment state.
Acceptance criteria:
- `/uploads` redirects to login when not authenticated
- `patient_uploads` fully typed in `database.types.ts`
- Dashboard card shows "Upload documents" if no files, "View documents" with count if files exist
- Card shows gate message if assessment not complete
