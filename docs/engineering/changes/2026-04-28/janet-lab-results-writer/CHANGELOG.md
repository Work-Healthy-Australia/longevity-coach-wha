# Changelog: Janet → biomarkers.lab_results structured writer
Date: 2026-04-28
Phase: Epic 2 (The Intake — Janet) + Epic 8 (The Living Record — labs)

## What was built

- **Janet now extracts structured biomarkers from blood-work documents.** When a member uploads a blood panel and Janet's category is `blood_work`, her response includes a new `findings.biomarkers[]` array with verbatim biomarker name, value, unit, reference range, test date, panel name, and lab provider. Status is **not** computed by Janet — that's done server-side by a deterministic rule.
- **Server-side `deriveStatus` rule.** Pure function maps `(value, reference_min, reference_max)` → `'low' | 'optimal' | 'high' | 'critical' | null`. Critical thresholds at 1.5× max and 0.5× min. Null when bounds are missing, swapped, or non-positive.
- **`persistLabResults` upload step.** Wired into `recordUpload()` between the Janet `done` update and the supplement-protocol pipeline trigger. Skips non-blood-work uploads. Skips entries with non-finite values, empty names, or empty units. Bulk-inserts with per-row try/catch fallback so a re-upload of the same panel succeeds via the new unique partial index.
- **`/labs` (B4) and the B7 alerts hook now have data.** Both surfaces were already shipped and were waiting for a writer; they light up automatically once this change is in production.
- **Migration `0032_lab_results_idempotency.sql`.** Adds a unique partial index `(user_uuid, biomarker, test_date) where test_date is not null` so re-uploads of the same panel don't produce duplicate rows.
- **Janet `max_tokens` bumped from 1024 to 2048.** The original budget was tight once the new biomarkers array was added on top of `key_values`, `notable_findings`, `summary`, and the adaptive-thinking budget. Truncated JSON would have caused parse failures and broken the upload flow.

## What changed

- `supabase/migrations/0032_lab_results_idempotency.sql` (new) — unique partial index.
- `lib/uploads/janet.ts` — added `BiomarkerExtraction` interface; extended `JanetResult.findings` with optional `biomarkers?: BiomarkerExtraction[]`; exported `SYSTEM_PROMPT`; extended the prompt with the biomarkers schema example + "Do NOT compute or interpret status — server-side" instruction + "omit when not blood_work" instruction; bumped `max_tokens` to 2048; lazy-initialised the Anthropic client so the prompt-snapshot test can import the constant without triggering the SDK browser-env guard.
- `lib/uploads/persist-lab-results.ts` (new) — `deriveStatus`, `extractLabResults`, `persistLabResults`, plus `LabRowDraft` type.
- `app/(app)/uploads/actions.ts` — added `persistLabResults` import; inserted the best-effort persistence block between the Janet `done` update and `triggerPipeline("supplement-protocol")`; added `revalidatePath("/labs")` to the success path.
- `tests/fixtures/janet-results.ts` (new) — canned `JanetResult` fixtures (blood_work with two biomarkers, no biomarkers, imaging, critical, NaN, zero-value, swapped bounds).
- `tests/unit/uploads/derive-status.test.ts` (new) — 10 cases including swapped-bounds guard.
- `tests/unit/uploads/extract-lab-results.test.ts` (new) — 9 cases including `value === 0` retention.
- `tests/unit/uploads/janet-prompt.test.ts` (new) — snapshot test guarding `SYSTEM_PROMPT`.

## Migrations applied

- `0032_lab_results_idempotency.sql` — applied to remote (`Longevity-Coach`, project `raomphjkuypigdhytbzn`) via the Supabase MCP during this change. No type regeneration needed (index-only change, no column shape change).

## Deviations from plan

- **Lazy `getClient()`** in `janet.ts` is a minor refactor not in the original plan. Was needed so the prompt-snapshot test can import `SYSTEM_PROMPT` without the Anthropic SDK constructing on import (which trips the SDK's browser-env guard under the test runner). Behaviourally identical — first `analyzeUpload` call still constructs the client. Documented in Task 1's handoff.

## Known gaps / deferred items

- **Manual smoke test** with a real blood panel is the operator's next step. The plumbing is correct end-to-end; verifying it with a real document (a) confirms Janet's prompt actually emits the new array on representative inputs, (b) catches any lab-format edge cases.
- Biomarker name canonicalisation. Today `LDL`, `LDL Cholesterol`, `LDL-C` are stored as different biomarkers. Future change.
- Unit normalisation (`mg/dL` ↔ `mmol/L`). Future change.
- `optimal_min/max` extraction (separate from `reference_min/max`). Future change.
- `borderline` status logic. Suppressed for noise control. Future change.
- `trend` field computation from history. Future change.
- Imaging / genetic / microbiome / metabolic structured extraction — separate changes; `lab_results` is shaped for blood-panel data only.
