# Longevity Coach — Agents & Pipeline Workers
# Revised 2026-04-27

---

## Guiding principles

| Principle | Rule |
|---|---|
| **Simplicity** | One component, one job. No abstraction until it eliminates real duplication. |
| **Accuracy** | Name and describe each component for what it actually does. |
| **Production stability** | Pipelines are always async and non-fatal. User-facing paths never fail because of a downstream LLM call. All writes are idempotent. |
| **Ultra low latency** | Janet makes exactly one LLM call per user message. All pipeline outputs are pre-computed and read from DB at session start. No LLM-to-LLM synchronous chaining. |

---

## Part 1 — Two execution blueprints

The system has two fundamentally different execution models. Applying one architecture to both wastes complexity.

---

### 1.1 Agent blueprint

**When to use:** Input is an unpredictable real-time user message. Output must be streamed. Prior conversation state changes the response.

```
User message
  │
  ▼
PatientContext.load()       ← Promise.all — all needed DB reads in parallel (~50 ms)
  │
  ▼
Build system prompt         ← inject PatientContext summary + conversation window (last 20 turns)
  │
  ▼
LLM stream                  ← single Anthropic SDK call; streaming enabled
  │
  ▼
Persist turn                ← agent_conversations row; non-blocking write
  │
  ▼
Stream to user
```

**Rules:**
- One LLM call per user message. No nested LLM calls inside a response turn.
- Agents read pipeline output from DB (PatientContext). They never invoke pipeline workers synchronously.
- If a data layer is stale (e.g. risk scores > 30 days old), the agent notes this to the user and fires an async refresh event. It does not wait for the result.
- Conversation window: last 20 turns per `user_uuid`. Older turns are summarized to one sentence per session and appended to the system prompt as `conversation_history_summary`.

---

### 1.2 Pipeline worker blueprint

**When to use:** Trigger is deterministic (lifecycle event, schedule, or explicit user action). Output is a fixed schema. Result is written to DB for later consumption by agents or the UI.

```
Trigger (event / schedule / explicit action)
  │
  ▼
Targeted context fetch      ← only the fields this pipeline actually needs
  │
  ▼
Build prompt                ← assembled once
  │
  ▼
LLM call                    ← no streaming; awaited
  │
  ▼
Zod validate output
  │   failure → retry once with schema correction message
  │   second failure → write { status: "failed", error, attempted_at } row and stop
  ▼
Idempotent upsert           ← always upsert keyed on (user_uuid, [period or event_id])
  │
  ▼
Emit completion event       ← if a downstream pipeline depends on this output
```

**Rules:**
- All pipeline workers run async — they never block the HTTP response that triggered them.
- Assessment submission completes and redirects before any pipeline is invoked. Pipelines are triggered by the `health_profiles.completed_at` write, not inside `submitAssessment()`.
- Upsert keys prevent duplicate runs. Re-running a pipeline on the same event is always safe.
- Each pipeline writes `last_run_at` and `last_run_status` on its output row.

---

### 1.3 Shared context assembler

Both blueprints call `PatientContext.load()` before execution. All Supabase reads are issued in parallel via `Promise.all`. Each component fetches only the layers it actually uses; Janet loads all layers.

**`PatientContext` layers:**

| Layer | Source | Loaded by |
|---|---|---|
| Demographics | `profiles` | All |
| Risk scores + bio-age | `risk_scores` (latest row) | Janet, Risk Narrative, Supplement, PT Coach |
| Supplement protocol | `risk_scores.supplements_json` | Janet, Supplement Pipeline |
| Health profile | `health_profiles.responses` | Risk Narrative, Supplement, PT Coach plan |
| Uploads (summaries) | `patient_uploads` | Supplement Pipeline, Janet |
| Daily check-ins (7 days) | `daily_checkins` | Janet, PT Coach live |
| Wearable summary (30 days) | `wearable_devices` | PT Coach, Janet |
| Active training program | `training_programs` | PT Coach live, Janet |
| Active meal plan | `meal_plans` | Janet |
| Research digests (latest 3) | `health_updates` | Janet |
| Subscription + entitlements | `subscriptions`, `entitlements` | Janet (appointment booking) |
| **RAG knowledge chunks** | **`health_knowledge` (pgvector)** | **Janet (injected into system prompt)** |
| Role + organisation | `profiles.role`, `organisations`, `patient_assignments` | Support Agent |
| Support ticket history | `support_tickets` | Support Agent |

**Rules:**
- Read-only. No component mutates PatientContext.
- PII lives only in `profiles`. All JSONB responses are de-identified (AGENTS.md rule 2).
- Age computed from `date_of_birth` at read time. Never stored.

---

### 1.4 Output ownership

One component, one write target.

