# Agent System — Implementation Plan & Risk Assessment
# 2026-04-28

## Scope

Build the Phase 2 intelligence layer in priority order: Supplement Protocol Pipeline (P1) → Risk Narrative Pipeline (P2) → Janet Agent (P3). This completes the core patient value loop: sign-up → onboarding → uploads → insights → coaching conversation.

---

## Architecture decisions

### 1. Supplement writes to `supplement_plans` (not `risk_scores.supplements_json`)

**Decision:** The Supplement Protocol Pipeline (Sage) inserts into `supplement_plans` with `status='active'`, marking any prior active plan as `superseded`.

**Why:** `supplement_plans` is a normalised table with proper RLS, a status lifecycle, and FK to `periodic_reviews`. `risk_scores.supplements_json` was specified in the original agent-system.md but predates the 0012 migration that introduced `supplement_plans`. Using a denormalised JSONB column would block proper clinician override and version tracking.

**Update required in agent-system.md:** Section 1.4 output ownership table — change Supplement Protocol Pipeline write target from `risk_scores.supplements_json` to `supplement_plans`.

**PatientContext reads:** `supplement_plans` latest active row (not risk_scores).

---

### 2. Risk Narrative Pipeline operates from questionnaire + uploads (no deterministic engine)

**Decision:** The deterministic risk engine (`lib/risk/`) is not built yet. The Risk Narrative Pipeline (Atlas) will read `health_profiles.responses` and `patient_uploads` directly, compute initial domain scores via LLM, and write all risk_scores columns in one pass.

**Why this is safe:** The pipeline is idempotent (upserts on `user_uuid`). When the deterministic engine is eventually built, it will:
1. Run synchronously inside `submitAssessment()` and populate `risk_scores.engine_output`
2. The Risk Narrative Pipeline will then read `engine_output` instead of re-deriving scores

The code is designed so this swap is a 10-line change in the pipeline: replace the "derive scores from questionnaire" section with "read engine_output".

**Risk:** LLM-computed scores will differ slightly from the eventually-built deterministic engine. Both versions will be transparently labelled in `confidence_level` (LLM path = `'moderate'`; deterministic path = `'high'`).

---

### 3. Pipeline triggers via internal HTTP routes (fire-and-forget)

**Decision:** Server actions trigger pipelines by calling an internal API route with `fetch()` without awaiting. The API route handles the full pipeline run as its own Vercel function invocation.

**Why:** Next.js server actions are serverless function invocations on Vercel. A fire-and-forget `.catch()` inside the action would be torn down before the pipeline completes. Calling a separate API endpoint creates a new independent function invocation that runs to completion regardless of the triggering request's lifecycle.

**Security:** Internal routes are protected with `x-pipeline-secret: PIPELINE_SECRET` header. The secret must be set in environment variables.

**Pattern:**

