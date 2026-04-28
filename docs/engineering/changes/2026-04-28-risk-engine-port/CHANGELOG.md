# Changelog: Risk Engine Port
Date: 2026-04-28
Phase: Phase 2 — Intelligence

## What was built
- `lib/risk/types.ts` — complete TypeScript interface set: PatientInput, EngineOutput, DomainResult, TrajectoryProjection, ModifiableRisk, Factor, and all sub-types
- `lib/risk/scorer.ts` — main engine entry point (`scoreRisk`), dynamic weight adjustment, composite risk, trajectory projection, score confidence, recommended test surfacing
- `lib/risk/assemble.ts` — questionnaire adapter (`assemblePatientFromDB`, `buildPatientInput`, `buildFamilyHistory`, `buildWearableFromLogs`) mapping Supabase rows to PatientInput
- `lib/risk/cardiovascular.ts` — 15-factor cardiovascular domain scorer
- `lib/risk/metabolic.ts` — 12-factor metabolic domain scorer
- `lib/risk/neurodegenerative.ts` — 16-factor neurodegenerative domain scorer
- `lib/risk/oncological.ts` — 13-factor oncological domain scorer
- `lib/risk/musculoskeletal.ts` — 14-factor musculoskeletal domain scorer
- `lib/risk/biological-age.ts` — biological age calculator with 13 modifiers, clamped to −15/+20 years
- `lib/risk/scorer-utils.ts` — shared scoring utilities (factor normalisation, risk level mapping)
- `lib/risk/index.ts` — clean re-export surface
- `tests/unit/risk/` — 9 test files covering all domain scorers, biological age, assembly, and end-to-end scorer with fixtures and snapshots
- `supabase/migrations/0034_risk_scores_unique_and_array_fixes.sql` — unique constraint on `risk_scores.user_uuid`; `next_recommended_tests` column promoted to `text[]`

## What changed
- `app/(app)/onboarding/actions.ts` — engine wired into `submitAssessment()`: calls `assemblePatientFromDB` + `scoreRisk` after `health_profiles` write; upserts full result to `risk_scores` via admin client inside a try/catch
- `app/(app)/uploads/upload-client.tsx` — added SHA-256 file hash computation before `recordUpload()` call (required by deduplication feature)
- `lib/supabase/database.types.ts` — manually patched: added `admin_invites` table (from migration 0033); updated `risk_scores.next_recommended_tests` to `string[] | null` across Row/Insert/Update

## Migrations applied
- `0034_risk_scores_unique_and_array_fixes.sql` — adds `UNIQUE (user_uuid)` constraint and converts `next_recommended_tests` column from `text` to `text[]`

## Deviations from plan
- Engine files were pre-built on this branch (discovered mid-session). Tasks 2, 3, and 5 were already complete. Session work focused on type correctness, schema fixes, and build/test hygiene.
- Plan specified `lib/risk/adapter.ts` and `lib/risk/engine.ts` as the file names; the implementation uses `lib/risk/assemble.ts` and `lib/risk/scorer.ts` respectively — equivalent functionality under different names.
- Task 4 migration number changed from planned 0031 to 0034 (three other migrations — 0031, 0032, 0033 — were already in the migrations folder).

## Known gaps / deferred items
- Migration 0034 needs `supabase db push` when Docker is next running to apply to the remote DB
- `database.types.ts` should be regenerated with `supabase gen types typescript --local` when Docker is available (currently manually patched)
- `alcohol_units_weekly` field not yet in the questionnaire — the engine scores this as absent data
- Pre-existing TypeScript errors in `tests/integration/` (Supabase mock tuple issues) are unrelated to this change and remain open