| Component | Writes to | Key columns |
|---|---|---|
| Risk Narrative Pipeline | `risk_scores` | `narrative`, `top_risk_drivers`, `top_protective_levers`, `recommended_screenings`, `confidence_level`, `data_gaps` |
| Supplement Protocol Pipeline | `risk_scores` | `supplements_json` |
| Janet | `agent_conversations`, `coach_suggestions`, `appointments` | Turns, gap suggestions, bookings |
| PT Coach (live) | `training_sessions` | Session logs |
| PT Coach (monthly plan) | `training_programs` | Monthly program |
| Meal Plan Pipeline | `meal_plans`, `recipes`, `shopping_lists` | Weekly plan |
| Research Digest Pipeline | `health_updates` | Digest records |
| Janet-Clinician Pipeline | `checkin_reviews`, `monthly_programs` | Clinical brief, 30-day plan |
| Onboarding Flow | `profiles.onboarding_step` | Progress marker |
| Support Agent | `agent_conversations`, `support_tickets` | Conversation turns, escalation records |

---

### 1.5 Trigger taxonomy

| Type | Examples | Execution model |
|---|---|---|
| **User message** | WhatsApp, in-app chat | Synchronous (Agent blueprint) |
| **Lifecycle event** | `completed_at` set, upload processed | Async (Pipeline blueprint) |
| **Scheduled** | Weekly health_researcher, monthly PT plan | Async (Pipeline blueprint, Vercel Cron) |
| **Clinician action** | Monthly review initiated in CRM | Async (Pipeline blueprint, human-gated) |

---

### 1.6 Vector DB and Hybrid RAG

Janet uses a hybrid retrieval layer to ground responses in current medical and longevity research. The knowledge base lives in Supabase as a `pgvector` table and is populated exclusively by the Research Digest Pipeline (health_researcher).

**Why hybrid (not vector-only):** Pure semantic search misses exact clinical terms (drug names, gene variants, biomarker thresholds). Pure keyword search misses conceptual synonymy. Reciprocal Rank Fusion (RRF) over both gives competitive accuracy with no reranker latency overhead.

**Schema:**

```sql
CREATE TABLE health_knowledge (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content      text NOT NULL,
  embedding    vector(2560),       -- perplexity/pplx-embed-v1-4b at 2560 dims (MRL; reducible to 128–2560)
  metadata     jsonb,              -- { source, category, evidence_level, digest_id, published_at }
  fts          tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at   timestamptz DEFAULT now()
);

-- HNSW: best speed/recall tradeoff; no training step needed
CREATE INDEX ON health_knowledge USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- GIN for full-text keyword search
CREATE INDEX ON health_knowledge USING gin (fts);
```

**Embedding model:** `perplexity/pplx-embed-v1-4b` via OpenRouter (`POST https://openrouter.ai/api/v1/embeddings`) — 2560 dimensions, 32K context window (handles full medical articles without chunking pressure), INT8 quantized natively, Matryoshka MRL (reducible to 128–2560 without retraining if index size becomes a concern). Uses the same `OPENROUTER_API_KEY` as all LLM calls — no additional credential. API latency ~20 ms per batch.

```ts
const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "perplexity/pplx-embed-v1-4b", input: chunks }),
});
const { data } = await res.json(); // data[i].embedding: number[2560]
```

**Hybrid search SQL function (RRF, k=60):**

```sql
CREATE OR REPLACE FUNCTION hybrid_search_health(
  query_text    text,
  query_vec     vector(2560),
  match_count   int     DEFAULT 5,
  sem_weight    float   DEFAULT 1.0,
  kw_weight     float   DEFAULT 1.0
)
RETURNS TABLE (id uuid, content text, metadata jsonb, score float)
LANGUAGE sql AS $$
  WITH semantic AS (
    SELECT id,
           ROW_NUMBER() OVER (ORDER BY embedding <=> query_vec) AS rank
    FROM health_knowledge
    LIMIT match_count * 2
  ),
  keyword AS (
    SELECT id,
           ROW_NUMBER() OVER (
             ORDER BY ts_rank_cd(fts, plainto_tsquery(query_text)) DESC
           ) AS rank
    FROM health_knowledge
    WHERE fts @@ plainto_tsquery(query_text)
    LIMIT match_count * 2
  ),
  fused AS (
    SELECT COALESCE(s.id, k.id) AS id,
           (COALESCE(sem_weight / (60 + s.rank), 0.0) +
            COALESCE(kw_weight  / (60 + k.rank), 0.0)) AS score
    FROM semantic s FULL OUTER JOIN keyword k ON s.id = k.id
  )
  SELECT hk.id, hk.content, hk.metadata, f.score
  FROM fused f JOIN health_knowledge hk ON hk.id = f.id
  ORDER BY f.score DESC
  LIMIT match_count;
$$;
```

**Janet's RAG query — executed inside `PatientContext.load()` in parallel with other DB reads:**

1. Build profile query string from user's top 2 risk domains + last check-in topic (no LLM call; string assembly ~0 ms).
2. Embed via OpenRouter (`perplexity/pplx-embed-v1-4b`) — ~20 ms.
3. Call `hybrid_search_health(query_text, query_vec, 5)` (~10 ms HNSW + GIN).
4. Inject top-5 chunks as `## RELEVANT RESEARCH` block in system prompt.

Total RAG overhead added to PatientContext.load(): **~30 ms** (runs in parallel — adds zero sequential latency).

**Chunking strategy (health_researcher writes this):** Each research digest is split into 400-token chunks with 80-token overlap. Each chunk inherits the digest's `metadata.category` and `metadata.evidence_level` so Janet can cite them with appropriate confidence.

---

### 1.7 Error handling