```typescript
// In server action — fire and forget, never await
triggerPipeline('risk-narrative', userId);

// In lib/ai/trigger.ts
export function triggerPipeline(name: string, userId: string): void {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/api/pipelines/${name}`;
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-pipeline-secret': process.env.PIPELINE_SECRET ?? '',
    },
    body: JSON.stringify({ userId }),
  }).catch(() => {}); // intentional fire-and-forget
}
```

---

### 4. Janet uses `claude-sonnet-4-6` with prompt caching

The system prompt and PatientContext summary are marked `cache_control: { type: 'ephemeral' }` to reduce cost and latency on subsequent turns. The conversation window is last 20 turns.

---

## Database changes (two migrations)

### Migration 0014 — Agent system tables

**New columns on `risk_scores`:**
- `narrative` text — human-readable risk story (Atlas writes this)
- `engine_output` jsonb — reserved for future deterministic engine raw output
- `data_gaps` text[] NOT NULL DEFAULT '{}' — missing data that would improve confidence

**New tables:**

| Table | Writer | Purpose |
|---|---|---|
| `agent_conversations` | Janet, Alex (service role) | One row per message turn |
| `support_tickets` | Alex (service role) | Escalation records |
| `appointments` | Janet (service role) | Booking confirmations |

### Migration 0015 — Knowledge base (pgvector)

Requires pgvector extension enabled manually in Supabase dashboard before applying.

| Table | Writer | Purpose |
|---|---|---|
| `health_updates` | Nova pipeline (future) | Research digests for display |
| `health_knowledge` | Nova pipeline (future) | Vector-embedded knowledge chunks for Janet RAG |

**SQL function:** `hybrid_search_health(query_text, query_vec, match_count)` — RRF fusion of HNSW semantic search + GIN full-text keyword search.

---

## Implementation files

### lib/ai/patient-context.ts

Parallel `Promise.all` load across:
- `profiles` (demographics, role)
- `risk_scores` (latest row — all columns including narrative)
- `health_profiles` (latest completed row — responses)
- `patient_uploads` (all done rows — janet summary + findings)
- `supplement_plans` (latest active row — items)
- `agent_conversations` (last 20 turns by agent)

Returns typed `PatientContext`. Read-only — no mutations inside.

### lib/ai/pipelines/risk-narrative.ts

Trigger: `runRiskNarrativePipeline(userId: string): Promise<void>`

Steps:
1. Load targeted context (profiles + health_profiles + patient_uploads)
2. Build Claude prompt with system-prompt caching
3. Zod validate output (narrative, domain scores, drivers, screenings, confidence, data_gaps)
4. Retry once on Zod failure with schema correction message
5. Upsert `risk_scores` with all fields (keyed on user_uuid)

**Output schema (Zod):**
```typescript
const RiskNarrativeOutput = z.object({
  biological_age: z.number().min(18).max(120),
  cv_risk: z.number().min(0).max(100),
  metabolic_risk: z.number().min(0).max(100),
  neuro_risk: z.number().min(0).max(100),
  onco_risk: z.number().min(0).max(100),
  msk_risk: z.number().min(0).max(100),
  narrative: z.string().min(100).max(800),
  top_risk_drivers: z.array(z.string()).max(7),
  top_protective_levers: z.array(z.string()).max(5),
  recommended_screenings: z.array(z.string()),
  confidence_level: z.enum(['low', 'moderate', 'high', 'insufficient']),
  data_gaps: z.array(z.string()),
});
```

### lib/ai/pipelines/supplement-protocol.ts

Trigger: `runSupplementProtocolPipeline(userId: string): Promise<void>`

Steps:
1. Load targeted context (profiles + risk_scores + health_profiles + patient_uploads)
2. Build Claude prompt with system-prompt caching
3. Zod validate output
4. Retry once on Zod failure
5. Mark existing active supplement_plans as 'superseded'
6. Insert new supplement_plans row with status='active'

**Output schema (Zod):**
```typescript
const SupplementOutput = z.object({
  supplements: z.array(z.object({
    name: z.string(),
    form: z.string(),
    dosage: z.string(),
    timing: z.string(),
    priority: z.enum(['critical', 'high', 'recommended', 'performance']),
    domains: z.array(z.string()),
    rationale: z.string(),
    note: z.string().optional(),
  })),
  generated_at: z.string(),
  data_completeness_note: z.string(),
  interactions_checked: z.boolean(),
});
```

### lib/ai/agents/janet.ts

Function: `runJanetTurn(userId: string, userMessage: string): ReadableStream`

Steps:
1. Load full `PatientContext`
2. Build system prompt (injecting PatientContext summary)
3. Fetch last 20 turns from `agent_conversations`
4. Call `anthropic.messages.stream()` with tool definitions for sub-agents
5. Persist user + assistant turns to `agent_conversations` via service role (non-blocking)
6. Return the stream

### API Routes

- `POST /api/pipelines/risk-narrative` — verifies PIPELINE_SECRET, calls `runRiskNarrativePipeline(userId)`
- `POST /api/pipelines/supplement-protocol` — verifies PIPELINE_SECRET, calls `runSupplementProtocolPipeline(userId)`
- `POST /api/chat` — authenticated via Supabase session, calls `runJanetTurn()`, returns streaming response

### app/(app)/report/page.tsx

Server component. Loads:
- Latest `risk_scores` (narrative, domain scores, bio-age, drivers, screenings)
- Latest active `supplement_plans` (items)
- Upload count

Renders:
- Bio-age headline
- Risk narrative text
- Domain score cards (5 domains)
- Supplement protocol table
- Chat with Janet (client component)

---

## Trigger wiring

### onboarding/actions.ts — after `submitAssessment` writes `completed_at`

Before the `redirect('/dashboard')`:
```typescript
triggerPipeline('risk-narrative', user.id);
triggerPipeline('supplement-protocol', user.id);
```

### uploads/actions.ts — after Janet analysis writes `janet_status = 'done'`

After the `admin.from('patient_uploads').update({ janet_status: 'done' })`:
```typescript
triggerPipeline('supplement-protocol', user.id);
```

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM-derived risk scores differ from future deterministic engine | Certain | Medium | Label `confidence_level = 'moderate'` on LLM path; engine path sets `'high'`. Document migration path clearly. |
| Pipeline triggered but Vercel invocation fails silently | Low | High | API routes log all errors to console (Vercel logs). Future: add DB `pipeline_runs` table for observability. |
| Supplement protocol output fails Zod validation | Low | Medium | One retry with schema correction. On second failure, log error + skip insert (user sees old plan). |
| Chat API rate limited or timed out | Low | Medium | LLM call timeout set to 30s. Graceful error response streamed to UI. |
| PIPELINE_SECRET not set in production | Medium | High | API routes return 401 if secret missing. Add to deployment checklist and `.env.example`. |
| pgvector extension not enabled before migration 0015 | High | Low | Migration 0015 is safe to skip; knowledge base is Phase 3. Enable pgvector in Supabase dashboard before applying. |
| supplement_plans/risk_scores drift (two writers) | Low | High | Risk Narrative Pipeline writes ONLY to `risk_scores`. Supplement Protocol Pipeline writes ONLY to `supplement_plans`. No cross-writer table access. |

---

## New environment variables

| Variable | Purpose | Required |
|---|---|---|
| `PIPELINE_SECRET` | Shared secret for internal pipeline trigger routes | Yes (production) |

---

## Build order

```
0014_agent_tables.sql           ← agent_conversations, appointments, support_tickets
0015_knowledge_base.sql         ← health_updates, health_knowledge (pgvector)

lib/ai/patient-context.ts       ← PatientContext assembler
lib/ai/trigger.ts               ← triggerPipeline() helper
lib/ai/pipelines/risk-narrative.ts
lib/ai/pipelines/supplement-protocol.ts
lib/ai/agents/janet.ts

app/api/pipelines/risk-narrative/route.ts
app/api/pipelines/supplement-protocol/route.ts
app/api/chat/route.ts

app/(app)/report/page.tsx
app/(app)/report/report.css

app/(app)/layout.tsx             ← add nav links
onboarding/actions.ts            ← wire pipeline triggers
uploads/actions.ts               ← wire supplement trigger

supabase gen types typescript    ← regenerate database.types.ts
```

---

## Handoff boundary

This document covers the agent system (Phase 2 intelligence core). Once complete:
- Janet can answer questions from patients using their health data
- Supplement plans are auto-generated after onboarding and each new upload
- Risk narrative is displayed on `/report`
- Patient can view their complete health picture

**What comes next (Phase 2 remainder, not in this turn):**
- Branded PDF generation (`lib/pdf/`)
- Admin CRM (`app/(admin)/`)
- Drip email sequences (Day 1 / Day 3 / Day 7)
- Risk engine deterministic port from Base44
