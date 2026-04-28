# Agent System Handoff — 2026-04-28

## What was built this session

The Phase 2 intelligence layer is now live. The patient can complete onboarding → upload blood tests → receive risk analysis + supplement protocol → chat with Janet.

---

## Files created

### Documentation
- `docs/engineering/2026-04-28-current-state.md` — snapshot of project state at start of session
- `docs/engineering/2026-04-28-agent-system-plan.md` — architecture decisions, risk register, build order

### Database migrations (both applied ✅)
- `supabase/migrations/0014_agent_tables.sql` — adds `narrative`, `engine_output`, `data_gaps` to `risk_scores`; creates `agent_conversations`, `support_tickets`, `appointments`
- `supabase/migrations/0015_health_updates.sql` — creates `health_updates` (research digests display table)
- `supabase/migrations/0016_knowledge_base_pgvector.sql` — **DEFERRED** — requires pgvector extension enabled in Supabase dashboard first

### AI layer
- `lib/ai/patient-context.ts` — `PatientContext` assembler; parallel `Promise.all` load; `summariseContext()` for system prompt injection
- `lib/ai/trigger.ts` — `triggerPipeline()` fire-and-forget helper
- `lib/ai/pipelines/risk-narrative.ts` — Atlas pipeline; reads questionnaire + uploads; writes risk scores + narrative to `risk_scores`
- `lib/ai/pipelines/supplement-protocol.ts` — Sage pipeline; reads risk + uploads + questionnaire; inserts to `supplement_plans`
- `lib/ai/agents/janet.ts` — Janet streaming agent; loads full PatientContext; streams Claude Sonnet 4.6; persists turns to `agent_conversations`

### API routes
- `app/api/pipelines/risk-narrative/route.ts` — POST endpoint; secured with `x-pipeline-secret`; runs Atlas pipeline
- `app/api/pipelines/supplement-protocol/route.ts` — POST endpoint; secured with `x-pipeline-secret`; runs Sage pipeline
- `app/api/chat/route.ts` — POST endpoint; Supabase session auth; streams Janet response

### App pages
- `app/(app)/report/page.tsx` — risk narrative, domain scores, supplement protocol, Janet chat panel
- `app/(app)/report/report.css` — styles for all report components
- `app/(app)/report/_components/janet-chat.tsx` — streaming chat UI client component

### Modified files
- `app/(app)/layout.tsx` — added nav links: Dashboard, My Report, Documents
- `app/(app)/onboarding/actions.ts` — fires `risk-narrative` + `supplement-protocol` pipelines after assessment submission
- `app/(app)/uploads/actions.ts` — fires `supplement-protocol` pipeline after each successful Janet analysis
- `lib/supabase/database.types.ts` — regenerated from remote schema

---

## How the pipeline triggers work

```
Patient submits assessment
  → submitAssessment() writes health_profiles.completed_at
  → triggerPipeline('risk-narrative', userId)   ← fire-and-forget HTTP call
  → triggerPipeline('supplement-protocol', userId) ← fire-and-forget HTTP call
  → redirect('/dashboard')

Each triggerPipeline() call hits:
  POST /api/pipelines/{name}
  Header: x-pipeline-secret: {PIPELINE_SECRET}
  Body: { userId }

The route handler runs the pipeline synchronously in its own Vercel function invocation.
```

---

## New environment variable required

| Variable | Description |
|---|---|
| `PIPELINE_SECRET` | Shared secret for internal pipeline routes. Generate: `openssl rand -hex 32` |

Add to `.env` (local) and Vercel project environment variables (all environments).

---

## Known limitations / deferred work

### pgvector / RAG (migration 0016)
Janet's RAG layer (hybrid semantic + keyword search over health knowledge) requires pgvector. Migration 0016 is written and ready. To enable:
1. Supabase Dashboard → Database → Extensions → `vector` → Enable
2. `supabase db push` — will apply 0016

Until then, Janet has no knowledge base and responds only from PatientContext (patient's own data). This is sufficient for Phase 3 launch; Nova pipeline fills the knowledge base over time.

### Deterministic risk engine (lib/risk/)
Atlas currently derives all risk scores via LLM from questionnaire data. Scores are labelled `confidence_level = 'moderate'`. The Base44 risk engine port will:
1. Run synchronously in `submitAssessment()`, writing `risk_scores.engine_output`
2. Atlas will then read `engine_output` and write narrative only (faster, higher confidence)

The pipeline code is designed for this — replacing the "derive from questionnaire" block with "read engine_output" is a ~10-line change.

### Admin CRM
Still a stub (`app/(admin)/.gitkeep`). Not in scope for this session — see sprint plan Day 4.

### PDF generation
Still a stub (`lib/pdf/.gitkeep`). Needed for the branded supplement protocol export. Not in scope for this session.

### Drip email sequences
Welcome email works. Day 1/3/7 sequences not built. Stripe webhook triggers are wired but only update subscription status.

### Alex support agent
Designed in agent-system.md. Tables exist (`support_tickets`). Not implemented — blocked on WhatsApp channel setup.

---

## What to do next

The agent system boundary is now complete. These are the remaining Vietnam sprint deliverables:

1. **Add PIPELINE_SECRET to .env and Vercel** — pipelines silently no-op without it
2. **Enable pgvector in Supabase dashboard** — then `supabase db push` to apply 0016
3. **Port risk engine from Base44** → `lib/risk/`  — plugs into `submitAssessment()` before the pipeline triggers
4. **Branded PDF export** → `lib/pdf/` — referenced from the report page
5. **Admin CRM** → `app/(admin)/` — James needs this to see users and subscription status
6. **Drip email sequences** — Day 1/3/7 re-engagement via Resend

---

## Waiting for further instructions before proceeding.
