# Plan: conversation-compression
Date: 2026-04-28
Phase: Phase 3 — Epic 6 (The Coach)
Status: Approved

## Objective

Implement the "older turns summarised to one sentence per session" rule from `.claude/rules/ai-agents.md`. When a patient's `agent_conversations` table accumulates more than 20 turns with Janet, the older turns beyond the window should be compressed into a rolling summary stored in `agents.conversation_summaries`. `PatientContext.load()` then loads both the last 20 turns and the pre-computed summary, giving Janet full cross-session memory without blowing the context window. Compression runs non-blockingly after each Janet turn in `onFinish`.

Done means: patients who have had >20 Janet turns see a `## Session summary` section in their system context summarising prior sessions, and the `agent_conversations` query stays capped at 20 rows regardless of history length.

## Scope

In scope:
- `agents.conversation_summaries` table (new)
- `lib/ai/compression.ts` — `compressConversation(userId, agent)` function
- `patient-context.ts` — load summary from `conversation_summaries`, surface in `summariseContext`
- `janet.ts` — call `compressConversation` non-blockingly in `onFinish` when total turn count hits threshold
- Unit tests for the compression logic (mock Supabase + mock LLM)
- Integration test: compression is triggered when total turns exceed 20

Out of scope:
- Compression for Alex (no PatientContext, minimal history)
- Summarising within the current session window (only older turns are compressed)
- UI showing conversation summary to patient
- Deleting old turns (kept for audit; only surfaced selectively)

## Data model changes

### `agents.conversation_summaries` (new table)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid DEFAULT gen_random_uuid()` | PK |
| `user_uuid` | `uuid NOT NULL` | FK → `auth.users(id)` |
| `agent` | `text NOT NULL` | `'janet'` for now |
| `summary` | `text NOT NULL` | 2–4 sentence rolling summary of turns outside the 20-turn window |
| `last_compressed_turn_id` | `uuid` | id of the most recent turn included in the summary (for deduplication) |
| `updated_at` | `timestamptz DEFAULT now()` | |

Not PII. Written only by the Janet agent via service_role (admin client). Authenticated users can SELECT their own row.

One row per (user_uuid, agent) — upsert on conflict.

---

## Tasks

---

### Task 1 — DB: `agents.conversation_summaries` table

**Files affected:**
- `supabase/migrations/0029_conversation_summaries.sql` (new)
- `lib/supabase/database.types.ts` (regenerate)

**What to build:**

```sql
CREATE TABLE IF NOT EXISTS agents.conversation_summaries (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uuid               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent                   text        NOT NULL CHECK (agent IN ('janet', 'alex')),
  summary                 text        NOT NULL,
  last_compressed_turn_id uuid,
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT conversation_summaries_user_agent_unique UNIQUE (user_uuid, agent)
);

ALTER TABLE agents.conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_summaries_patient_select"
  ON agents.conversation_summaries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_uuid);

-- Note: no service_role policy needed — Supabase service_role bypasses RLS by default.

CREATE INDEX IF NOT EXISTS conv_summaries_user_agent_idx
  ON agents.conversation_summaries (user_uuid, agent);
```

After writing: `supabase db push --linked` then regenerate types:
```bash
supabase gen types typescript --project-id raomphjkuypigdhytbzn \
  --schema public --schema agents --schema biomarkers --schema billing \
  > lib/supabase/database.types.ts
```

**Acceptance criteria:**
- [ ] Migration file exists and is idempotent
- [ ] Table has UNIQUE constraint on (user_uuid, agent)
- [ ] RLS: authenticated SELECT own rows (no explicit service_role policy — bypassed by default)
- [ ] `lib/supabase/database.types.ts` contains `conversation_summaries` under `agents`
- [ ] `pnpm build` passes

**Rules:** `.claude/rules/database.md`, `.claude/rules/security.md`

---

### Task 2 — `lib/ai/compression.ts`

**Files affected:**
- `lib/ai/compression.ts` (new)

**What to build:**

Export `compressConversation(userId: string, agent: string): Promise<void>`.

Logic:
1. Load ALL turns for this user+agent from `agents.agent_conversations`, ordered ascending.
2. Load current summary (if any) from `agents.conversation_summaries`.
3. Count total turns. If `totalTurns <= 20`, return early — nothing to compress.
4. Take all turns EXCEPT the 20 most recent. These are the "old turns" to compress.
5. If `last_compressed_turn_id` matches the last old turn's id, return early — already up to date.
6. Build a compression prompt:
   ```
   Summarise the following patient–Janet conversation history in 1–3 sentences.
   Focus on: what the patient was concerned about, what Janet recommended, any follow-up agreed.
   Be factual and concise. Do not invent details. Keep the summary under 300 characters.
   [If prior summary exists]: Prior summary to extend: <prior summary>

   Turns to summarise:
   [role]: [content]
   ...
   ```
   Note: "one sentence per session" is the target brevity; 1–3 is the allowed range for context-rich sessions. The `summary` column cap is 600 chars max.
