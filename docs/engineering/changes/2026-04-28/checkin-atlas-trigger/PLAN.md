# Plan: Check-in → Atlas Trigger
Date: 2026-04-28
Phase: Phase 2 — Intelligence
Status: Approved

## Objective
Wire the daily check-in server action to fire the Atlas risk-narrative pipeline after a
successful log save. The infrastructure (triggerPipeline helper, /api/pipelines/risk-narrative
route, runRiskNarrativePipeline) already exists and is fully operational. The onboarding
action explicitly defers Atlas to check-in (see comment at onboarding/actions.ts:158).
This change closes that gap with a two-line addition.

## Scope
- In scope:
  - Import `triggerPipeline` into `app/(app)/check-in/actions.ts`
  - Call `triggerPipeline("risk-narrative", user.id)` after a successful upsert in `saveCheckIn`
  - Verify existing tests still pass; add a test asserting the trigger is called on success
- Out of scope:
  - Making Atlas read `biomarkers.daily_logs` (future phase)
  - Throttling Atlas to once-per-day (idempotent upsert makes this safe to defer)
  - Any UI change (dashboard already displays stale-score state correctly)

## Data model changes
None — no new tables, columns, or JSONB keys.

## Tasks

### Task 1 — Wire trigger in saveCheckIn
Files affected:
- `app/(app)/check-in/actions.ts`

What to build:
1. Add `import { triggerPipeline } from "@/lib/ai/trigger";` at the top of the file.
2. After `revalidatePath("/check-in")` and before `return { success: true }`, add:
   `triggerPipeline("risk-narrative", user.id);`

The call must come AFTER the error-guard (`if (error) return { error: error.message }`) so
Atlas is only fired on a successful write. It must NOT be awaited — `triggerPipeline` is
fire-and-forget by design and `saveCheckIn` must return immediately.

Acceptance criteria:
- [ ] `triggerPipeline` is imported from `@/lib/ai/trigger`
- [ ] The call appears after the upsert error guard and before the success return
- [ ] The call is NOT awaited
- [ ] `pnpm build` passes with no TypeScript errors
- [ ] `pnpm test` passes — existing check-in tests unaffected

Rules to apply:
- `.claude/rules/ai-agents.md` — pipeline workers must be async, non-fatal, never block user path
- `.claude/rules/nextjs-conventions.md` — server actions return typed result objects
- `.claude/rules/security.md` — no PII logged, no hard errors on missing optional env keys
  (triggerPipeline already handles missing PIPELINE_SECRET gracefully with a console.warn)

### Task 2 — Add / update unit test
Files affected:
- `tests/unit/check-in/validation.test.ts` (existing — check for coverage gaps)
- Potentially a new file: `tests/unit/check-in/actions.test.ts`

What to build:
Check whether `tests/unit/check-in/validation.test.ts` already covers the action layer.
If not, add a test file that mocks `triggerPipeline` and the Supabase client, then asserts:
- On success: `triggerPipeline` is called with `("risk-narrative", userId)`
- On upsert error: `triggerPipeline` is NOT called
- On auth failure: `triggerPipeline` is NOT called

Acceptance criteria:
- [ ] At least one test asserts trigger fires on success
- [ ] At least one test asserts trigger does NOT fire on upsert error
- [ ] `pnpm test` passes with all new tests green

Rules to apply:
- `.claude/rules/ai-agents.md` — pipeline must not fire on failure paths
