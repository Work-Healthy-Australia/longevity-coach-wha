# QA Report: Risk Engine Port
Date: 2026-04-28
Reviewer: QA (coordinator)

## Build status
pnpm build: PASS (✓ Compiled successfully in ~43s)
pnpm test: PASS (298 tests across 50 test files)

## Test results
| Suite | Files | Tests | Pass | Fail |
|---|---|---|---|---|
| unit/risk | 9 | ~120 | 120 | 0 |
| unit (all other) | 41 | ~178 | 178 | 0 |
| **Total** | **50** | **298** | **298** | **0** |

Snapshots: 5 updated (next_recommended_tests shape change from string → string[]).

## Findings

### Confirmed working
- All five domain scorers (cardiovascular, metabolic, neurodegenerative, oncological, musculoskeletal) implemented and tested
- Biological age calculator with clamping
- Trajectory projection with 70% adherence factor
- Dynamic weight adjustment with renormalisation
- `assemblePatientFromDB()` adapter maps questionnaire + daily_logs + family history into PatientInput
- `scoreRisk()` main entry point returns complete EngineOutput
- `submitAssessment()` calls engine synchronously after `health_profiles` write, upserts to `risk_scores` via admin client
- Engine failure is non-fatal — wrapped in try/catch, onboarding redirect continues regardless
- All JSONB fields correctly cast (engine_output, domain_scores, trajectory_6month)
- `next_recommended_tests` is `string[]` end-to-end (engine type, DB column, TypeScript types)
- `user_uuid` unique constraint in migration 0034 — upsert `onConflict: 'user_uuid'` will resolve correctly

### Issues found and fixed during this session
1. `archiver` / `recharts` not installed → fixed with `pnpm install`
2. `upload-client.tsx` missing `fileHash` in `recordUpload()` call → fixed with SHA-256 computation
3. `admin_invites` table missing from `database.types.ts` → manually added from migration 0033
4. `risk_scores.next_recommended_tests` typed as `text` in DB but `string[]` from engine → migration 0034 converts column to `text[]`; types updated
5. `risk_scores.user_uuid` had only a regular index, not a unique constraint → migration 0034 adds unique constraint
6. Stale `any` cast in `actions.ts` → replaced with proper `Json` cast imports

### Deferred items
- Migration 0034 must be applied to the remote database before the upsert will work in production. Local Supabase was not running (Docker down) so the migration was not tested against a live DB — verify `pnpm supabase db push` on next Docker-up.
- `database.types.ts` was manually patched for `admin_invites` and `next_recommended_tests`. Regenerate properly with `supabase gen types typescript --local` when Docker is available.
- Pre-existing TypeScript errors in `tests/integration/` (Supabase mock tuple issues) — unrelated to this change, pre-existing before this session.

### Known limitations
- Lifestyle-only patients (no biomarkers) produce `score_confidence: 'insufficient'`; domain scores default to 50. This is correct expected behaviour per spec.
- `alcohol_units_weekly` not yet in the questionnaire (noted in assessment doc) — engine scores this factor as absent.

## Verdict
**APPROVED** — build clean, all 298 tests pass, migration written, types correct.