7. Call the Anthropic API directly via `generateText` (do NOT use `createPipelineAgent` — compression is a background pipeline worker, not Janet's real-time agent; mixing the two execution models violates the rules). Use `SummarySchema = z.object({ summary: z.string().min(20).max(600) })` with `Output.object({ schema: SummarySchema })`, model `claude-haiku-4-5-20251001`, temperature 0.
8. Upsert into `agents.conversation_summaries`:
   ```ts
   await agentsDb.from('conversation_summaries').upsert({
     user_uuid: userId,
     agent,
     summary: result.summary,
     last_compressed_turn_id: oldTurns[oldTurns.length - 1].id,
     updated_at: new Date().toISOString(),
   }, { onConflict: 'user_uuid,agent' });
   ```
9. Any error: log `[Compression] failed for user ${userId}:` and swallow. Never throw.

**Use the admin client** throughout: `(createAdminClient() as any).schema('agents')`.

**Acceptance criteria:**
- [ ] Returns early when `totalTurns <= 20` (no LLM call)
- [ ] Returns early when summary is already current (`last_compressed_turn_id` matches)
- [ ] Calls LLM with the old turns concatenated and any prior summary
- [ ] Upserts the summary on `(user_uuid, agent)` conflict
- [ ] Never throws — all errors caught and logged
- [ ] `pnpm build` passes

**Rules:** `.claude/rules/ai-agents.md`, `.claude/rules/data-management.md`

---

### Task 3 — Wire into `patient-context.ts` and `janet.ts`

**Files affected:**
- `lib/ai/patient-context.ts`
- `lib/ai/agents/janet.ts`

**patient-context.ts changes:**

1. Add `conversationSummary: string | null` to the `PatientContext` interface.

2. Add a 9th item to the `Promise.all` in `loadPatientContext`:
   ```ts
   // Conversation summary (pre-compressed older turns)
   (admin as any)
     .schema('agents')
     .from('conversation_summaries')
     .select('summary')
     .eq('user_uuid', userId)
     .eq('agent', options.agent ?? 'janet')
     .maybeSingle()
     .then((r: { data: { summary: string } | null }) => r)
     .catch(() => ({ data: null })),
   ```
   Destructure as `conversationSummaryResult`.
   Add to return: `conversationSummary: conversationSummaryResult.data?.summary ?? null`.

3. In `summariseContext`, add before the `recentConversation` block:
   ```ts
   if (ctx.conversationSummary) {
     lines.push(`\n## Prior session summary`);
     lines.push(ctx.conversationSummary);
   }
   ```

**janet.ts changes:**

In `onFinish`, after the `Promise.allSettled` that saves the current turn, add a non-blocking compression trigger:
```ts
import { compressConversation } from '@/lib/ai/compression';

// Non-blocking: compress older turns if window exceeded
compressConversation(userId, 'janet').catch(() => {});
```

**Acceptance criteria:**
- [ ] `PatientContext` interface has `conversationSummary: string | null`
- [ ] `loadPatientContext` loads summary in the same `Promise.all` (not a sequential call)
- [ ] `summariseContext` outputs `## Prior session summary` section when summary exists
- [ ] Janet's `onFinish` fires `compressConversation` non-blockingly (no await, no crash if it fails)
- [ ] `pnpm build` passes; `pnpm test` passes
- [ ] **IMPORTANT**: The interface addition, Promise.all item, and summariseContext block must land in a single atomic commit — splitting them will cause a TypeScript error on the PatientContext interface mismatch.

**Rules:** `.claude/rules/ai-agents.md`

---

### Task 4 — Tests

**Files affected:**
- `tests/unit/ai/compression.test.ts` (new)
- `tests/integration/ai/compression.test.ts` (new)

**Unit tests** — `tests/unit/ai/compression.test.ts`:

Mock: `vi.mock('@/lib/supabase/admin', ...)` and `vi.mock('ai', () => ({ generateText: vi.fn(), Output: { object: vi.fn() } }))`.

Test cases:
- Returns early when total turns ≤ 20 (no LLM call)
- Returns early when `last_compressed_turn_id` matches newest old turn (already current)
- Calls LLM with correct concatenated prompt when old turns exist
- Upserts summary correctly on success
- Swallows errors without throwing

**Integration test** — `tests/integration/ai/compression.test.ts`:

Mock Supabase chain and agent-factory. Simulate 25 turns. Assert:
- LLM called with turns 1–5 (the 25 − 20 = 5 old turns)
- `conversation_summaries` upsert called with correct `last_compressed_turn_id`

**Acceptance criteria:**
- [ ] All tests pass
- [ ] No real network calls or DB in tests
- [ ] `pnpm test` passes with 165+ tests

**Rules:** Standard Vitest patterns.

---

## Build order

Task 1 → Task 2 → Task 3 → Task 4

Sequential. Migration must exist before code references the new table. Compression function must exist before janet.ts imports it.
