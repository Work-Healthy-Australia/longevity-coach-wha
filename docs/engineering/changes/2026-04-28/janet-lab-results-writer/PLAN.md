# Plan: Janet → biomarkers.lab_results structured writer
**Date:** 2026-04-28
**Phase:** Epic 2 (The Intake — Janet) + Epic 8 (The Living Record — labs depth)
**Status:** Draft

## Objective

Wire Janet to emit structured biomarker rows alongside her existing free-text findings so every blood-work upload populates `biomarkers.lab_results`. This unblocks two already-shipped surfaces — `/labs` (B4) and the lab-out-of-range alert hook (B7) — without any UI changes. Done = uploading a real blood panel writes one typed row per biomarker into `biomarkers.lab_results`, the `/labs` page renders them grouped by category, and a high/low/critical reading produces a `member_alerts` chip on the dashboard within the same upload action.

**Path chosen** (per Phase 1 + 2): Path A2 — Janet extracts biomarker name / value / unit / reference range / test date / panel name; we compute `status` deterministically server-side via a pure helper. No client-side recomputation. No LLM call for status.

## Scope

**In scope:**
- Migration `0032_lab_results_idempotency.sql` — unique partial index `(user_uuid, biomarker, test_date) where test_date is not null` for idempotent re-uploads.
- Janet prompt extension + `JanetResult` type extension to optionally return a `biomarkers: BiomarkerExtraction[]` array when `category === 'blood_work'`.
- `lib/uploads/persist-lab-results.ts` — new module: pure `deriveStatus`, pure `extractLabResults` helpers, plus an impure `persistLabResults(admin, janetResult, userId, uploadId)` that does the actual DB write.
- Hook the persistence step into `app/(app)/uploads/actions.ts::recordUpload()` between the `patient_uploads.update({ janet_status: 'done' })` step and `triggerPipeline("supplement-protocol", user.id)`.
- Test fixtures at `tests/fixtures/janet-results.ts`.
- Tests for `deriveStatus` and `extractLabResults`.
- A snapshot test for Janet's system prompt JSON schema example to guard against accidental regressions.

**Out of scope:**
- Biomarker name canonicalisation (`LDL` vs `LDL Cholesterol` vs `LDL-C`). Store verbatim. Future change.
- Unit normalisation (`mg/dL` vs `mmol/L`). Store verbatim. Future change.
- Optimal range vs reference range distinction beyond what Janet emits. We populate `reference_min/max` from Janet; `optimal_min/max` left null for now.
- `borderline` status. Suppressed (needs proximity logic + noise tuning). Future change.
- Trend computation (`improving / stable / declining`). Janet doesn't emit it; left null. Future change can compute from history.
- Re-processing existing uploads. Today no `lab_results` rows exist; nothing to migrate. The first upload after this lands populates the table for that user.
- Changing pipeline trigger order. Atlas / Sage are wired elsewhere; we only ensure the new rows are written before the existing `triggerPipeline` call so the immediate Sage run sees them.
- Imaging / genetic / microbiome / metabolic upload categories. `lab_results` is shaped for blood-panel data only.
- Lab-row UI changes. `/labs` already renders this data correctly.

## Data model changes

**No new columns or tables.** All `lab_results` columns we need are already in `0009_biomarkers_schema.sql`.

**One new index** in `0032_lab_results_idempotency.sql`:

```sql
-- 0032_lab_results_idempotency.sql
-- Idempotent re-upload guard. One row per (user, biomarker, test_date)
-- when test_date is known; rows without a test_date can repeat (we don't
-- have enough info to dedupe them). The non-unique index from 0009 is
-- kept for existing query patterns; this adds a unique partial index
-- alongside it.
create unique index if not exists lab_results_user_biomarker_date_unique
  on biomarkers.lab_results(user_uuid, biomarker, test_date)
  where test_date is not null;
```

Idempotent (`if not exists`). No RLS change (existing policies stay).

