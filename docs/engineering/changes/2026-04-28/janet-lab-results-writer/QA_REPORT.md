# QA Report: Janet → biomarkers.lab_results structured writer
Date: 2026-04-28
Reviewer: dev-loop coordinator

## Build status
- `pnpm build`: PASS (only the pre-existing Turbopack workspace-root warning).
- `pnpm test`: PASS — 338 tests across 56 suites, 0 failures, 0 skipped.

## Test results

| Suite | Tests | Pass | Fail | Skipped |
|---|---:|---:|---:|---:|
| `tests/unit/uploads/derive-status.test.ts` | 10 | 10 | 0 | 0 |
| `tests/unit/uploads/extract-lab-results.test.ts` | 9 | 9 | 0 | 0 |
| `tests/unit/uploads/janet-prompt.test.ts` | 2 | 2 | 0 | 0 |
| (other) | 317 | 317 | 0 | 0 |
| **Total** | **338** | **338** | **0** | **0** |

Total new tests: **21** (target was ≥ 15).

## Findings

### Confirmed working
- Migration `0032_lab_results_idempotency.sql` applied to remote (`raomphjkuypigdhytbzn`). Unique partial index `lab_results_user_biomarker_date_unique` on `(user_uuid, biomarker, test_date) where test_date is not null` is live.
- `JanetResult` extended with optional `findings.biomarkers` array; existing consumers of `key_values`/`notable_findings` unaffected.
- `SYSTEM_PROMPT` exports the new biomarkers schema example with explicit "Do NOT compute or interpret status — server-side" instruction. Snapshot test guards against accidental regression.
- `max_tokens` bumped 1024 → 2048 (addendum #1) — preempts truncated-JSON parse failures on dense panels.
- Pure `deriveStatus(value, reference_min, reference_max)` covers all five outcomes plus null-safety. Includes the swapped-bounds guard added per addendum #2.
- Pure `extractLabResults(janet, userId, uploadId)` correctly handles category gating, missing biomarkers, NaN values, missing biomarker names, and **`value === 0` retention** (addendum #3).
- Impure `persistLabResults` does a bulk insert with per-row try/catch fallback for unique-violations on re-upload.
- Upload action wiring places `persistLabResults` between the Janet `done` update and `triggerPipeline("supplement-protocol")`, before the existing B7 alerts hook. Failure of the persistence step is wrapped in try/catch and logs only — never blocks the upload response.
- `revalidatePath("/labs")` added to the success path so the new data appears immediately.
- Lazy `getClient()` in `janet.ts` lets the prompt-snapshot test import `SYSTEM_PROMPT` without paying the SDK browser-env guard cost.

### Deferred items
- **Manual smoke test owed.** Upload a real blood-panel PDF/image with a real signed-in user and confirm: (a) `biomarkers.lab_results` rows appear, (b) `/labs` index renders the panel categories, (c) any `low`/`high`/`critical` reading produces a `member_alerts` chip on `/dashboard`.
- Biomarker name canonicalisation (`LDL` vs `LDL Cholesterol` vs `LDL-C`) — separate change.
- Unit normalisation (`mg/dL` ↔ `mmol/L`) — separate change.
- `optimal_min/max` extraction (distinct from `reference_min/max`) — separate change.
- `borderline` status logic — separate change.
- `trend` computation from history — separate change.
- Re-processing existing uploads. None exist in production today; the first new upload after this lands populates `lab_results` for that user.
- Imaging / genetic / microbiome / metabolic structured extraction — separate changes; `lab_results` is shaped for blood-panel data only.

### Known limitations
- Janet may hallucinate biomarker names or values. Mitigated by verbatim storage (no canonical lookup table to corrupt) and by the downstream risk engine's confidence calibration which degrades gracefully on noisy data.
- Same panel uploaded twice → idempotency index handles it; per-row try/catch ensures the upload still succeeds with `skipped` count.
- Janet emits 50+ biomarkers and busts max_tokens → unlikely at 2048 but possible. If we see truncation in production, raise to 4096 in a follow-up.
- Swapped reference bounds (`min: 200, max: 70`) → `deriveStatus` returns `null`, no clinical judgement made. Test guard added.

## Verdict
APPROVED — both tasks passed inline reviews; build + full suite green; migration applied; types compatible.