| Failure | Pipeline worker | Agent |
|---|---|---|
| Zod parse failure | Retry once with correction. On second failure: write `status: "failed"` row. | Retry once. On second failure: respond with error message; log turn. |
| Supabase write failure | Log error. Never silently swallow. | Log error. Respond to user; do not drop the turn. |
| LLM timeout | Retry once after 3 s. Then fail row. | Retry once. Then stream apology to user. |
| Pipeline in user path | **Must never happen.** All pipelines fire async post-commit. | n/a |

---

---

## Part 2 — Architecture

---

### 2.1 Overview

```
                    ┌──────────────────────────────┐
                    │   USER (WhatsApp / App)       │
                    │   patient · clinician · B2B   │
                    └────────────┬─────────────────┘
                                 │
               health channel    │    support channel
              ┌──────────────────┤─────────────────────┐
              ▼                  │                     ▼
  ┌─────────────┐                │         ┌──────────────────────┐
  │   JANET     │◄──RAG query────┤─────────│   ALEX (Support)     │
  │   Agent     │   ~30 ms       │         │   Agent              │
  └──┬──────────┘                │         │   patient/clinician  │
     │                           │         │   /B2B persona mode  │
     │ tool_use (real-time)      │         └──────────────────────┘
     ├──→ Risk Narrative sub-agent (risk_analyzer)    blocks current turn; user waits
     ├──→ Supplement Protocol sub-agent (supplement_advisor)
     └──→ PT Coach live sub-agent

  ┌──────────────────────────────────────────────────────┐
  │  VECTOR DB (pgvector + HNSW)                         │
  │  health_knowledge — populated by health_researcher    │
  │  Janet hybrid-searches at every session start        │
  └──────────────────────────────────────────────────────┘

════════════════════════════════════════════════════════════════
  ASYNC PIPELINE WORKERS  (write to Supabase; never block user)
════════════════════════════════════════════════════════════════

  Assessment completed ──→ PT Coach Monthly Plan Pipeline
                      ──→ Meal Plan Pipeline (if triggered)

  Weekly cron          ──→ Research Digest Pipeline (health_researcher)
                                └─→ health_updates (structured)
                                └─→ health_knowledge (pgvector chunks)

  Clinician action     ──→ Janet-Clinician Pipeline

  Onboarding event     ──→ Onboarding Flow

  Note: Risk Narrative and Supplement Protocol are now real-time
  sub-agents invoked by Janet via tool_use, not background pipelines.
```

---

### 2.2 Latency budget

| Path | Target | How |
|---|---|---|
| Janet first token (no tool_use) | < 800 ms | Single LLM call; parallel PatientContext + RAG fetch (~50 ms); streaming |
| Janet first token (with tool_use) | < 4 s | Turn 1: Janet decides to delegate (~500 ms) → sub-agent LLM call (~1–2 s) → Turn 2: Janet synthesizes (streaming) |
| PT Coach live first token | < 800 ms | tool_use routing within Janet's turn; one LLM call |
| RAG query overhead | ~30 ms | Parallel with PatientContext.load(); Voyage embed + HNSW search |
| Assessment submit → redirect | < 2 s | Deterministic engine sync (no LLM); async pipeline triggers post-redirect |
| PT Coach Monthly Plan Pipeline | < 60 s | Async, 1st-of-month; user not waiting |
| Research Digest Pipeline | < 200 s | Weekly cron; parallel web search + batch embed; see §health_researcher design |

**Critical constraints:**
- The only synchronous LLM calls in a user-facing path are Janet and its real-time sub-agents.
- RAG query runs in parallel with other `PatientContext.load()` reads — zero sequential overhead.
- Background pipelines (PT monthly, health_researcher, Janet-Clinician, Meal Plan) never block any user response.

---

### 2.3 Data flow: assessment → pipeline fan-out

```
User submits onboarding
        │
        ▼
submitAssessment() server action
        │
        ├── write health_profiles row (completed_at = now)
        ├── run deterministic risk engine  ← sync, < 100 ms, no LLM
        │         └── upsert risk_scores (domain scores, bio-age, engine_output)
        └── redirect /dashboard            ← user lands on dashboard immediately

                [async, post-redirect]
                        ├── Risk Narrative Pipeline
                        │         └── updates risk_scores.narrative + drivers + screenings
                        └── Supplement Protocol Pipeline
                                  └── updates risk_scores.supplements_json
                                           │
                                           └── Janet reads updated PatientContext on next session
```

---

### 2.4 Data flow: Janet session

```
User message
        │
        ▼
PatientContext.load()            ← Promise.all (~50 ms); includes RAG query in parallel
        │   ├── DB reads (profiles, risk_scores, supplements, etc.)
        │   └── RAG: embed profile query → hybrid_search_health() → top-5 chunks (~30 ms)
        │
        ▼
Build system prompt              ← inject PatientContext + RAG chunks + conversation window
        │
        ▼
LLM call (streaming)             ← Turn 1
        │
        ├── Response is direct coaching?
        │         └── Stream to user; persist turn
        │
        └── Response is tool_use (specialist needed)?
                  │
                  ├── invoke_risk_analyzer   → risk_analyzer sub-agent LLM call (~1–2 s)
                  ├── invoke_supplement_advisor → supplement_advisor sub-agent LLM call (~1–2 s)
                  └── invoke_pt_coach         → PT Coach sub-agent LLM call (~1 s)
                            │
                            ▼
                        tool_result returned to Janet
                            │
                            ▼
                        LLM call (streaming) ← Turn 2: Janet synthesizes + streams to user
                            │
                            └── Persist both turns to agent_conversations
```

