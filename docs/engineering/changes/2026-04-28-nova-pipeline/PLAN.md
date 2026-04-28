# Plan: nova-pipeline
Date: 2026-04-28
Phase: Phase 3 (Epic 3.5.3 — Insights Feed) / P7 in agent build order
Status: Approved

## Objective

Build the Nova Research Digest Pipeline: a weekly background cron that fetches recent scientific literature from PubMed across 6 health categories, synthesizes each category into a structured digest via Claude, chunks and embeds the digests into `agents.health_knowledge` for Janet's RAG layer, and stores the digests in `agents.health_updates` for the future member insights feed. Nova is the sole writer to `health_knowledge`. It replaces the current stub in `lib/ai/pipelines/nova.ts`.

Done means: a weekly Vercel Cron fires, Nova runs end-to-end within 300 s, `health_updates` accumulates digest rows, `health_knowledge` is refreshed with current literature chunks, and Janet's RAG layer reflects the latest evidence on next session start.

## Scope

In scope:
- `agents.health_updates` table (new) with row-level security
- `agents.agent_definitions` INSERT for `nova` slug
- Full implementation of `lib/ai/pipelines/nova.ts` (5-phase: search, fetch, synthesize, chunk+embed, upsert/prune)
- PubMed NCBI E-utilities integration (free, no API key required)
- `app/api/cron/nova/route.ts` GET handler
- `vercel.json` weekly cron entry
- Updated `lib/supabase/database.types.ts` (regenerated in Task 1)
- Update `lib/ai/patient-context.ts` to load latest 3 digests from `health_updates`
- Integration test for the pipeline with mocked HTTP dependencies
- Unit tests for the chunking helper

Out of scope:
- Member-facing insights feed UI (separate sprint)
- medRxiv/bioRxiv integration (PubMed is sufficient for v1)
- Admin UI to trigger Nova manually
- Category rotation logic across weeks

## Data model changes

### `agents.health_updates` (new table)
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid DEFAULT gen_random_uuid()` | PK |
| `run_id` | `uuid NOT NULL` | Groups all digests from a single Nova run |
| `title` | `text NOT NULL` | Digest headline |
| `content` | `text NOT NULL` | 2–3 paragraphs, actionable, plain language |
| `category` | `text NOT NULL` | CHECK in ('cv','metabolic','neuro','onco','msk','supplements') |
| `source` | `text NOT NULL` | Primary source URL or journal name |
| `evidence_level` | `text NOT NULL` | CHECK in ('strong','moderate','preliminary') |
| `created_at` | `timestamptz DEFAULT now()` | |

Not PII. Written only by Nova (service_role). Authenticated users can SELECT. No personal data.

### `agents.agent_definitions` — new row for `nova`
Data INSERT only (no schema change). See Task 1 for system prompt text.

### `agents.health_knowledge` — no schema change
Nova writes new rows and prunes rows older than 90 days. The `metadata` JSONB column gets a `run_id` key per chunk.

---

## Tasks

---

### Task 1 — DB: `health_updates` table + `nova` agent_definitions row

**Files affected:**
- `supabase/migrations/0027_nova_health_updates.sql` (new)
- `lib/supabase/database.types.ts` (regenerate after applying migration)

**What to build:**

Create `supabase/migrations/0027_nova_health_updates.sql`:

```sql
-- health_updates: stores structured research digests written by Nova.
CREATE TABLE IF NOT EXISTS agents.health_updates (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         uuid        NOT NULL,
  title          text        NOT NULL,
  content        text        NOT NULL,
  category       text        NOT NULL,
  source         text        NOT NULL,
  evidence_level text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT health_updates_category_check
    CHECK (category IN ('cv','metabolic','neuro','onco','msk','supplements')),
  CONSTRAINT health_updates_evidence_level_check
    CHECK (evidence_level IN ('strong','moderate','preliminary'))
);

ALTER TABLE agents.health_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read health_updates"
  ON agents.health_updates FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS health_updates_created_at_idx
  ON agents.health_updates (created_at DESC);

