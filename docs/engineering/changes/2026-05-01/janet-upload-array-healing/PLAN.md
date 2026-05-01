# Plan: Janet upload — array-response healing for multi-panel pathology PDFs
Date: 2026-05-01
Phase: Phase 2 — Intelligence (Janet upload pipeline)
Status: Draft

## Objective

Patient pathology PDFs that include historical results (current + previous panels in a trend table) currently fail Janet's upload analysis with `Zod parse failed: expected object, received array`. Anthropic Opus is responding with a top-level JSON array (one object per test date) instead of the single-object shape `JanetResultSchema` expects. Both retry attempts hit the same shape, so the upload ends in `janet_status = 'error'` and the patient sees `Analysis failed: ...` in `/uploads`.

The schema already supports historical data — every biomarker can carry its own `test_date`, and the `extractLabResults` consumer iterates them correctly. Janet only needs to put all results into one object's `biomarkers` array. We will (1) tighten the system prompt to make this explicit, and (2) add a healer in the JSON parse step that merges array responses into a single `JanetResult` so we are robust to LLM drift.

Done = Tracy can re-upload the same PDF and `janet_status` reaches `'done'`, with each historical result preserved as its own row in `biomarkers.lab_results`.

## Scope

In scope:
- `lib/uploads/janet.ts` — `SYSTEM_PROMPT` text + `parseJanetResult` function
- New unit tests at `tests/unit/uploads/janet-parse.test.ts` covering single-object passthrough, single-element array, multi-element array merge, empty array

Out of scope:
- `lib/uploads/persist-lab-results.ts` and `extractLabResults` — already handles per-biomarker `test_date`, no change needed
- Upload UI flow, polling, error rendering in `app/(app)/uploads/upload-client.tsx`
- Retry strategy, Anthropic model choice, thinking config
- Re-running the failed upload for Tracy retroactively (separate manual step once shipped)

## Data model changes

None. No migrations, no schema changes, no new columns. The `biomarkers.lab_results` table is unchanged; we are only changing how we get data into it.

## Waves

### Wave 1 — Tighten prompt + heal array responses

**What James can see after this wave merges:** Tracy (and any future patient with a multi-panel PDF) can re-upload their pathology document and have it processed successfully — analysis status reaches Read, individual biomarkers across all historical dates land in `biomarkers.lab_results`, and the report surfaces them on the Labs page.