**Sub-agent calls are real-time** — they block the current HTTP request and the user waits. This is correct and expected for substantive analytical requests (risk analysis, supplement review). Streaming Turn 2 means the user sees Janet's synthesis arriving as the sub-agent result is processed.

**Background pipelines (PT monthly, health_researcher, Meal Plan, Janet-Clinician) are async** — health_researcher writes to the vector DB and `health_updates`; Janet reads from both at session start. No real-time delegation to these.

---

### 2.5 Real-time sub-agent delegation vs background pipelines

The key distinction: **does the user need the result right now?**

| Component | Delegation type | Why |
|---|---|---|
| Risk Narrative (risk_analyzer) | Real-time tool_use | User asked about their risk — they're waiting for the answer |
| Supplement Protocol (supplement_advisor) | Real-time tool_use | User asked about supplements — they want a live response |
| PT Coach (live session) | Real-time tool_use | User is mid-session — they need guidance immediately |
| PT Coach (monthly plan) | Background (async cron) | Monthly program; user isn't waiting for it |
| Meal Plan | Background (async) | Weekly plan; generated ahead of time |
| Research Digest (health_researcher) | Background (async cron) | Knowledge base maintenance; feeds Janet via RAG, not live calls |
| Janet-Clinician | Background (clinician-gated) | Clinician initiates asynchronously; no patient waiting |

**Tool_use flow for real-time sub-agents:**

Janet emits a `tool_use` block in Turn 1. The runner resolves it by calling the sub-agent function (which is its own LLM call with a specialist system prompt and targeted context). The result is returned as a `tool_result` in the same conversation thread. Janet synthesizes in Turn 2 and streams the response to the user.

This is one HTTP request from the user's perspective — they see streaming text from Janet, which internally completed a sub-agent round-trip.

---

### 2.6 Session state

`agent_conversations` — one row per message turn.

| column | type | notes |
|---|---|---|
| `id` | uuid | PK |
| `user_uuid` | uuid | FK → profiles |
| `agent` | text | `janet` / `pt_coach_live` |
| `role` | text | `user` / `assistant` |
| `content` | text | message body |
| `created_at` | timestamptz | |

Active window: last 20 turns per `(user_uuid, agent)`. Older turns are summarized to one sentence per session and stored as `conversation_history_summary` in the PatientContext layer — never re-fetched in full.

---

---

## Part 3 — Component definitions

---

### Component 1 — Janet

**Type:** Agent
**Priority:** P3 (needs Risk Narrative + Supplement output to be useful)
**Model:** `claude-sonnet-4-6`, streaming

**What it does:** Sole conversational interface for the user. Reads all pre-computed health data from PatientContext and delivers personalised longevity coaching. Routes training messages to PT Coach live session. Books clinician appointments.

**Trigger:** Inbound user message (WhatsApp / in-app).

**Tone:** Warm, conversational, never clinical. 2–4 paragraphs unless user requests detail. Brilliant friend with a longevity PhD.

**Reads:** Full PatientContext + last 20 conversation turns.

**Writes:**

| Output | Table | When |
|---|---|---|
| Conversation turn | `agent_conversations` | Every message |
| Data-gap suggestion | `coach_suggestions` | When a missing test would materially change the protocol |
| Appointment | `appointments` | After booking confirmation |

**Real-time specialist delegation (tool_use):**

| Tool | Sub-agent | When Janet uses it |
|---|---|---|
| `invoke_risk_analyzer` | Risk Narrative (risk_analyzer) | User asks about risk profile, bio-age, or modifiable factors |
| `invoke_supplement_advisor` | Supplement Protocol (supplement_advisor) | User asks about supplements or a new upload was just processed |
| `invoke_pt_coach` | PT Coach live | Training-related message; active session in progress |

**Appointment booking:**
1. Check `entitlements` — verify `total_used < total_allocated` for type `clinician_review` or `coaching_session`.
2. Read `clinician_profiles` (is_active = true) — present options.
3. Collect date/time preference; validate against clinician availability; conflict-check `appointments` table.
4. Confirm with user → insert `appointments` row + increment `entitlements.total_used`.

**Precision coaching signals:**

| Signal | Action |
|---|---|
| HRV < 40 ms | Recovery day; no heavy training |
| Fasting glucose > 100 | Post-meal walk; extended fasting window |
| Stress 4–5/5 | Box breathing protocol |
| Sleep < 3/5 | Sauna timing, magnesium, circadian anchoring |
| hs-CRP > 1 mg/L | Anti-inflammatory protocol; omega-3 dose review |
| APOE ε4 | DHA 2 g/day; Mediterranean pattern; glucose monitoring emphasis |
| MTHFR variant | Methylated B vitamins only |
| Risk data > 30 days old | Notify user; fire async Risk Narrative refresh event |

---

### Component 2 — PT Coach (Live Session)