-- Nova agent definition
INSERT INTO agents.agent_definitions (slug, display_name, model, provider, system_prompt, temperature, max_tokens, enabled)
VALUES (
  'nova',
  'Nova',
  'claude-sonnet-4-6',
  'anthropic',
  E'You are Nova, a research synthesis specialist for a longevity health platform.\n\nYour job: given a set of recent scientific paper abstracts from PubMed in a specific health domain, synthesise a concise, actionable digest for health-conscious adults.\n\nRules:\n- Distinguish strong evidence (RCTs, systematic reviews, large cohorts) from preliminary findings (observational studies, small trials, animal studies).\n- Never present preliminary findings as recommendations. Label evidence level explicitly: "Strong evidence:", "Preliminary evidence:", "Expert consensus:".\n- Use plain language. No jargon without explanation.\n- Content is generic — not personalised to any individual.\n- Focus on longevity, prevention, and optimisation.\n- Always include a specific, actionable takeaway even for preliminary findings ("worth watching, not yet acting on").\n- 2–3 paragraphs per digest. Concise.',
  0.3,
  2048,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  display_name  = EXCLUDED.display_name,
  model         = EXCLUDED.model,
  system_prompt = EXCLUDED.system_prompt,
  temperature   = EXCLUDED.temperature,
  max_tokens    = EXCLUDED.max_tokens,
  enabled       = EXCLUDED.enabled,
  updated_at    = now();
```

After writing the migration, apply it with:
```bash
supabase db push --linked
```

Then regenerate TypeScript types:
```bash
supabase gen types typescript --project-id raomphjkuypigdhytbzn \
  --schema public --schema agents --schema biomarkers --schema billing \
  > lib/supabase/database.types.ts
```
Strip any stray CLI upgrade notice lines from the end of the generated file (lines starting with "A new version of Supabase CLI").

**Acceptance criteria:**
- [ ] `supabase/migrations/0027_nova_health_updates.sql` exists and is idempotent
- [ ] `agents.health_updates` table exists in remote DB with all 8 columns and both check constraints
- [ ] RLS enabled on `health_updates`; authenticated SELECT policy present; no INSERT policy for users
- [ ] `agents.agent_definitions` has a `nova` row with the system prompt text above
- [ ] `lib/supabase/database.types.ts` contains `health_updates` under the `agents` namespace
- [ ] `pnpm build` passes (no TypeScript errors from the new types)

**Rules:** `.claude/rules/database.md`, `.claude/rules/data-management.md`, `.claude/rules/security.md`

---

### Task 2 — Nova pipeline implementation

**Files affected:**
- `lib/ai/pipelines/nova.ts` (full rewrite of stub)
- `lib/ai/patient-context.ts` (add health_updates to Promise.all)

**Context / imports you will need:**
- `createAdminClient` from `@/lib/supabase/admin`
- `createPipelineAgent` from `@/lib/ai/agent-factory` — signature: `createPipelineAgent(slug: string)` returns `{ run<T>(schema: ZodTypeAny, prompt: string): Promise<ZodInfer<T>> }`
- `embedText` from `@/lib/ai/rag` — signature: `embedText(texts: string[]): Promise<number[][]>` — calls OpenRouter perplexity/pplx-embed-v1-4b
- `z` from `zod`
- All Supabase calls use `(admin as any).schema('agents').from(...)` because supabase-js v2 TS generics don't resolve non-public schemas

**PubMed rate-limit note:**
NCBI E-utilities allows 3 requests/second without an API key. The pipeline makes 6 parallel `esearch` calls (Phase 1) — this may occasionally hit the limit. Add a 500 ms delay between the Phase 1 batch and the Phase 2 batch to stay within limits. If any `esearch` call returns a non-2xx status or empty `idlist`, skip that category gracefully.

#### Data types (define in nova.ts)

```ts
interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  sourceUrl: string; // https://pubmed.ncbi.nlm.nih.gov/<pmid>/
}

const DigestSchema = z.object({
  title: z.string(),
  content: z.string().min(50),
  evidence_level: z.enum(['strong', 'moderate', 'preliminary']),
  key_passages: z.array(z.string()).min(1).max(5),
  source_url: z.string(),
});
type Digest = z.infer<typeof DigestSchema>;
```

#### Phase 1 — PubMed search (6 parallel calls)

```ts
const CATEGORY_QUERIES: Record<string, string> = {
  cv:          'cardiovascular longevity prevention age heart',
  metabolic:   'metabolic health insulin longevity diabetes prevention',
  neuro:       'brain cognitive longevity neurodegeneration prevention',
  onco:        'cancer prevention longevity biomarkers early detection',
  msk:         'musculoskeletal longevity bone muscle aging sarcopenia',
  supplements: 'longevity supplements nutraceuticals clinical trial',
};
```

Search URL per category:
```
https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=<encoded_query>&retmax=5&retmode=json&sort=relevance&mindate=2024/01/01
```

Parse response: `data.esearchresult.idlist` → array of PMID strings.

#### Phase 2 — Fetch abstracts + deduplicate

Fetch all PMIDs across all categories in one batch:
```
https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=<comma-separated>&rettype=abstract&retmode=text
```

The plain-text response contains one block per article. Each block starts with the PMID line and ends with `PMID: <n>  [indexed for MEDLINE]` or similar. Parse into per-PMID title + abstract strings.

Deduplication — load recently seen sources from `agents.health_knowledge`:
```ts
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { data: recentRows } = await (admin as any)
  .schema('agents')
  .from('health_knowledge')
  .select('metadata')
  .gte('created_at', thirtyDaysAgo);
