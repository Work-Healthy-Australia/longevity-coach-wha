# QA Report: evidence-base
Date: 2026-04-28
Reviewer: QA subagent

## Build status
pnpm build: PASS
pnpm test: PASS (145 tests, 19 suites)

## Test results
| Suite | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| integration/ai/loader | 4 | 4 | 0 | 0 |
| integration/ai/agent-actions | 14 | 14 | 0 | 0 |
| All other suites (17) | 127 | 127 | 0 | 0 |

## Findings

### Confirmed working
- `agents.health_knowledge` seeded with 65 rows, all with valid 2560-dim embeddings (perplexity/pplx-embed-v1-4b via OpenRouter)
- `hybrid_search_health` RPC updated to reference `agents.health_knowledge` with BM25-only fallback when `query_vec IS NULL`
- `retrieveKnowledge()` wired into `loadPatientContext()` as non-blocking 7th `Promise.all` item with `.catch((): string[] => [])` fallback
- `agents` schema migration applied: `agent_conversations`, `agent_definitions`, `health_knowledge` moved from `public` to `agents`
- All code updated to use `(admin as any).schema('agents').from(...)` pattern (loader, janet, actions, admin pages)
- TypeScript types regenerated for `agents` schema
- All Vitest mocks updated to chain through `.schema()` — 14 previously-failing tests now pass
- `pnpm build` clean — no TypeScript errors

### Deferred items
- pgvector extension must be enabled in Supabase dashboard (Database → Extensions → vector). Until enabled, `hybrid_search_health` runs BM25-only. Semantic vector search (HNSW) will activate automatically once the extension is enabled.

### Known limitations
- `(admin as any).schema('agents')` cast is required because `@supabase/supabase-js` v2.104.0 TypeScript generics for `.schema()` don't resolve non-public schemas correctly. This is a known upstream limitation; upgrade to a patched version when available.

## Verdict
APPROVED
