# Changelog: Bio-age input coverage
Date: 2026-04-29
Phase: Epic 2 (The Intake) + Epic 3 (The Number) — closes input gaps for the deterministic bio-age engine flagged by audit.

## What was built

The audit of `estimateBiologicalAge()` showed 4 of 11 inputs with no path from the front-end to the engine. This change closes all 4, plus adds an imaging-biomarker route that completes the Janet → engine pipeline for DEXA scans.

**Five gaps closed:**

1. **HRV in daily check-in** — bio-age weight 0.10. New optional "Resting HRV (ms)" field on `/check-in`. Schema column `daily_logs.hrv` already existed; just wired the input. `assemble.ts::buildWearableFromLogs()` already averages it into `WearableData.hrv_rmssd`.
2. **Resting heart rate in daily check-in** — bonus while we were there. New optional field on `/check-in`. Schema column `daily_logs.resting_heart_rate` already existed.
3. **Deep sleep % in daily check-in** — bio-age weight 0.06. New optional field on `/check-in` + new schema column `daily_logs.deep_sleep_pct numeric(5,2)` (migration `0041`). `buildWearableFromLogs()` extended to average it into `WearableData.avg_deep_sleep_pct`.
4. **VO₂max self-report in lifestyle step** — bio-age weight 0.12 (highest single weight). New optional field on the onboarding lifestyle step. `assemble.ts` lifts `lifestyle.vo2max_estimated` into `WearableData.vo2max_estimated` (only when no wearable-derived value exists — wearable wins).
5. **Waist circumference in basics step + visceral_fat fallback** — bio-age weight 0.07 (was unreachable). New optional field on the basics step. New `Demographics.waist_circumference_cm` engine field. New `estimateVisceralFatFromWaist(waist, sex)` helper produces a sex-adjusted estimate (slope 5, threshold 90/80 cm M/F) when no DEXA value is on file. DEXA always wins.

**Imaging route through Janet:** `assemble.ts` now contains `IMAGING_BIOMARKER_KEY_MAP` and `buildImagingFromLabResults()`. Any biomarker Janet extracts that matches imaging keys (`visceral_fat_area`, `cac` / Agatston, `t_score_spine`, `t_score_hip`, `liver_fat_fraction`, etc.) is routed into `Biomarkers.imaging` instead of `BloodPanel`. `buildPatientInput` no longer hard-codes `imaging: {}` — it reads from this new path. **The lab_results writer that Janet already uses is the single sink; no Janet prompt change required.**

**Net coverage change:**

| Before | After |
|---|---|
| 7 of 11 bio-age inputs wired (64%) | 11 of 11 wired (100%) |
| Schema-but-not-collected: HRV (1) | None |
| No path: VO₂max, deep sleep, visceral fat (3) | None — all 3 have an input path now |

## What changed

- `supabase/migrations/0041_daily_logs_deep_sleep_pct.sql` (new) — adds `deep_sleep_pct numeric(5,2)` column to `biomarkers.daily_logs`. Idempotent. Applied to remote.
- `lib/risk/types.ts` — added `Demographics.waist_circumference_cm?: number`.
- `lib/risk/assemble.ts`:
  - New `IMAGING_BIOMARKER_KEY_MAP` (12 aliases for visceral fat, CAC, T-scores, liver PDFF, carotid IMT).
  - New exported `buildImagingFromLabResults(rows)` — pure helper.
  - New exported `estimateVisceralFatFromWaist(waist, sex)` — pure helper.
  - `buildBloodPanel` now skips imaging keys and uses `[^a-z0-9]+` normalisation so hyphens/parens/spaces all map to `_`.
  - `buildWearableFromLogs` now averages `deep_sleep_pct` into `avg_deep_sleep_pct`.
  - `buildPatientInput` lifts `basics.waist_circumference_cm` into `Demographics`, lifts `lifestyle.vo2max_estimated` into `WearableData` (when wearable-derived value absent), populates `Biomarkers.imaging` from lab_results, and falls back to waist-derived visceral fat when DEXA is missing.
  - Daily-logs query updated to select `deep_sleep_pct`.
- `lib/questionnaire/questions.ts`:
  - New `waist_circumference_cm` field on basics step (between weight and SBP).
  - New `vo2max_estimated` field on lifestyle step (after diet).
- `app/(app)/check-in/_components/check-in-form.tsx` — three new optional input fields (HRV, resting HR, deep sleep %).
- `app/(app)/check-in/validation.ts` — three new optional-number parsers with sensible bounds (HRV 5–200 ms, RHR 30–150 bpm, deep sleep 0–60%).
- `app/(app)/check-in/actions.ts` — upsert includes the three new columns.
- `app/(app)/check-in/page.tsx` — query selects the new columns; `LogEntry` type extended.
- Tests:
  - `tests/unit/risk/bio-age-inputs.test.ts` (new) — 14 cases (`buildWearableFromLogs` deep sleep + `buildImagingFromLabResults` + `estimateVisceralFatFromWaist`).
  - `tests/unit/check-in/validation-extended.test.ts` (new) — 9 cases for the three new optional fields.
  - `tests/unit/questionnaire/basics-vo2max-waist.test.ts` (new) — 11 cases for both new questionnaire fields.

Total new tests: **34**. Full suite **484/484** passing. Build clean.

## Migrations applied

- `0041_daily_logs_deep_sleep_pct.sql` — applied to remote (`raomphjkuypigdhytbzn`) via Supabase MCP.

## Deviations from plan

- Imaging routing via existing `lab_results` writer (no Janet prompt change). The original audit suggested "extend Janet's structured biomarker extraction to handle imaging keys" but Janet's existing prompt already extracts whatever is in the document — the `lab_results` table accepts any biomarker name. The change is purely a routing-table addition in `assemble.ts`, which is cheaper and forward-compatible.
- `buildBloodPanel` normalisation upgraded from space-only to `[^a-z0-9]+`. Some legacy map keys (`"lp(a)"`, `"hs-crp"`, `"ldl-c"`, `"hdl-c"`, `"hba1c%"`) become redundant but their underscore equivalents still match — zero behaviour regression.
- No DB migrations beyond `0041`. Waist circumference and VO₂max live in `responses` JSONB matching the SBP pattern (Path A from the SBP work).

## Known gaps / deferred items

- **Wearable OAuth integrations** (Apple Watch, Garmin, Whoop, Oura) — Phase 4 work. When they land, `WearableData.hrv_rmssd`, `vo2max_estimated`, `avg_deep_sleep_pct` will be populated automatically and the self-report fields become an editable fallback.
- **DEXA upload UX** — once a member uploads a DEXA report, Janet extracts visceral fat and routes via the new imaging path. We may want a dedicated "Body composition" badge on `/labs` to surface DEXA results separately from blood biomarkers; deferred.
- **Waist→visceral-fat slope is empirical** — slope 5 with thresholds 80/90 cm gives reasonable estimates against DEXA reference data but isn't a published formula. Worth a clinical-advisor sanity check.
- **VO₂max from lifestyle is self-report** — accuracy depends on the source. A wearable reading > clinical assessment > self-estimate. The engine treats them all as the same input; future polish could attach provenance.
- Manual smoke test owed: complete onboarding with waist 95 + VO₂max 42, log a check-in with HRV 60 + RHR 58 + deep sleep 18, visit `/report`, observe the bio-age output reflects the new inputs.