const recentSources = new Set(
  (recentRows ?? []).map((r: { metadata: { source?: string } }) => r.metadata?.source).filter(Boolean)
);
```

Skip articles whose `sourceUrl` is in `recentSources`.

Add the 500 ms delay here (`await new Promise(r => setTimeout(r, 500))`) before Phase 2 fetch.

#### Phase 3 — Synthesize (2 batches of 3 parallel LLM calls)

Split the 6 categories into `['cv','metabolic','neuro']` and `['onco','msk','supplements']`. Run batch 1 with `Promise.all`, await, then run batch 2.

For each category, build a prompt:
```
Category: <category>

Recent PubMed abstracts:
---
Title: <title>
Abstract: <abstract>
URL: <sourceUrl>
---
... (repeat for each article in this category)

Synthesise a digest following your system prompt instructions. Return JSON matching the schema.
```

Call `createPipelineAgent('nova').run(DigestSchema, prompt)`.

On error/Zod failure: log `[Nova] Category <category> failed: <error>`. Continue with remaining categories. Do not throw.

#### Phase 4 — Chunk + embed

`chunkText` helper (export this for testing):
```ts
export function chunkText(text: string, chunkWords = 300, overlapWords = 60): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    chunks.push(words.slice(start, start + chunkWords).join(' '));
    if (start + chunkWords >= words.length) break;
    start += chunkWords - overlapWords;
  }
  return chunks;
}
```

For each successful digest:
- Chunk `digest.content` with `chunkText(digest.content, 300, 60)`
- Add each `digest.key_passages` item as individual chunks
- Combine: all chunks across all categories into one array

Call `embedText(allChunks)` once for the whole batch.

#### Phase 5 — Upsert + prune

Generate `const runId = crypto.randomUUID()`.

Insert into `agents.health_updates` (batch):
```ts
const updates = successfulDigests.map((d) => ({
  run_id: runId,
  title: d.digest.title,
  content: d.digest.content,
  category: d.category,
  source: d.digest.source_url,
  evidence_level: d.digest.evidence_level,
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
await (admin as any).schema('agents').from('health_updates').insert(updates);
```

Insert into `agents.health_knowledge` (batch):
```ts
const knowledgeRows = allChunksWithMeta.map((c, i) => ({
  content: c.text,
  embedding: allEmbeddings[i],
  metadata: {
    source: c.sourceUrl,
    category: c.category,
    evidence_level: c.evidenceLevel,
    run_id: runId,
    published_at: new Date().toISOString().split('T')[0],
  },
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
await (admin as any).schema('agents').from('health_knowledge').insert(knowledgeRows);
```

Prune rows older than 90 days from both tables:
```ts
const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
await Promise.all([
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (admin as any).schema('agents').from('health_knowledge').delete().lt('created_at', ninetyDaysAgo),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (admin as any).schema('agents').from('health_updates').delete().lt('created_at', ninetyDaysAgo),
]);
```

#### Update `lib/ai/patient-context.ts`

The file at `lib/ai/patient-context.ts` has a `Promise.all` with 7 items. Add an 8th item:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(admin as any)
  .schema('agents')
  .from('health_updates')
  .select('title, content, category, evidence_level, created_at')
  .order('created_at', { ascending: false })
  .limit(3),
```

Destructure it as `recentDigestsResult` and add to the return value:
```ts
recentDigests: (recentDigestsResult.data ?? []) as Array<{
  title: string; content: string; category: string;
  evidence_level: string; created_at: string;
}>,
```

The `.catch((): ... => ({ data: [] }))` fallback pattern already used for `retrieveKnowledge` should be applied here too.

**Acceptance criteria:**
- [ ] `runNovaDigestPipeline()` is exported from `lib/ai/pipelines/nova.ts` and no longer throws immediately
- [ ] `chunkText` is exported and chunked correctly (test verifiable)
- [ ] A failed category is logged and skipped; the pipeline continues with remaining categories
- [ ] On successful run, `health_updates` has ≥1 new row and `health_knowledge` has ≥1 new chunk
- [ ] 90-day prune runs; `delete().lt('created_at', ...)` called on both tables
- [ ] `loadPatientContext()` in `patient-context.ts` has an 8th `Promise.all` item loading `health_updates`
- [ ] 500 ms delay applied between Phase 1 searches and Phase 2 fetch
- [ ] `pnpm build` passes; `pnpm test` passes

**Rules:** `.claude/rules/ai-agents.md`, `.claude/rules/data-management.md`, `.claude/rules/security.md`

---

### Task 3 — Cron route + vercel.json

**Files affected:**
- `app/api/cron/nova/route.ts` (new file)
- `vercel.json` (update crons array)

**What to build:**

Create `app/api/cron/nova/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { runNovaDigestPipeline } from '@/lib/ai/pipelines/nova';

export const maxDuration = 300; // Vercel Pro max; must be module-level export

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Vercel sets Authorization: Bearer <CRON_SECRET> on cron-triggered requests.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await runNovaDigestPipeline();
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Log but return 200 to suppress Vercel cron retry (which would cause double-writes).
    console.error('[Nova cron] Unhandled pipeline error:', err);
    return NextResponse.json({ ok: false, error: 'pipeline_error' });
  }
}
```

Update `vercel.json` — add to the existing `crons` array:
```json
{
  "path": "/api/cron/nova",
  "schedule": "0 2 * * 1"
}
```
(Monday 02:00 UTC — low-traffic window.)

No new environment variable needed. `CRON_SECRET` already exists in the project (used by the drip-email cron).

**Acceptance criteria:**
- [ ] GET request without `Authorization: Bearer <CRON_SECRET>` header returns 401 when `CRON_SECRET` is set
- [ ] GET request with correct header calls `runNovaDigestPipeline()` and returns `{ ok: true }`
- [ ] Unhandled errors from `runNovaDigestPipeline()` return HTTP 200 (not 500) to suppress Vercel cron retry
- [ ] `maxDuration = 300` is exported at module level
- [ ] `vercel.json` crons array has the nova entry with `"schedule": "0 2 * * 1"`
- [ ] `pnpm build` passes

**Rules:** `.claude/rules/security.md`, `.claude/rules/nextjs-conventions.md`

---

### Task 4 — Tests

**Files affected:**
- `tests/unit/ai/nova-helpers.test.ts` (new)
- `tests/integration/ai/nova.test.ts` (new)

**Test framework:** Vitest. Follow the existing pattern in `tests/integration/ai/loader.test.ts` and `tests/integration/ai/agent-actions.test.ts` for mock setup.

**Unit tests** (`tests/unit/ai/nova-helpers.test.ts`):

Test the exported `chunkText(text, chunkWords, overlapWords)` function from `@/lib/ai/pipelines/nova`:

```ts
import { chunkText } from '@/lib/ai/pipelines/nova';

describe('chunkText', () => {
  it('returns empty array for empty string', ...)
  it('returns single chunk for short text (< chunkWords)', ...)
  it('produces chunks of <= chunkWords words', ...)
  it('last chunkWords of chunk N equals first overlapWords words of chunk N+1', ...)
  it('covers all words — no content dropped', ...)
});
```

**Integration tests** (`tests/integration/ai/nova.test.ts`):

Mock setup at the top of the file (before imports, using `vi.mock`):

```ts
// Supabase mock — chain: schema() → from() → insert/delete/select
const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
const mockDelete = vi.fn(() => ({ lt: vi.fn(() => Promise.resolve({ error: null })) }));
const mockSelect = vi.fn(() => ({
  gte: vi.fn(() => Promise.resolve({ data: [], error: null })),
  order: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve({ data: [], error: null })) })),
}));
const mockFrom = vi.fn(() => ({ insert: mockInsert, delete: mockDelete, select: mockSelect }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ schema: () => ({ from: mockFrom }) }),
}));

// Agent factory mock
const mockRun = vi.fn();
vi.mock('@/lib/ai/agent-factory', () => ({
  createPipelineAgent: () => ({ run: mockRun }),
}));

// embedText mock
const mockEmbedText = vi.fn();
vi.mock('@/lib/ai/rag', () => ({ embedText: mockEmbedText }));
```

Mock `global.fetch` to return canned PubMed API responses for esearch and efetch calls.

Tests:
```ts
describe('runNovaDigestPipeline', () => {
  it('calls health_updates insert with rows when LLM succeeds', ...)
  it('calls health_knowledge insert with embedding rows', ...)
  it('skips a failing category and completes the run with remaining categories', ...)
  it('calls delete on health_knowledge with a date filter (90-day prune)', ...)
  it('calls delete on health_updates with a date filter (90-day prune)', ...)
});
```

**Acceptance criteria:**
- [ ] All unit tests for `chunkText` pass
- [ ] Integration tests pass with mocked fetch and Supabase
- [ ] A category LLM failure does not prevent the rest of the run (test this explicitly)
- [ ] Total test suite: `pnpm test` passes with 145+ tests passing (no regressions)

**Rules:** Standard Vitest patterns. No real network calls or DB in tests.

---

## Build order

Task 1 → Task 2 → Task 3 → Task 4

Sequential. DB migration must be applied before code that references the new table. Tests must come after the implementation they test exists.
