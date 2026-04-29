# Changelog: Check-in → Atlas Trigger
Date: 2026-04-28
Phase: Phase 2 — Intelligence

## What was built
- `saveCheckIn` server action now fires the Atlas risk-narrative pipeline asynchronously
  after every successful daily log save.

## What changed
| File | Change |
|---|---|
| `app/(app)/check-in/actions.ts` | Added `import { triggerPipeline }` and one `triggerPipeline("risk-narrative", user.id)` call after the upsert success path |
| `tests/unit/check-in/actions.test.ts` | New test file: 4 tests covering trigger-fires-on-success, trigger-does-not-fire-on-upsert-error, trigger-does-not-fire-on-auth-failure, trigger-does-not-fire-on-validation-failure |

## Migrations applied
None.

## Deviations from plan
None — implementation matched the plan exactly.

## Known gaps / deferred items
- Atlas does not yet read `biomarkers.daily_logs`. Daily check-in data will not directly
  influence risk scores until a future phase adds daily trend context to the Atlas prompt.
- Per-day throttling of Atlas triggers not implemented. Current behaviour: any re-save of
  today's log re-triggers Atlas. Safe (idempotent), but costs LLM tokens on repeated edits.