**Type:** Agent
**Priority:** P5 (needs Janet routing + `training_sessions` schema)
**Model:** `claude-sonnet-4-6`, streaming

**What it does:** Real-time session coaching. Activated when Janet routes a training-related message. Reads today's session and biometric signals; delivers session-specific guidance. Logs the session.

**Trigger:** Training-related user message routed by Janet.

**Tone:** Warm but direct. Max 3 bullet points per response during a session.

**Reads:**

| Data | Source |
|---|---|
| Today's session | `training_sessions` (today's row) |
| HRV, sleep (last 24 hrs) | `daily_checkins` |
| Active program | `training_programs` |

**Writes:** `training_sessions` (session log)

**Autoregulation rules:**

| Sleep | Stress | Adjustment |
|---|---|---|
| > 7 hrs | < 5/10 | Full session as planned |
| 6–7 hrs | < 5/10 | Cap RPE at 8 |
| 6–7 hrs | 5–7/10 | −20% volume, hold intensity |
| < 6 hrs | Any | −30–40% volume, −10% intensity |
| Any | > 7/10 | Mobility / active recovery |
| < 6 hrs | > 7/10 | Rest day |

---

### Component 3 — PT Coach (Monthly Plan Pipeline)

**Type:** Pipeline worker
**Priority:** P5
**Model:** `claude-sonnet-4-6`

**What it does:** Generates a 4-week training program at the start of each month. Single-shot structured output.

**Trigger:** Vercel Cron — 1st of month, for users with an active training subscription.

**Reads:** Demographics + conditions (`profiles`, `health_profiles.responses`), CV + MSK risk scores (`risk_scores`), wearable VO2max + 30-day HRV (`wearable_devices`), prior month sessions (`training_sessions`).

**Writes:** `training_programs` — upsert on `(user_uuid, period_month)`.

**Output schema (Zod):**
```
{
  period_month: string,
  week_1: SessionBlock[],
  week_2: SessionBlock[],
  week_3: SessionBlock[],
  week_4: SessionBlock[],
  longevity_focus: string[],   // e.g. ["VO2max", "grip strength", "bone loading"]
  generated_at: string,
  confidence: "low" | "moderate" | "high",
}
```

**Rules:**
- Always include ≥ 2 zone 2 sessions per week.
- Never prescribe high-intensity cardio if CV risk score > 70.
- Longevity priorities: VO2max, grip strength, bone loading, muscle mass, balance.

---

### Component 4 — Risk Narrative Pipeline

**Type:** Pipeline worker
**Priority:** P2
**Model:** `claude-sonnet-4-6`

**What it does:** Writes a human-readable narrative on top of the deterministic risk engine output. The engine computes all numbers; this pipeline writes the story, modifiable factor ranking, and screening recommendations.

**Trigger:**
- Lifecycle event: `health_profiles.completed_at` set (async, post-redirect).
- Stale refresh event from Janet (risk data > 30 days old).

**Reads:** `risk_scores.engine_output`, `health_profiles.responses` (family, medical, lifestyle), `profiles` (demographics).

**Writes:** `risk_scores` — upsert on `user_uuid`.

**Output schema (Zod):**
```
{
  narrative: string,                   // 200–400 words, plain language
  top_risk_drivers: string[],          // up to 7, ranked, modifiable only
  top_protective_levers: string[],     // up to 5
  recommended_screenings: string[],    // specific tests, not "see your doctor"
  confidence_level: "low" | "moderate" | "high" | "insufficient",
  data_gaps: string[],
}
```

**Tone:** Calm, measured, empathetic. Absolute vs relative risk always distinguished. Never alarmist. When discussing family illness, acknowledge emotional weight before data.

**Rules:**
- Never reference biomarker values not present in `engine_output`.
- Any domain score > 70 requires a specific clinical action in `recommended_screenings`.

---

### Component 5 — Supplement Protocol Pipeline

**Type:** Pipeline worker
**Priority:** P1 (first component gated on uploads infrastructure)
**Model:** `claude-sonnet-4-6`

**What it does:** Generates a complete daily supplement protocol from bloodwork, genetics, medications, risk scores, and allergies. Replaces the existing protocol on each run.

**Trigger:**
- Lifecycle event: assessment completed (async).
- Lifecycle event: new medical upload processed (biomarker extraction complete).

**Reads:** `patient_uploads` (AI-extracted biomarkers), `risk_scores`, `health_profiles.responses` (medical, family), `profiles` (age, sex), current `risk_scores.supplements_json`.

**Writes:** `risk_scores.supplements_json` — upsert on `user_uuid`.

**Output schema (Zod):**
```
{
  supplements: Array<{
    name: string,
    form: string,
    dosage: string,
    timing: string,
    priority: "critical" | "high" | "recommended",
    domains: string[],
    rationale: string,   // 1–2 sentences citing the specific data point
    note?: string,       // drug interactions, contraindications
  }>,
  generated_at: string,
  data_completeness_note: string,
  interactions_checked: boolean,
}
```

**Prioritization tiers:**
- **Critical:** Acute deficiencies (Vit D < 30 ng/mL, B12 < 400 pg/mL)
- **High:** Major domain risk (cardiovascular, metabolic, inflammatory)
- **Recommended:** Longevity optimization (NAD+, mitochondrial)
- **Performance:** Goal-specific (muscle, cognition, sleep)

