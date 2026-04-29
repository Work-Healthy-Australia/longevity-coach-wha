# Changelog: Pipeline JSON Parse Stability
Date: 2026-04-29
Phase: Phase 3 — Intelligence

## What was built
- Automatic retry-once recovery in `createPipelineAgent` — any JSON parse failure on the first LLM attempt is retried at `temperature: 0` after 500ms, with a structured warning log capturing the raw model output for diagnosis

## What changed
- `lib/ai/agent-factory.ts` — Added `NoObjectGeneratedError` import; replaced single `generateText` call with a 2-attempt retry loop; added null guard on `result.output`; added structured `pipeline_parse_retry` log on first-attempt failure
- `lib/ai/pipelines/clinician-brief.ts` — Removed `.min(100)`, `.max(1200)`, `.max(400)`, `.max(300)` from `ClinicianBriefOutputSchema` string fields; added explanatory comment
- `lib/ai/pipelines/pt-plan.ts` — Removed `.min(7)` from `exercises` array in `PtPlanOutputSchema`; added explanatory comment

## Migrations applied
None.

## Deviations from plan
None — all three tasks implemented as specified.

## Known gaps / deferred items
- No unit tests for the retry path itself. The path is exercised by the eval suite with real LLM calls. A mock-based unit test for the retry behaviour would be a useful addition in a future cleanup pass.
- Pre-existing TypeScript errors in `journal/page.tsx` and `patient-context.ts` (missing `journal_entries` type + `journalEntries` on `PatientContext`) are unrelated and tracked separately.
