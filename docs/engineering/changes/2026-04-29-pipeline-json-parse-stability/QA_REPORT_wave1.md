# QA Report: Pipeline JSON Parse Stability — Wave 1
Date: 2026-04-29
Reviewer: QA

## Build status
pnpm build: PASS (tsc --noEmit, zero errors in changed files; pre-existing errors in journal/page.tsx, patient-context.ts, and test files are unrelated to this change)
pnpm test: PASS (412 tests, 65 suites)

## Test results
| Suite | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| All suites | 412 | 412 | 0 | 0 |

## Findings

### Confirmed working
- `createPipelineAgent.run()` compiles cleanly with new retry loop and `NoObjectGeneratedError` import
- `ClinicianBriefOutputSchema` no longer contains `minLength`/`maxLength` properties on string fields
- `PtPlanOutputSchema.exercises` no longer has a `minItems` constraint
- Array `.max(5)` and `.max(60)` constraints are preserved (item-count constraints are reliable)
- `result.output == null` guard added — prevents silent undefined access downstream
- All 412 existing tests pass; no regressions introduced

### Deferred items
- Pre-existing TypeScript errors in `journal_entries` table type and `PatientContext.journalEntries` are unrelated to this change and tracked separately
- No new unit tests written for the retry path — integration testing via real LLM calls in eval suite covers this path

### Known limitations
- Retry adds up to 500ms latency on a failed attempt. Pipeline workers are async/background so this is acceptable.
- If both retry attempts fail, the error propagates to the pipeline's existing `catch` block which logs and returns. The pipeline is still non-fatal to users.

## Verdict
APPROVED
