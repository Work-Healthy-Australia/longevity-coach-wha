# QA Report: nova-pipeline
Date: 2026-04-28
Reviewer: QA subagent

## Build status
pnpm build: PASS
pnpm test: PASS (155 tests, 21 suites)

## Test results
| Suite | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| unit/ai/nova-helpers | 5 | 5 | 0 | 0 |
| integration/ai/nova | 5 | 5 | 0 | 0 |
| All other suites (19) | 145 | 145 | 0 | 0 |

## Findings

### Confirmed working
- `agents.health_updates` table created (migration 0027) with check constraints, RLS, and authenticated SELECT policy
- `nova` row upserted into `agents.agent_definitions` with full system prompt
- `runNovaDigestPipeline()` replaces the stub — searches PubMed for 6 categories, synthesizes via Claude, chunks and embeds into `agents.health_knowledge`, stores digests in `agents.health_updates`
- `chunkText()` exported and correctly implements sliding window (300-word chunks, 60-word overlap)
- Category-level failures are logged and skipped — pipeline completes with remaining categories
- 90-day pruning runs on both `health_knowledge` and `health_updates` after each run
- `loadPatientContext()` has `health_updates` as 8th parallel `Promise.all` item; `recentDigests` in PatientContext type and return value
- `/api/cron/nova` GET route: 401 on missing/wrong CRON_SECRET, 200 always (suppresses Vercel retry), `maxDuration = 300`
- `vercel.json` has nova cron scheduled Monday 02:00 UTC
- TypeScript types regenerated with `agents.health_updates` under agents namespace

### Deferred items
- pgvector extension in Supabase (already noted from evidence-base sprint) — affects semantic search quality but BM25 fallback is functional
- medRxiv integration — scoped out for v1; PubMed covers the primary evidence base
- Member-facing insights feed UI — future Phase 3 UI sprint
- PubMed API key (`NCBI_API_KEY`) — optional; raises rate limit from 3 req/s to 10 req/s if added to env

### Known limitations
- `parseEfetchText` uses a best-effort plain-text parser. PubMed efetch format varies slightly by article type. Some edge cases (e.g., articles without abstracts) will produce empty abstract strings — these are skipped gracefully.
- Nova synthesizes up to 30 articles per run (5 per category). Categories that return zero PubMed results are skipped silently.

## Verdict
APPROVED
