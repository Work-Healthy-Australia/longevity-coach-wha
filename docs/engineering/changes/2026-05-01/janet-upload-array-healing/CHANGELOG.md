# Changelog: Janet upload — array-response healing for multi-panel pathology PDFs
Date: 2026-05-01
Phase: Phase 2 — Intelligence (Janet upload pipeline)
PR: [Work-Healthy-Australia/longevity-coach-wha#106](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/106)
Merge commit: `b52e359`

## What was built

- `healJanetJson(json: unknown): unknown` — new exported helper in `lib/uploads/janet.ts` that defends against Anthropic returning a top-level array instead of a single object. Empty arrays throw; single-element arrays unwrap; multi-element arrays merge into one `JanetResult` (most-recent entry by `findings.date_of_test` wins for `category`/`summary`/`findings` shape; biomarkers from all entries are concatenated so historical lab data is preserved).
- `parseJanetResult(rawText: string): JanetResult` — now exported (was file-private) and runs `healJanetJson` between `extractJson` and `JanetResultSchema.safeParse`.
- `SYSTEM_PROMPT` extended with a "Never return an array" instruction and explicit guidance on representing multi-date documents as a single object with per-biomarker `test_date` entries.
- 6 new vitest cases at `tests/unit/uploads/janet-parse.test.ts` covering single-object passthrough, array-of-one unwrap, multi-entry merge with date sort, multi-entry fallback when dates are missing, empty-array throw, and the prompt-substring assertion.

## What changed

- `lib/uploads/janet.ts` — system prompt updated; `parseJanetResult` and `healJanetJson` exported and wired together; one short comment documenting the ISO `YYYY-MM-DD` assumption on the date sort. No changes to retry strategy, model choice (`claude-opus-4-7`), prompt caching, or thinking config.

## Migrations applied

None. No database changes.

## Deviations from plan

None of substance. Implementer chose a local `EntryShape` narrowing type (rather than `any`) for the array-merge step — slightly stricter than the plan suggested but fully aligned with the project's TypeScript discipline.

The implementer subagent also briefly drive-by-edited an unrelated QA doc (`docs/qa/2026-04-28-gp-panel-pack.md`); this was reverted by the orchestrator before review and never reached the commit.

## Known gaps / deferred items

- Tracy's previously-failed upload row still shows `janet_status = 'error'` in the database — there is no automatic retry of historical errors. She (or any patient with a similar past failure) needs to re-upload the document for the fix to take effect on her data.
- The healer's chronological sort relies on ISO `YYYY-MM-DD` strings, which is what the schema and prompt already require. If a future model response returns dates in a different format, the most-recent canonical pick may be incorrect — but the merge itself still succeeds and the data still flows into `biomarkers.lab_results` correctly.
