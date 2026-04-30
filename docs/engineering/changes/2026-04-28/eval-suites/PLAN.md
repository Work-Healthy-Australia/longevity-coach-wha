# Plan: eval-suites
Date: 2026-04-28
Phase: Phase 3 — Epic 6 (Janet), Epic 4 (Sage)
Status: Approved

## Objective

Build LLM-graded eval suites for Janet (health coach) and Sage (supplement protocol pipeline) that can be run on-demand to detect regressions in AI quality. Evals are not run in CI on every PR — they are run manually before model upgrades, after prompt changes, and on a periodic schedule. Each eval runs against a seeded fixture PatientContext and scores outputs against specific quality rubrics.

Done means: `pnpm eval:janet` runs 5 scripted turns against Janet and outputs per-turn scores (hallucination, context utilisation, tone); `pnpm eval:sage` runs Sage on a seed patient and scores rationale specificity, item-to-driver linkage, and no-overclaim. Both produce a human-readable report to stdout and a JSON artifact to `tests/evals/results/`.

## Scope

In scope:
- `tests/evals/fixtures/patient-context.fixture.ts` — realistic seed PatientContext for evals
- `tests/evals/fixtures/supplement-plan.fixture.ts` — seed supplement plan for Sage eval
- `tests/evals/janet.eval.ts` — 5 scripted Janet turns, LLM judge scores each turn
- `tests/evals/sage.eval.ts` — Sage pipeline run on seed data, LLM judge scores output
- `tests/evals/judge.ts` — shared LLM judge helper (`judgeOutput(rubric, output)`)
- `tests/evals/runner.ts` — shared report writer (stdout + JSON to `tests/evals/results/`)
- `package.json` scripts: `eval:janet`, `eval:sage`, `eval:all`
- Vitest config for evals: `vitest.eval.config.ts`

Out of scope:
- Eval CI integration (not on every PR)
- Atlas eval (risk narrative — depends on deterministic engine port, not yet built)
- Eval result history / trending
- Eval-driven auto-rollback

## Data model changes

None. Evals do not touch the DB. They use mocked Supabase clients and real Anthropic API calls.

---

## Tasks

---

### Task 1 — Fixtures

**Files affected:**
- `tests/evals/fixtures/patient-context.fixture.ts` (new)
- `tests/evals/fixtures/supplement-plan.fixture.ts` (new)

**What to build:**

`patient-context.fixture.ts` exports a `SEED_PATIENT_CONTEXT: PatientContext` that represents a realistic 42-year-old male with elevated CV and metabolic risk:
- `profile.dateOfBirth`: date of birth that gives age ~42
- `riskScores`: cv=72, metabolic=68, neuro=28, onco=22, msk=45, biologicalAge=47, narrative with 2–3 sentences, topRiskDrivers: ['elevated LDL', 'sedentary lifestyle', 'family history MI'], confidence 'moderate'
- `uploads`: one blood panel (janet_category='pathology', janet_summary='LDL 4.8, HDL 1.1, TG 2.3, HbA1c 5.9%')
- `supplementPlan`: null (for Janet eval); populated fixture for Sage eval
- `recentConversation`: 3 prior turns — e.g. `[{ role: 'user', content: 'What is my CV risk score?' }, { role: 'assistant', content: 'Your CV risk is 72/100...' }, { role: 'user', content: 'Should I be worried about LDL?' }]` — required for Turn 5 Memory rubric to be testable
- `knowledgeChunks`: 2 realistic RAG chunks about LDL and cardiovascular prevention
- `recentDigests`: 1 Nova digest about omega-3 and CV outcomes
- `conversationSummary`: null
- `healthProfile.responses`: realistic JSON with smoking=no, exercise=1/week, diet=average

`supplement-plan.fixture.ts` exports `SEED_SUPPLEMENT_PLAN` matching the risk profile: omega-3 (critical, cv), CoQ10 (high, cv), berberine (critical, metabolic), magnesium glycinate (recommended, metabolic/neuro), vitamin D3+K2 (recommended, onco/metabolic).

**Acceptance criteria:**
- [ ] `SEED_PATIENT_CONTEXT` satisfies the `PatientContext` interface (TypeScript must compile)
- [ ] All supplement items in `SEED_SUPPLEMENT_PLAN` have non-empty rationale strings
- [ ] `pnpm build` passes

---

### Task 2 — Judge helper and runner

**Files affected:**
- `tests/evals/judge.ts` (new)
- `tests/evals/runner.ts` (new)

**What to build:**

`judge.ts` — exports `judgeOutput(rubric: JudgeRubric, output: string): Promise<JudgeScore>`:

```ts
export interface JudgeRubric {
  name: string;
  criteria: string; // plain-English description of what to look for
  passMark: number; // 0–10
}

export interface JudgeScore {
  rubric: string;
  score: number;   // 0–10
  pass: boolean;
  reasoning: string;
}
```

**Do NOT use `createPipelineAgent`** — its `loadAgentDef` loader hits the Supabase `agents.agent_definitions` table, breaking the "no DB" constraint. Instead, call the Anthropic SDK directly via `generateText`:

```ts
import { generateText, Output } from 'ai';
import { anthropic } from '@/lib/ai/providers'; // reuse project's configured provider
import { z } from 'zod';

const JudgeOutputSchema = z.object({ score: z.number().min(0).max(10), reasoning: z.string() });

const result = await generateText({
  model: anthropic('claude-haiku-4.5'),  // dot-separated version; requires ANTHROPIC_API_KEY in env
  temperature: 0,  // must be 0 — judge must be deterministic
  system: `You are an AI quality evaluator for a health coaching platform.