Tasks:

  #### Task 1.1 — Tighten SYSTEM_PROMPT and add array healing in parseJanetResult

  Files affected:
  - `lib/uploads/janet.ts`
  - `tests/unit/uploads/janet-parse.test.ts` (new)

  What to build:

  **Part A — SYSTEM_PROMPT update.**
  Add an unambiguous instruction that the response MUST be a single JSON object at the top level — never an array. Insert this immediately after the existing example JSON shape, before "Do not include any text outside the JSON object."

  Wording (suggested — implementer can refine):
  > IMPORTANT: Always respond with exactly ONE JSON object at the top level. Never return an array. If the document contains multiple test dates (e.g. a pathology report showing current results alongside previous panels in a trend table), represent every result as a separate entry in the single `biomarkers` array, each carrying its own `test_date`. Do not split the response into multiple top-level objects.

  Keep the existing rules intact (category list, biomarkers-only-for-blood_work, no markdown fences).

  **Part B — Heal array responses in parseJanetResult.**
  Currently `parseJanetResult(rawText)` calls `extractJson` then `JanetResultSchema.safeParse`. Insert a healing step between them:

  ```ts
  function healJanetJson(json: unknown): unknown {
    if (!Array.isArray(json)) return json;
    if (json.length === 0) {
      throw new Error("janet: response was an empty array — no usable data");
    }
    if (json.length === 1) return json[0];

    // Multi-element array: pick the most recent entry by findings.date_of_test
    // (fallback: first entry) for category/summary/findings shape.
    // Concat findings.biomarkers across ALL entries so historical data is preserved.
    type LooseEntry = {
      category?: unknown;
      summary?: unknown;
      findings?: { date_of_test?: string | null; biomarkers?: unknown[] } & Record<string, unknown>;
    };
    const entries = json as LooseEntry[];

    const sorted = [...entries].sort((a, b) => {
      const da = a.findings?.date_of_test ?? "";
      const db = b.findings?.date_of_test ?? "";
      // Most recent date first; missing dates sink to the bottom
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db.localeCompare(da);
    });

    const canonical = sorted[0];
    const allBiomarkers = entries.flatMap((e) =>
      Array.isArray(e.findings?.biomarkers) ? (e.findings!.biomarkers as unknown[]) : [],
    );

    return {
      category: canonical.category,
      summary: canonical.summary,
      findings: {
        ...(canonical.findings ?? {}),
        biomarkers: allBiomarkers,
      },
    };
  }
  ```

  Wire into `parseJanetResult`:
  ```ts
  function parseJanetResult(rawText: string): JanetResult {
    const json = extractJson(rawText);
    if (json === null) {
      throw new Error(`janet: no JSON extractable from response (preview: ${rawText.slice(0, 200)})`);
    }
    const healed = healJanetJson(json);
    const parsed = JanetResultSchema.safeParse(healed);
    if (!parsed.success) {
      throw new Error(`janet: Zod parse failed: ${parsed.error.message.slice(0, 300)}`);
    }
    return parsed.data;
  }
  ```

  **Part C — Export `parseJanetResult` (and `healJanetJson`) for unit testing.**
  These are currently file-private. Export both so the new test file can exercise them directly without invoking the Anthropic SDK. No production code path changes — they remain used internally as before.

  **Part D — Unit tests at `tests/unit/uploads/janet-parse.test.ts`.**
  Use vitest (see existing pattern in `tests/unit/uploads/janet-prompt.test.ts`). Cover:

  1. **Single-object passthrough** — `parseJanetResult(JSON.stringify({ category: "blood_work", summary: "ok", findings: { document_type: "Lipid", biomarkers: [{biomarker:"LDL", value:3.2, unit:"mmol/L", reference_min:0, reference_max:3.5}] } }))` returns the parsed object with `biomarkers.length === 1`.
  2. **Array of one — unwrap** — same payload wrapped in `[ ... ]` returns the same single result. `category === "blood_work"`, `biomarkers.length === 1`.
  3. **Array of many — merge with biomarker concat** — two entries with `findings.date_of_test` "2024-01-01" and "2025-06-15", each with one biomarker; result has the 2025-06-15 entry's `category`/`summary`/`document_type`, with `biomarkers.length === 2` (both entries' biomarkers concatenated).
  4. **Array of many — fallback when dates missing** — entries with no `findings.date_of_test` use the first entry as canonical; biomarkers still concatenated across all.
  5. **Empty array — throws** — `parseJanetResult("[]")` throws an `Error` matching `/empty array/`.
  6. **Prompt sanity** — extend the existing `janet-prompt.test.ts` (or add to new file) with one assertion that the prompt now contains the substring `Never return an array` (or equivalent — match whatever wording the implementer chose).

  Acceptance criteria:
  - `pnpm build` is clean (no new TypeScript errors)
  - `pnpm test` passes — all existing `tests/unit/uploads/*` tests still green, plus the new janet-parse tests
  - `parseJanetResult` and `healJanetJson` are both exported from `lib/uploads/janet.ts`
  - `SYSTEM_PROMPT` contains an explicit single-object instruction with the words "Never return an array" (or equivalent — confirmed via the new prompt assertion)
  - No changes to `persist-lab-results.ts`, `janet-upload.ts`, or any UI file
  - No new dependencies added

  Rules to apply:
  - `.claude/rules/ai-agents.md` — Claude API usage section: continue using `claude-opus-4-7`, prompt caching, streaming-where-relevant, timeout already in place
  - `.claude/rules/security.md` — no PII added to logs; existing `raw_preview` logging is unchanged and already capped to 400 chars
  - `CLAUDE.md` no-comments default — only add a comment where the WHY is non-obvious (e.g. one short note on the date-sort tiebreak when both dates are missing)

## Deployment risk

Low. The change is one file in `lib/uploads/` plus a new test file. There is no schema change, no API contract change, no UI change. The healer is a strict superset of current behaviour — single-object responses pass through untouched. Worst case: the healer mis-merges a never-seen-before pathological array shape, in which case Zod still rejects and the user sees the same `Analysis failed` error they see today.

## Rollback

Single revert commit on the wave PR returns behaviour to current state.