**Hard rules:**
- Flag every drug-nutrient interaction explicitly in `note`. Never omit.
- If any biomarker is critically abnormal, prepend a medical attention flag before the protocol.
- No duplications against existing protocol.
- Baseline (no bloodwork yet): seed from `lib/supplements/protocol.ts` deterministic catalog; add LLM-generated rationale.

---

### Component 6 — Meal Plan Pipeline

**Type:** Pipeline worker
**Priority:** P6 (needs Janet + macro goal infrastructure)
**Model:** `claude-sonnet-4-6`

**What it does:** Generates a personalised weekly meal plan with recipes and a shopping list. Searches the web for trending recipes before generating.

**Trigger:** Weekly Vercel Cron OR explicit user request routed by Janet.

**Tool use:** `web_search` — called on every run to source trending recipes. Every recipe must include a source URL.

**Reads:** Macro goals (`profiles`), dietary pattern + staples (`health_profiles.responses.lifestyle`), bloodwork concerns (`patient_uploads`), risk scores, allergies + conditions (`health_profiles.responses.medical`).

**Writes:** `meal_plans`, `recipes`, `shopping_lists` — upsert on `(user_uuid, week_start)`.

**Bloodwork food rules:**

| Concern | Priority foods |
|---|---|
| High LDL | Oats, fatty fish, nuts, avocado, olive oil, legumes, berries |
| High hs-CRP | Turmeric, ginger, fatty fish, leafy greens, berries |
| High estrogen (male) | Cruciferous veg, flaxseed, citrus |
| Elevated fasting glucose | High-fibre foods, leafy greens, legumes, whole grains |

**Output schema per meal:**
```
{
  name: string,
  macros: { calories, protein_g, carbs_g, fat_g },
  ingredients: Array<{ item, quantity, unit }>,
  instructions: string[],
  source_url?: string,
  is_bloodwork_optimised: boolean,
}
```

---

### Component 7 — Research Digest Pipeline (health_researcher)

