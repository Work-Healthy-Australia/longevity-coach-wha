# Changelog: evidence-base
Date: 2026-04-28
Phase: Phase 2 — Intelligence (evidence layer for Atlas & Sage) + Phase 3 (Janet RAG wiring)

## What was built
- `agents` schema: new Supabase schema housing all agentic tables (`agent_conversations`, `agent_definitions`, `health_knowledge`)
- `agents.health_knowledge`: 65 clinical knowledge chunks across 6 categories (cv, metabolic, neuro, onco, msk, supplements/drug_interactions), each with a proper 2560-dim embedding generated via `perplexity/pplx-embed-v1-4b`
- `hybrid_search_health` RPC: updated to use `agents.health_knowledge`, supports BM25-only fallback when pgvector not available
- RAG wired into Janet: `retrieveKnowledge()` called in parallel inside `loadPatientContext()`, result fed to `knowledgeChunks` in PatientContext
- Admin agent pages (`/admin/agents`, `/admin/agents/[slug]`) updated to query `agents` schema
- Evidence-anchored system prompts for Atlas (migration 0022) and Sage (migration 0023)

## What changed
| File | Nature of change |
|---|---|
| `supabase/migrations/0021_fix_hybrid_search_bm25_fallback.sql` | Fixed `hybrid_search_health` RPC for BM25-only fallback |
| `supabase/migrations/0022_atlas_evidence_anchored_prompt.sql` | Atlas system prompt updated with evidence standards |
| `supabase/migrations/0023_sage_evidence_anchored_prompt.sql` | Sage system prompt updated with evidence standards |
| `supabase/migrations/0024_health_knowledge_seed.sql` | Initial 65 knowledge rows (embedding=NULL, placeholder) |
| `supabase/migrations/0025_agents_schema.sql` | Creates `agents` schema; moves 3 tables from `public` |
| `supabase/migrations/0026_health_knowledge_embeddings.sql` | Replaces NULL embeddings with proper 2560-dim vectors |
| `lib/ai/rag.ts` | Updated to query `agents.health_knowledge` |
| `lib/ai/loader.ts` | Updated to query `agents.agent_definitions` |
| `lib/ai/agents/janet.ts` | Updated to write to `agents.agent_conversations` |
| `lib/ai/patient-context.ts` | Added `retrieveKnowledge()` as 7th parallel `Promise.all` item |
| `app/(admin)/admin/agents/[slug]/actions.ts` | All `agent_definitions` ops use `agents` schema |
| `app/(admin)/admin/agents/page.tsx` | List page queries `agents` schema |
| `app/(admin)/admin/agents/[slug]/page.tsx` | Edit page queries `agents` schema |
| `lib/supabase/database.types.ts` | Regenerated with `agents` namespace |
| `tests/integration/ai/agent-actions.test.ts` | Mock updated for `.schema().from()` chaining |
| `tests/integration/ai/loader.test.ts` | Mock updated for `.schema().from()` chaining |
| `scripts/seed-health-knowledge.ts` | One-off script to generate embeddings and write SQL |

## Migrations applied
- `0021_fix_hybrid_search_bm25_fallback.sql` — BM25-only fallback for `hybrid_search_health` when `query_vec` is NULL
- `0022_atlas_evidence_anchored_prompt.sql` — Atlas agent_definitions system prompt update
- `0023_sage_evidence_anchored_prompt.sql` — Sage agent_definitions system prompt update
- `0024_health_knowledge_seed.sql` — Initial 65 knowledge rows (NULL embeddings)
- `0025_agents_schema.sql` — Creates `agents` schema, moves tables, regrants permissions, replaces RPC
- `0026_health_knowledge_embeddings.sql` — Replaces all rows with proper vector embeddings

## Deviations from plan
- `health_standards` table was initially proposed for Atlas/Sage but scoped out — the 65 clinical knowledge chunks in `health_knowledge` are directly usable by all agents via RAG; a separate standards table was not needed.
- `supabase db execute` CLI command does not exist in v2.45.5; embeddings were applied as migration 0026 instead.

## Known gaps / deferred items
- pgvector extension must be enabled manually in Supabase dashboard for HNSW semantic search to activate. BM25-only retrieval is functional until then.
- `(admin as any).schema('agents')` cast will be removable once `@supabase/supabase-js` multi-schema TypeScript generics are fixed upstream.
