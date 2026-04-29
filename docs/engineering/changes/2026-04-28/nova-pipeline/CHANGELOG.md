# Changelog: nova-pipeline
Date: 2026-04-28
Phase: Phase 3 (Epic 3.5.3) / Phase 4 — P7 in agent build order

## What was built
- `agents.health_updates` table — stores weekly research digests (title, content, category, evidence level, source URL, run ID)
- `nova` agent definition — synthesis specialist system prompt in `agents.agent_definitions`
- `runNovaDigestPipeline()` — full 5-phase pipeline: PubMed search → abstract fetch → LLM synthesis → chunk+embed → upsert+prune
- `chunkText()` helper — sliding window text chunker (300-word chunks, 60-word overlap)
- `/api/cron/nova` route — weekly cron handler secured with `CRON_SECRET`, returns 200 on error to suppress Vercel retry
- Vercel weekly cron schedule (Monday 02:00 UTC)
- `recentDigests` in `PatientContext` — latest 3 digests loaded in parallel with other context reads

## What changed
| File | Nature of change |
|---|---|
| `supabase/migrations/0027_nova_health_updates.sql` | New — `agents.health_updates` table + nova agent_definitions INSERT |
| `lib/supabase/database.types.ts` | Regenerated — includes `health_updates` under agents namespace |
| `lib/ai/pipelines/nova.ts` | Full rewrite replacing stub — 5-phase pipeline + `chunkText` export |
| `lib/ai/patient-context.ts` | Added `health_updates` as 8th parallel read; `recentDigests` on PatientContext |
| `app/api/cron/nova/route.ts` | New — weekly cron handler |
| `vercel.json` | Added nova weekly cron entry |
| `tests/unit/ai/nova-helpers.test.ts` | New — 5 unit tests for `chunkText` |
| `tests/integration/ai/nova.test.ts` | New — 5 integration tests for `runNovaDigestPipeline` |

## Migrations applied
- `0027_nova_health_updates.sql` — creates `agents.health_updates` table with RLS + index; upserts `nova` into `agents.agent_definitions`

## Deviations from plan
- PubMed efetch parser placed PMID before title in test fixture — matches the actual plain-text format returned by the API (PMID appears first in the PubMed efetch text response, not after)
- `NovaOutputSchema` stub export in the original `nova.ts` was removed — it was unused externally and replaced by the internal `DigestSchema`

## Known gaps / deferred items
- PubMed NCBI API key (`NCBI_API_KEY`) optional: raises rate limit from 3 to 10 req/s; add to env when Nova runs at scale
- medRxiv integration: scoped for v2 when PubMed coverage proves insufficient
- Member-facing insights feed UI: separate Phase 3 UI sprint
- pgvector extension: needed for full semantic search quality (one-click in Supabase dashboard — already noted in evidence-base sprint)