**Type:** Pipeline worker
**Priority:** P7 (background; feeds Janet's knowledge base — not real-time)
**Model:** `claude-sonnet-4-6`

**What it does:** Runs weekly to scan current scientific literature, synthesize actionable digests, and write them to two targets: the structured `health_updates` table (for display) and the `health_knowledge` pgvector table (for Janet's RAG layer). The health_researcher pipeline is the sole writer to the knowledge base.

**Trigger:** Vercel Cron — weekly. Designed to run within Vercel Pro's 300 s max function duration.

**Tool use:** `web_search` — targets PubMed, Nature, Cell, medRxiv, Cochrane.

**Execution plan (target < 200 s; comfortably within 300 s limit):**

```
Phase 1 — Search (parallel, ~10 s)
  Promise.all: 6 web_search calls, one per category
  Each returns top 5 URLs + snippets

Phase 2 — Fetch + extract (parallel batches of 6, ~25 s)
  Fetch up to 30 article bodies; extract main content; discard boilerplate
  Deduplicate: skip URLs already in health_knowledge.metadata.source (last 30 days)

Phase 3 — Synthesize (3 parallel LLM calls × 2 batches, ~40 s)
  One LLM call per category → structured digest + 3–5 key passages for embedding

Phase 4 — Chunk + embed (single OpenRouter batch call, ~20 s)
  Split each digest: 400-token chunks, 80-token overlap
  Batch embed all chunks via perplexity/pplx-embed-v1-4b (2560 dims) through OpenRouter

Phase 5 — Upsert (~5 s)
  Insert to health_updates (one row per digest)
  Upsert to health_knowledge (one row per chunk)
  Prune health_knowledge rows older than 90 days to bound index size

Total: ~100 s
```

**Reads:** `health_updates` and `health_knowledge.metadata.source` (last 30 days) — deduplication only.

**Writes:**

| Target | What |
|---|---|
| `health_updates` | One structured digest row per category per run |
| `health_knowledge` | 3–5 embedded chunks per digest (400-token, 80-token overlap) |

**Digest schema (`health_updates`):**
```
{
  title: string,
  content: string,       // 2–3 paragraphs, actionable
  category: "longevity" | "biohacking" | "supplements" | "exercise" | "nutrition" | "sleep",
  source: string,
  evidence_level: "strong" | "moderate" | "preliminary",
  posted_date: timestamptz,
}
```

**Knowledge chunk schema (`health_knowledge`):**
```
{
  content: string,       // 400-token passage
  embedding: vector(2560),
  metadata: {
    source: url,
    category: string,
    evidence_level: string,
    digest_id: uuid,     // FK → health_updates.id
    published_at: date,
  }
}
```

**Rules:**
- Rotate through all 6 categories over each 6-week period.
- Always distinguish strong evidence from preliminary findings.
- Content is generic (not user-specific). Janet's RAG query filters relevance per user at session start.
- Never synthesize preliminary findings as recommendations — mark evidence level explicitly.

---

### Component 8 — Janet-Clinician Pipeline

**Type:** Pipeline worker
**Priority:** P4 (needs Janet + clinician CRM portal)
**Model:** `claude-sonnet-4-6`

**What it does:** Generates a clinical brief and 30-day program for the assigned clinician's monthly patient review. Does not interact with the patient.

**Trigger:** Monthly review initiated by clinician in CRM portal (human-gated).

**Tone:** Concise, clinical, peer-to-peer. Risk flags prominent.

**Reads:** `monthly_checkins`, `profiles`, `health_profiles`, `patient_uploads`, `risk_scores`, `risk_scores.supplements_json`, prior `checkin_reviews`, `patient_assignments`.

**Writes:**

| Output | Table | When |
|---|---|---|
| Clinical brief | `checkin_reviews` | On trigger |
| 30-day program | `monthly_programs` | After clinician confirms |

**Clinical brief structure:**
1. Demographics snapshot (age, sex, key conditions)
2. This month's check-in summary (sleep, energy, mood, stress, adherence)
3. Key biomarker changes since last review
4. Risk flags (stress ≥ 8, adherence ≤ 4, sentiment = `needs_attention`)
5. Suggested focus areas for the 30-day program

**Program output sentinel:** Terminates with `PROGRAM_READY` on its own line so the CRM can detect completion and notify the patient.

---

### Component 9 — Onboarding Flow

**Type:** Pipeline worker (lightweight)
**Priority:** Deferred — build when WhatsApp drop-off rate justifies it
**Model:** `claude-haiku-4-5`

**What it does:** Handles FAQ-style questions at each onboarding step and sends re-engagement nudges when completion stalls.

**Trigger:** First WhatsApp contact from new user OR cron detects `completed_at` null + `created_at` > 48 hrs ago.

**Reads:** `profiles.onboarding_step`, `health_profiles.completed_at`, `organisations`.

**Writes:** `profiles.onboarding_step`

**Onboarding steps:**

| Step | Content |
|---|---|
| 1 About You | Name, phone, age, sex, height, weight, ethnicity |
| 2 Medical History | Conditions, medications, surgeries, allergies |
| 3 Family History | CV, cancer, neuro, diabetes, osteoporosis in first-degree relatives |
| 4 Lifestyle | Smoking, alcohol, exercise, sleep, stress, diet |
| 5 Goals | Top 5 health priorities |
| 6 Uploads (optional) | Blood panels, imaging, genetics, microbiome |
| 7 Consent + Submit | Accept terms → deterministic risk engine runs |

**Standard objection responses:**
- "I don't have blood results" → "Step 6 is optional. Add anytime from your dashboard."
- "I don't know my family history" → "'Unknown' is valid and can be updated later."
- "Is my data safe?" → "Encrypted, private, never shared without your consent."

---

### Component 10 — Support Agent

**Type:** Agent
**Priority:** P5 alongside PT Coach — build when WhatsApp channels launch
**Model:** `claude-sonnet-4-6`, streaming

**What it does:** Conversational support agent for all non-health platform questions. Handles three distinct customer personas — patient, clinician, and B2B client — each with different platform access, workflows, and concerns. Resolves blockers directly where possible; creates escalation tickets when it cannot.

The support agent does NOT read health data. It reads only platform context (role, subscription, organisation, ticket history). This is a hard privacy boundary — support conversations must never expose clinical details.

**Trigger:** Inbound message on the support channel (WhatsApp / in-app support tab).

**Tone:** Calm, patient, professional. Warm with frustrated users. Never says "I don't know" without a concrete next step.

**Persona detection:** Read `profiles.role` at session start to select the active mode.

| `profiles.role` value | Active mode |
|---|---|
| `patient` | Patient mode |
| `clinician` | Clinician mode |
| `b2b_admin` / `b2b_member` | B2B mode |

---

**Patient mode**

Handles: onboarding blockers, feature navigation, upload questions, subscription/billing, data access requests, wearable sync issues.

Reads:

| Data | Source |
|---|---|
| Profile + onboarding step | `profiles` |
| Subscription status | `subscriptions` |
| Ticket history | `support_tickets` |

Common resolution scripts:

| Issue | Resolution |
|---|---|
| "Where do I add my bloodwork?" | Navigate: Dashboard → Uploads → Add test results |
| "My wearable isn't syncing" | Check app permissions; re-link device from Settings → Wearables |
| "I want to change my goal" | Dashboard → Profile → Edit goals |
| "I want to cancel" | Direct to billing portal link; note cancellation policy |
| "How do I see my longevity score?" | Dashboard → Report — available after onboarding completes |
| "I haven't received my welcome email" | Resend from auth; check spam; verify email address on file |

---

**Clinician mode**

Handles: CRM portal navigation, patient list management, monthly review workflows, report access, technical issues with the clinician dashboard.

Reads:

| Data | Source |
|---|---|
| Profile + role | `profiles` |
| Patient assignments | `patient_assignments` |
| Organisation | `organisations` |
| Ticket history | `support_tickets` |

Common resolution scripts:

| Issue | Resolution |
|---|---|
| "I can't see a patient's record" | Verify `patient_assignments` — patient may not be assigned; flag for admin |
| "Where do I start a monthly review?" | CRM portal → Patient → Monthly Review → Initiate |
| "The program I wrote didn't send to the patient" | Check `monthly_programs.status` — must be `confirmed` and `PROGRAM_READY` sentinel present |
| "I need to update a patient's supplement protocol" | Clinicians don't edit protocols directly — flag to Janet-Clinician pipeline via monthly review |
| "I need a patient summary for a referral" | Reports → Patient Summary → Export PDF |

---

**B2B mode**

Handles: admin portal questions, team member onboarding, programme reporting, invoicing and billing, integration queries, corporate wellness programme configuration.

Reads:

| Data | Source |
|---|---|
| Organisation + tier | `organisations` |
| Seat allocation + usage | `organisations.seat_count`, active profiles count |
| Subscription + billing | `subscriptions` |
| Ticket history | `support_tickets` |

Common resolution scripts:

| Issue | Resolution |
|---|---|
| "How do I add a new team member?" | Admin portal → Team → Invite member (must have seat available) |
| "We've run out of seats" | Upgrade plan or remove inactive member; escalate to sales if >10 seats needed |
| "I need a usage report for our HR team" | Admin portal → Reports → Export CSV (monthly or quarterly) |
| "A team member can't access the platform" | Check `profiles.role` = `b2b_member` + org assignment; resend invite if needed |
| "We want to configure the programme for a specific health focus" | Escalate to customer success team — requires programme configuration |

---

**Writes:**

| Output | Table | When |
|---|---|---|
| Conversation turn | `agent_conversations` | Every message |
| Support ticket | `support_tickets` | When issue requires human follow-up or escalation |

**Ticket schema:**
```
{
  user_uuid: string,
  persona: "patient" | "clinician" | "b2b_admin" | "b2b_member",
  category: "account" | "billing" | "technical" | "feature_request"
           | "data" | "wearables" | "onboarding" | "clinical"
           | "corporate" | "integration" | "other",
  summary: string,        // 1–2 sentences
  conversation_ref: uuid, // agent_conversations session id
  status: "open" | "in_progress" | "resolved" | "escalated",
  created_at: timestamptz,
}
```

**Auto-escalation triggers** (ticket status = `escalated` + notify support@janet.care):
- Billing disputes or refund requests
- Data deletion / right-to-erasure requests
- GDPR / HIPAA / privacy compliance requests
- Account access locked
- Bugs reproducible and unresolved after standard troubleshooting
- B2B seat or contract queries > 10 seats
- Any clinician unable to complete a patient review

**Rules:**
- Never read or reference health data (`health_profiles`, `risk_scores`, `patient_uploads`). If a user asks about their health results, redirect: "For your health data and coaching, message Janet on your coaching channel."
- Always confirm the issue is resolved before closing the session. Ask "Does that solve it?" before ending.
- If the same issue appears in `support_tickets` history (same `user_uuid`, same `category`, unresolved), acknowledge it: "I can see this came up before — let me escalate this directly."

---

---

## Appendix A — Environment variables

| Variable | Used by |
|---|---|
| `ANTHROPIC_API_KEY` | All components |
| `SUPABASE_SERVICE_ROLE_KEY` | All components (write path) |
| `NEXT_PUBLIC_SUPABASE_URL` | All components |
| `OPENROUTER_API_KEY` | All LLM calls + embeddings (shared; `perplexity/pplx-embed-v1-4b` via `/api/v1/embeddings`) |
| `RESEND_API_KEY` | Onboarding flow, auth callback |
| `NEXT_PUBLIC_SITE_URL` | Auth callbacks, email links |

---

## Appendix B — Pending decisions (James-gated)

| Item | Blocks |
|---|---|
| Supabase Storage bucket + RLS | Supplement Protocol Pipeline (biomarker extraction path) |
| Stripe price IDs | Janet (entitlement check for appointment booking) |
| WhatsApp Business API credentials | Janet, PT Coach live, Support Agent, Onboarding Flow |
| Separate WhatsApp number / channel for support | Support Agent (must not share Janet's health channel) |
| Clinician CRM portal | Janet-Clinician Pipeline |
| `training_sessions` schema | PT Coach (both components) |
| `meal_plans`, `recipes`, `shopping_lists` schemas | Meal Plan Pipeline |
| `health_updates` + `health_knowledge` schemas + pgvector migration | Research Digest Pipeline, Janet RAG |
| Supabase pgvector extension enabled on project | Janet RAG, health_researcher |
| `monthly_checkins`, `checkin_reviews` schemas | Janet-Clinician Pipeline |

---

## Appendix C — Build order

```
Supplement Protocol Pipeline (P1)
  → Risk Narrative Pipeline (P2)
    → Janet Agent (P3)
      → Janet-Clinician Pipeline (P4)
      → PT Coach Live Agent + Monthly Plan Pipeline (P5)  ←┐
      → Support Agent (P5, parallel)                    ←──┘ both need WhatsApp channels
      → Meal Plan Pipeline (P6)

Research Digest Pipeline (P7) — independent, any time

Onboarding Flow — deferred until WhatsApp drop-off rate justifies it
```

Hard dependency: Supplement Protocol Pipeline cannot reach tier 2–4 recommendations without risk_analyzer scores. Risk Narrative Pipeline feeds domain thresholds for the Supplement Protocol. Janet is most useful only after both pipelines have run at least once.