**Single-writer principle (data-management Rule 4).** `biomarkers.lab_results` writer is the upload server action's new persistence step. This is the table's first real writer; the schema has been waiting for it. `risk_scores` writer (service-role engine) is unaffected. `daily_logs` writer (member check-in action) is unaffected.

## Tasks

Two tasks, sequential. Task 1 = migration + pure helpers + Janet type + prompt extension. Task 2 = upload-action wiring + tests.

---

### Task 1 — Migration `0032` + Janet type extension + pure helpers

**Files affected:**
- `supabase/migrations/0032_lab_results_idempotency.sql` (new).
- `lib/uploads/janet.ts` (modify — extend `JanetResult.findings` with optional `biomarkers` array; extend `SYSTEM_PROMPT` to describe the new field with one example).
- `lib/uploads/persist-lab-results.ts` (new — pure `deriveStatus`, pure `extractLabResults`).
- `tests/fixtures/janet-results.ts` (new — canned `JanetResult` fixtures: one blood_work with biomarkers, one blood_work without, one imaging, one with edge cases).
- `tests/unit/uploads/derive-status.test.ts` (new).
- `tests/unit/uploads/extract-lab-results.test.ts` (new).
- `tests/unit/uploads/janet-prompt.test.ts` (new — snapshot of the system prompt's JSON-schema-example block).

**What to build:**

#### Migration `0032_lab_results_idempotency.sql`

Verbatim from the Data Model section above. Idempotent. Do NOT apply — operator step post-merge.

#### `lib/uploads/janet.ts` — type and prompt extension

Extend the type:

```ts
export interface BiomarkerExtraction {
  biomarker: string;          // verbatim from document, e.g. "LDL Cholesterol"
  value: number;              // numeric value
  unit: string;               // verbatim, e.g. "mg/dL" or "mmol/L"
  reference_min: number | null;
  reference_max: number | null;
  test_date: string | null;   // ISO YYYY-MM-DD if Janet can read it from the document, else null
  panel_name: string | null;  // verbatim, e.g. "Lipid Panel" or "Comprehensive Metabolic Panel"
  lab_provider: string | null; // verbatim, e.g. "Quest Diagnostics"
}

export interface JanetResult {
  category: JanetCategory;
  summary: string;
  findings: {
    document_type: string;
    key_values?: Record<string, string>;
    notable_findings?: string[];
    date_of_test?: string;
    ordering_provider?: string;
    biomarkers?: BiomarkerExtraction[]; // NEW — only when category === 'blood_work'
  };
}
```

Extend `SYSTEM_PROMPT`. The new block goes inside the JSON example:

```
{
  "category": "<one of the six categories>",
  "summary": "<one or two sentences for the patient>",
  "findings": {
    "document_type": "<specific type, e.g. Lipid Panel, Lumbar MRI>",
    "key_values": { "<name>": "<value with unit>" },
    "notable_findings": ["<finding 1>", "<finding 2>"],
    "date_of_test": "<ISO date or null>",
    "ordering_provider": "<name or null>",
    "biomarkers": [
      {
        "biomarker": "<verbatim name>",
        "value": <number>,
        "unit": "<verbatim unit>",
        "reference_min": <number or null>,
        "reference_max": <number or null>,
        "test_date": "<ISO YYYY-MM-DD or null>",
        "panel_name": "<panel name or null>",
        "lab_provider": "<lab company or null>"
      }
    ]
  }
}
```

Add explicit instructions:

> When `category` is `"blood_work"`, also extract one `biomarkers` array entry per measured biomarker. Use the document's exact biomarker name and unit. Pull `reference_min` and `reference_max` from the lab's reference range when shown; use `null` for either bound if the document does not show it. Do NOT compute or interpret status (high / low / critical) — that is computed server-side.
>
> When `category` is not `"blood_work"`, omit the `biomarkers` array entirely.

Keep `max_tokens: 1024` for now (panel typically <30 biomarkers; ~30 × ~25 tokens = 750 tokens of JSON). If the model occasionally truncates, raise to 2048 — flag in the handoff.

#### `lib/uploads/persist-lab-results.ts`

```ts
import type { BiomarkerExtraction, JanetResult } from "./janet";

/** Status derivation. Pure. Returns null when either bound is unknown. */
export function deriveStatus(
  value: number,
  reference_min: number | null,
  reference_max: number | null,
): "low" | "optimal" | "high" | "critical" | null {
  if (reference_min == null || reference_max == null) return null;
  if (reference_max <= 0 || reference_min < 0) return null; // sanity
  if (value > reference_max * 1.5) return "critical";
  if (value < reference_min * 0.5) return "critical";
  if (value > reference_max) return "high";
  if (value < reference_min) return "low";
  return "optimal";
}

export type LabRowDraft = {
  user_uuid: string;
  upload_id: string;
  test_date: string;       // YYYY-MM-DD; falls back to today's UTC date if Janet didn't return one
  panel_name: string | null;
  lab_provider: string | null;
  biomarker: string;
  value: number;
  unit: string;
  reference_min: number | null;
  reference_max: number | null;
  optimal_min: null;       // not extracted by Janet today
  optimal_max: null;
  status: "low" | "optimal" | "high" | "critical" | null;
  category: null;          // not classified per-row this round; the panel-level category is on patient_uploads
  trend: null;
  notes: null;
};

/** Build the row drafts. Pure. Returns [] for non-blood_work or empty biomarkers. */
export function extractLabResults(
  janet: JanetResult,
  userId: string,
  uploadId: string,
): LabRowDraft[];
```

Behaviour rules for `extractLabResults`:
- If `janet.category !== 'blood_work'` → `[]`.
- If `janet.findings.biomarkers` is missing or empty → `[]`.
- For each `BiomarkerExtraction`:
  - Skip if `biomarker` empty/whitespace.
  - Skip if `value` is not a finite number.
  - Skip if `unit` empty/whitespace.
  - `test_date` source priority: `b.test_date` → `findings.date_of_test` → today's UTC date string.
  - Compute `status = deriveStatus(value, reference_min, reference_max)`.
  - Build `LabRowDraft` with `user_uuid`, `upload_id`, all fields verbatim.

Plus an impure helper that does the actual write (small, integration-style):

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function persistLabResults(
  admin: SupabaseClient,
  janet: JanetResult,
  userId: string,
  uploadId: string,
): Promise<{ inserted: number; skipped: number }>;
```

Behaviour:
- `drafts = extractLabResults(janet, userId, uploadId)`.
- If empty → `{ inserted: 0, skipped: 0 }`.
- Insert via `admin.schema("biomarkers" as never).from("lab_results").insert(drafts).select('id')`.
- On unique-violation (23505 from the new partial index), Supabase returns an error; in that case fall back to per-row insert with try/catch so re-uploads of the same panel succeed (with `skipped` count).
- Return `{ inserted, skipped }`.

#### Tests

`derive-status.test.ts` (≥ 8 cases):
1. `value=100, min=null, max=null` → `null`.
2. `value=100, min=null, max=200` → `null` (need both bounds).
3. `value=50, min=70, max=200` → `"low"`.
4. `value=250, min=70, max=200` → `"high"`.
5. `value=400, min=70, max=200` → `"critical"` (>1.5× max).
6. `value=20, min=70, max=200` → `"critical"` (<0.5× min).
7. `value=100, min=70, max=200` → `"optimal"`.
8. `value=100, min=0, max=0` → `null` (sanity: zero range).
9. (Edge) `value=200, min=70, max=200` → `"optimal"` (boundary inclusive).
10. (Edge) `value=70, min=70, max=200` → `"optimal"` (lower boundary inclusive).

`extract-lab-results.test.ts` (≥ 6 cases):
1. Imaging fixture → `[]` (wrong category).
2. blood_work but `biomarkers` missing → `[]`.
3. blood_work with two valid biomarkers → 2 rows; check `status` derived correctly.
4. blood_work with one biomarker missing `value` (NaN) → skipped.
5. blood_work with `b.test_date` null but `findings.date_of_test` set → row uses `findings.date_of_test`.
6. blood_work with both null → row uses today's UTC date.
7. Critical-range biomarker fixture → `status === "critical"`.

`janet-prompt.test.ts` (≥ 1 case):
- Import `SYSTEM_PROMPT` (export it from `janet.ts` if not already) and assert it contains the literal string `"biomarkers"` and the words `"computed server-side"`. Defends against an accidental prompt regression that drops the new field.

**Acceptance criteria:**
- `pnpm build` clean.
- `pnpm test` green; ≥ 15 new test cases under `tests/unit/uploads/`.
- Migration file written, NOT applied.
- `JanetResult` type backwards-compatible (existing consumers using `findings.key_values` still work).
- No new dependencies.
- `SYSTEM_PROMPT` extension fits inside the existing 1024 max_tokens budget (verify by character-counting the system prompt — it should still be under ~1500 chars).

**Rules to apply:**
- `.claude/rules/database.md` — idempotent migration; RLS unchanged; index named consistently.
- `.claude/rules/data-management.md` — single-writer principle; no PII; verbatim storage (no canonicalisation).
- `.claude/rules/ai-agents.md` — single LLM call per upload (preserved); adaptive thinking unchanged.
- `.claude/rules/nextjs-conventions.md` — pure helpers in `lib/`.

---

### Task 2 — Upload-action wiring

**Files affected:**
- `app/(app)/uploads/actions.ts` (modify).
- (No new test file required — the upload action is integration-tested manually; the persistence helper is already covered by Task 1's unit tests.)

**What to build:**

In `app/(app)/uploads/actions.ts::recordUpload()`, between the `admin.from("patient_uploads").update({ janet_status: "done", ... })` step and the `triggerPipeline("supplement-protocol", user.id)` call, add:

```ts
// Janet → lab_results writer: persist any biomarkers Janet extracted from the
// document into biomarkers.lab_results. Best-effort — failure must not block
// the upload response. Idempotent on (user_uuid, biomarker, test_date) via the
// 0032 unique partial index.
try {
  const { inserted, skipped } = await persistLabResults(admin, result, user.id, row.id);
  if (inserted > 0 || skipped > 0) {
    console.info(
      `[lab-results] upload=${row.id} inserted=${inserted} skipped=${skipped}`,
    );
  }
} catch (err) {
  console.error("[lab-results] persistence failed:", err);
}
```

Add to the imports at the top of the file:

```ts
import { persistLabResults } from "@/lib/uploads/persist-lab-results";
```

**Order matters:** lab rows must be written **before** `triggerPipeline("supplement-protocol", ...)` so Sage's next run sees fresh data, AND **before** the existing B7 alerts hook so `evaluateLabAlerts` finds rows. The B7 hook stays exactly as-is — it'll just have data to read now.

Re-validate `/labs` and `/dashboard` after the upload completes (already done by `revalidatePath("/uploads"); revalidatePath("/dashboard");` at the end). Add `revalidatePath("/labs")` too:

```ts
revalidatePath("/uploads");
revalidatePath("/dashboard");
revalidatePath("/labs");
```

**Acceptance criteria:**
- Upload action imports and calls `persistLabResults` between Janet's done-update and `triggerPipeline`.
- Failure of `persistLabResults` does not bubble — try/catch wraps it.
- `revalidatePath("/labs")` added.
- `pnpm build` clean.
- `pnpm test` green.
- Manual: upload a blood-work fixture document; observe rows in `biomarkers.lab_results`; observe `/labs` populated; observe a `member_alerts` chip on `/dashboard` if any biomarker is `low`/`high`/`critical`.

**Rules to apply:**
- `.claude/rules/security.md` — admin client only inside the upload action (existing); never log Janet's full prompt or document content (existing pattern preserved).
- `.claude/rules/data-management.md` — `lab_results` is biomarkers (de-identified) schema; PII boundary respected.
- `.claude/rules/ai-agents.md` — pipeline-style write is idempotent and non-fatal.

---

## Build order

Sequential. Task 1 must complete before Task 2 (Task 2 imports `persistLabResults`).

## Per-task review gate

Spec compliance + code-quality reviews per task. Both must pass before marking complete.

## Definition of done (whole change)

1. Both tasks ✅ on both reviews.
2. `pnpm build` clean.
3. `pnpm test` green with ≥ 15 new tests under `tests/unit/uploads/`.
4. Migration `0032_lab_results_idempotency.sql` applied to remote (operator).
5. Manual smoke: upload a real blood panel; see typed rows in `biomarkers.lab_results`; see them on `/labs`; see a `member_alerts` chip on `/dashboard` if any biomarker is out of range.
6. `JanetResult` type extended; existing consumers compile cleanly.
7. CHANGELOG, EXECUTIVE_SUMMARY, QA_REPORT present.

## Out of scope (carried forward + reality flags)

- Biomarker name canonicalisation (`LDL` vs `LDL-C`).
- Unit normalisation (`mg/dL` ↔ `mmol/L`).
- `optimal_min/max` extraction (separate from `reference_min/max`).
- `borderline` status logic.
- `trend` computation from history.
- Re-processing existing uploads.
- Imaging / genetic / microbiome / metabolic structured extraction.
- Migration renumber cleanup (cosmetic 0025/0026 collisions).

## Plan-review addenda (post Phase 4)

The plan reviewer cleared APPROVED WITH NOTES. The following are mandatory for the executor:

1. **Bump `max_tokens` to 2048** in `lib/uploads/janet.ts`. The original 1024 budget is tight once the new `biomarkers` array (≥30 entries × ~80 chars × ~80 chars/token-ish) is added on top of `key_values` + `notable_findings` + `summary` + adaptive-thinking budget. A truncated JSON output causes a parse error which fails the whole upload. Bump preemptively rather than as a follow-up.
2. **Add a swapped-bounds test case** to `derive-status.test.ts`. The Risks section already names this scenario (`min=200, max=70`); assert that `deriveStatus(100, 200, 70)` returns `null` (or whatever the sanity-checked behaviour is — confirm against the implementation that the swap is detected by `reference_max <= 0` or by a min-vs-max check). If the current implementation does NOT detect swapped bounds, add a check `if (reference_min > reference_max) return null` and a test for it.
3. **Add a `value === 0` test case** to `extract-lab-results.test.ts`. Zero is a legitimate value for some biomarkers (detection-limit reads, ketones, certain hormones). Assert that a row with `value: 0` is **kept**, not skipped. The plan's `Number.isFinite(value)` check already does this correctly — the test is the safety net against a future "if (!value)" regression.

These are non-blocking; the plan is approved. The executor reads this section before starting Task 1.

## Risks

- **Janet may hallucinate biomarker names or values.** Mitigation: verbatim storage means a wrong name won't pollute a canonical lookup table (we don't have one yet); a wrong value will be visible in the UI and a clinician can spot it. The risk-engine layer is downstream; if it consumes garbage, it produces low-confidence scores — which is the correct degradation.
- **Same panel uploaded twice.** Idempotency index handles it; per-row try/catch on insert means re-uploads succeed with `skipped` count.
- **Janet emits 50+ biomarkers and busts max_tokens.** Mitigation: instructions say "one entry per measured biomarker." If we see truncation in production, raise to 2048 in a follow-up.
- **`reference_min`/`max` swapped or zero.** `deriveStatus` sanity checks (`max <= 0 || min < 0` → null) cover the obvious cases. A swapped pair (e.g. min=200, max=70) would produce nonsensical status — accept this risk; rare in clinical documents.