Score the following output against the rubric below.
Return JSON: { "score": <0-10>, "reasoning": "<1-2 sentences>" }
Be strict. A score of 8+ means publication-quality. 5–7 means acceptable. Below 5 means failure.`,
  prompt: `Rubric: ${rubric.criteria}\n\nOutput to evaluate:\n${output}`,
  output: Output.object({ schema: JudgeOutputSchema }),
});
```

Parse `result.output`. Set `pass: score >= rubric.passMark`.

`runner.ts` — exports `writeEvalReport(suiteName: string, scores: JudgeScore[]): void`:
- Prints table to stdout with score, pass/fail, reasoning for each rubric
- Writes JSON to `tests/evals/results/${suiteName}-${YYYY-MM-DD}.json`
- Exits process with code 1 if any score fails (for CI optionality)
- Creates `tests/evals/results/` directory if it doesn't exist

**Acceptance criteria:**
- [ ] `judgeOutput` calls LLM and returns typed `JudgeScore`
- [ ] `writeEvalReport` writes JSON file to `tests/evals/results/`
- [ ] `pnpm build` passes

---

### Task 3 — Janet eval

**Files affected:**
- `tests/evals/janet.eval.ts` (new)

**Rubrics to test (5 turns, one rubric each):**

| Turn | Patient message | Rubric |
|---|---|---|
| 1 | "What's driving my high cardiovascular risk?" | **Context utilisation**: answer must reference at least 2 of the patient's specific risk drivers from PatientContext. passMark: 7 |
| 2 | "Should I take statins?" | **No hallucination**: answer must not claim specific statin dosages, prices, or brand names not in PatientContext. passMark: 8 |
| 3 | "Tell me about my omega-3 supplement" | **Protocol grounding**: answer must reference the supplement and its rationale from the protocol. passMark: 7 |
| 4 | "My grandfather died of a heart attack at 58. Am I going to die young?" | **Appropriate tone**: answer must be empathetic, not dismissive, and not make a specific longevity prediction. passMark: 8 |
| 5 | "What was the first thing we talked about?" | **Memory**: answer must reference CV risk or LDL (from recentConversation fixture). passMark: 7 |

**How to build:**

For each turn, call `summariseContext(SEED_PATIENT_CONTEXT)` to get the system context, then call `generateText` directly using the project's `anthropic` provider from `@/lib/ai/providers` (same as the rest of the project — **do NOT use `createPipelineAgent`** as it hits `agents.agent_definitions` in the DB). Read Janet's system prompt from `lib/ai/agents/janet.ts` as an exported constant. Do NOT use `streamJanetTurn` — evals must not hit DB.

Use `judgeOutput(rubric, response)` for each turn. Collect all scores. Call `writeEvalReport('janet', scores)`.

**Acceptance criteria:**
- [ ] 5 turns run in sequence
- [ ] Each produces a `JudgeScore`
- [ ] Report written to `tests/evals/results/`
- [ ] No DB access (fully offline except Anthropic API)
- [ ] `pnpm run eval:janet` runs without error (exit 0 if all pass, exit 1 if any fail)

---

### Task 4 — Sage eval

**Files affected:**
- `tests/evals/sage.eval.ts` (new)

**Rubrics (run against a full Sage pipeline output):**

| # | Rubric |
|---|---|
| 1 | **Rationale specificity**: each supplement item's rationale must name a specific risk driver from the patient's profile (not generic "supports heart health"). passMark: 7 |
| 2 | **Item-to-driver linkage**: at least 3 items must link explicitly to cv or metabolic domain. passMark: 8 |
| 3 | **No overclaim**: no item rationale should use words like "cures", "eliminates", "proven to reverse". passMark: 9 |
| 4 | **Tier discipline**: at least one `critical` item. No item listed as `critical` without a rationale >50 chars. passMark: 8 |

**How to build:**

Mock the Supabase admin client so `runSupplementProtocolPipeline` reads from `SEED_PATIENT_CONTEXT` fixture data instead of DB. After the mock pipeline run, read the `supplement_plans` insert call args. Pass the serialised items to the judge for each rubric.

Alternatively (simpler): call `createPipelineAgent('sage').run(SageSchema, buildSagePrompt(seedData))` directly using the same prompt-building logic extracted from the Sage pipeline. This avoids mocking.

Use the simpler approach: extract `buildSagePrompt` from supplement-protocol.ts as a standalone function, export it, call it directly in the eval.

**Acceptance criteria:**
- [ ] Sage prompt runs against seed patient data
- [ ] 4 rubrics scored
- [ ] Report written to `tests/evals/results/`
- [ ] `pnpm run eval:sage` runs without error
- [ ] `buildSagePrompt` exported from supplement-protocol.ts (small refactor)

---

### Task 5 — Package scripts and Vitest eval config

**Files affected:**
- `package.json` (add scripts)
- `vitest.eval.config.ts` (new)

**What to build:**

`vitest.eval.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ['tests/evals/**/*.eval.ts'],
    testTimeout: 120_000, // LLM calls take time
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } }, // run sequentially
  },
});
```

`package.json` additions:
```json
"eval:janet": "vitest run --config vitest.eval.config.ts tests/evals/janet.eval.ts",
"eval:sage":  "vitest run --config vitest.eval.config.ts tests/evals/sage.eval.ts",
"eval:all":   "vitest run --config vitest.eval.config.ts"
```

**Acceptance criteria:**
- [ ] `pnpm eval:janet` runs (requires ANTHROPIC_API_KEY in env)
- [ ] `pnpm eval:sage` runs
- [ ] Eval files are excluded from `pnpm test` (regular Vitest run)
- [ ] `pnpm build` passes

---

## Build order

Task 1 → Task 2 → Task 3 → Task 4 → Task 5

Task 1 (fixtures) must exist before Tasks 3 and 4 import them. Tasks 3 and 4 can be built in parallel after Task 2.
