# QA Report: Janet upload array-healing — Wave 1
Date: 2026-05-01
Reviewer: Orchestrator (independent reproduction of implementer + reviewer findings)

## Build status

| Command | Result |
|---|---|
| `pnpm vitest run tests/unit/uploads/` | **PASS** — 34/34 tests across 6 files |
| `pnpm build` | **PASS** — clean compile, no new warnings |

Only pre-existing warnings observed in build output:
- `@sentry/nextjs` `disableLogger` deprecation (pre-existing, unrelated to this change)
- Next.js `turbopack.root` workspace-root inference notice (pre-existing, unrelated)

## Test results

| Suite | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| `tests/unit/uploads/dedup.test.ts` | existing | ✓ | 0 | 0 |
| `tests/unit/uploads/derive-status.test.ts` | existing | ✓ | 0 | 0 |
| `tests/unit/uploads/extract-lab-results.test.ts` | existing | ✓ | 0 | 0 |
| `tests/unit/uploads/hash.test.ts` | existing | ✓ | 0 | 0 |
| `tests/unit/uploads/janet-prompt.test.ts` | existing | ✓ | 0 | 0 |
| `tests/unit/uploads/janet-parse.test.ts` | **NEW** — 6 cases | 6 | 0 | 0 |
| **Total** | **34** | **34** | **0** | **0** |

New test cases verified:
1. Single-object passthrough — `category="blood_work"`, `biomarkers.length === 1` ✓
2. Array of one — unwraps to single result ✓
3. Array of many with dates — biomarker concat (length 2), most-recent canonical (`date_of_test === "2025-06-15"`, `document_type === "Current Lipid Panel"`, summary from newest entry) ✓
4. Array of many without dates — first entry is canonical, biomarkers concatenated ✓
5. Empty array — throws matching `/empty array/` ✓
6. SYSTEM_PROMPT contains `"Never return an array"` ✓

## Findings

### Confirmed working
- Production failure mode (top-level array → Zod parse error) is now healed at the parse step; single-object responses pass through untouched (strict superset of prior behaviour).
- Historical lab data is preserved: every biomarker keeps its own `test_date`, so `extractLabResults` will write each one to `biomarkers.lab_results` on its true test date via the existing `(user_uuid, biomarker, test_date)` unique partial index — no clinical history is lost.
- `parseJanetResult` and `healJanetJson` are exported for direct unit testing.
- Prompt now includes the explicit "Never return an array" instruction immediately after the JSON shape example and before the no-prose-around-JSON line.

### Deferred items

None.

### Known limitations

- Healer's date sort uses `localeCompare` on raw strings — correct for ISO `YYYY-MM-DD` (the schema/prompt's expected format) but would mis-sort if Anthropic ever returns a different date shape. A short comment on lines 152-153 of `lib/uploads/janet.ts` documents this assumption.
- Tracy's previously-failed upload (the row that triggered this fix) will still show `janet_status = 'error'` until she re-uploads — there is no automatic retry of historical errors. This is expected behaviour and out of scope for this wave.

### Out-of-scope edits caught + reverted

The implementer subagent made an unrelated "Longevity Coach" → "Janet Cares" rename in `docs/qa/2026-04-28-gp-panel-pack.md`. Reverted by the orchestrator before review; no other unintended edits.

## Verdict

**APPROVED**

Plan compliance: PASS (spec reviewer)
Code quality: PASS (quality reviewer)
Build: PASS
Tests: 34/34 PASS

Ready to push, open PR, and merge.
