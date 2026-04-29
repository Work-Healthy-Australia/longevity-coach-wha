# Changelog: Patient Upload Portal
Date: 2026-04-27 → 2026-04-28
Phase: Phase 2 (Intelligence) + Phase 4 (Clinical Depth)
Branch: `qa/patient-uploads`
Commits: `58a5e55` (upload portal), `dfdc2de` (multi-file upgrade)

## What was built

- **`/uploads` route** — gated patient file upload portal; accessible after health assessment completion
- **Multi-file drag-drop zone** — members can drop or browse-select multiple files simultaneously
- **Per-file async pipeline** — each file independently: uploads to Supabase Storage → calls Janet → writes results back; no sequential blocking
- **Janet document analyser** — Claude Opus 4.7 reads each file, auto-detects category (blood_work, imaging, genetic, microbiome, metabolic, other), and returns a plain-English summary plus structured findings JSON
- **Assessment gate** — `/uploads` shows a CTA to `/onboarding` if no completed health assessment exists
- **Dashboard uploads card** — shows file count; CTA adapts to "Upload documents" (no files) or "View documents" (files present); gate message if assessment incomplete
- **Delete** — members can remove any uploaded file from both storage and the metadata table

## What changed

| File | Nature of change |
|---|---|
| `supabase/migrations/0006_patient_uploads.sql` | New: storage bucket + table + RLS |
| `lib/uploads/janet.ts` | New: Anthropic SDK document analyser |
| `app/(app)/uploads/actions.ts` | New: `recordUpload` and `deleteUpload` server actions |
| `app/(app)/uploads/upload-client.tsx` | New: multi-file parallel upload client |
| `app/(app)/uploads/page.tsx` | New: server component with assessment gate |
| `app/(app)/uploads/uploads.css` | New: design-system CSS matching dashboard tokens |
| `lib/supabase/proxy.ts` | Modified: `/uploads` added to `PROTECTED_PREFIXES` |
| `lib/supabase/database.types.ts` | Modified: `patient_uploads` Row/Insert/Update types added |
| `app/(app)/dashboard/page.tsx` | Modified: uploads card with count query and adaptive CTA |
| `package.json` / `pnpm-lock.yaml` | Modified: `@anthropic-ai/sdk ^0.91.1` added |

## Migrations applied

- **`0006_patient_uploads.sql`** — Creates the `patient-uploads` Supabase Storage bucket
  (private, 50 MB max, PDF + images). Adds folder-based storage RLS policies. Creates the
  `patient_uploads` metadata table with Janet status, category, summary, findings, and
  error columns. Adds `set_updated_at` trigger. Applied to production 2026-04-28.

## Deviations from plan

**Multi-file upgrade added in same branch.** Originally scoped as single-file upload; the
multi-file enhancement was added in the same session after initial delivery. No plan change
was required — the data model, server action, and Janet analyser are unchanged; only the
client component was upgraded.

**`triggerPipeline` wired but not functional.** `actions.ts` calls
`triggerPipeline("supplement-protocol", user.id)` after a successful Janet analysis.
This was added as a forward-wire for when the supplement pipeline is built. The call is
fire-and-forget and fails silently with no user impact. This is intentional scaffolding.

## Known gaps / deferred items

| Item | Reason deferred | When to address |
|---|---|---|
| E2E Playwright tests for upload flow | Requires live storage credentials in CI | Phase 4 E2E environment setup |
| Risk engine triggered by upload | Risk engine not yet ported | Phase 2 — risk engine milestone |
| Supplement protocol pipeline | Not yet built | Phase 2 — Sage pipeline milestone |
| Queue-based Janet processing | MVP inline call sufficient up to ~5 MB; larger files will be slow | Phase 4 — when lab DICOM/large-image uploads are added |
| Admin visibility of patient uploads | Admin CRM not yet built | Phase 1 gap — admin CRM milestone |
