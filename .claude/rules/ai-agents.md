# AI Agent & Pipeline Rules

Full design specification: `docs/architecture/agent-system.md`  
Vision summary: `docs/architecture/ai-vision.md`

---

## Two execution models — never mix them

### Agent model (real-time, conversational)

Use when: input is an unpredictable real-time user message; output must be streamed; conversation state matters.

Rules:
- One LLM call per user message. No nested LLM calls inside a response turn.
- Agents read pre-computed pipeline output from the database via `PatientContext.load()`. They never invoke pipeline workers synchronously.
- `PatientContext.load()` must run all DB reads in parallel using `Promise.all`. Target: under 50 ms.
- Conversation window: last 20 turns. Older turns are summarised to one sentence per session.
- If data is stale (e.g. risk scores older than 30 days), the agent notes this to the user and fires an async refresh event. It does not wait for the result.

### Pipeline worker model (async, event or schedule triggered)

Use when: computation is expensive, output can be pre-computed, real-time response is not required.

Rules:
- Always async and non-fatal. User-facing paths never fail because a pipeline worker fails.
- All writes must be idempotent.
- Each pipeline worker owns exactly one write target. No cross-worker table writes.
- Workers are triggered by cron or database event — never directly from a user request.

---

## Agents in build order

| Priority | Agent | Type | Status |
|---|---|---|---|
| P1 | supplement_advisor (Supplement Protocol) | Pipeline worker | Phase 2 |
| P2 | risk_analyzer (Risk Narrative) | Pipeline worker | Phase 2 |
| P3 | Janet (Health Coach) | Real-time agent | Phase 3 |
| P4 | Janet-Clinician Brief | Pipeline worker | Phase 5 |
| P5 | pt_coach (live + monthly plan) | Agent + pipeline | Phase 3 |
| P5 | support | Real-time agent | Phase 3 |
| P6 | chef (Meal Plan) | Pipeline worker | Phase 3 |
| P7 | health_researcher (Research Digest) | Pipeline worker | Phase 4 |

Do not build ahead of the current phase without product owner sign-off.

---

## PatientContext contract

Every real-time agent must load patient context before the first LLM call. The context object must include:
- Profile summary (non-PII: DOB derived age, biological age, risk score summary)
- Active supplement protocol
- Recent check-in summary (last 7 days)
- Conversation history (last 20 turns + compressed older summary)
- Relevant RAG chunks from the health knowledge base (hybrid pgvector search)

The context is read-only inside the agent turn. Writes happen after the LLM response, non-blocking.

---

## RAG / knowledge base

- Vector store: pgvector with HNSW index on `health_knowledge` table.
- Embedding model: `perplexity/pplx-embed-v1-4b` via OpenRouter (2560 dims, 32K context, INT8, MRL).
- Search strategy: hybrid — HNSW vector similarity + BM25 full-text + RRF fusion.
- Target query time: under 30 ms.
- Knowledge is populated by the health_researcher pipeline worker — never written directly by agents.

---

## Claude API usage

- Always use prompt caching for system prompts and PatientContext. Cache hits reduce cost and latency significantly.
- Use streaming for all real-time agent responses.
- Model selection: default to `claude-sonnet-4-6`. Use `claude-opus-4-7` only for complex multi-domain synthesis tasks where accuracy is paramount and latency is acceptable.
- All LLM calls must include a timeout. Never let an LLM call block indefinitely.
- Errors from the LLM layer must be caught and handled gracefully — the user must always receive a response, even if it is a fallback message.

---

## Janet sub-agent pattern

Janet is the primary patient-facing agent. When a specialist sub-agent (risk_analyzer for risk narrative, supplement_advisor for supplements, pt_coach for exercise) is needed:

1. Janet makes a `tool_use` call to the sub-agent.
2. The sub-agent returns a `tool_result`.
3. Janet synthesises the result before streaming to the user.
4. This adds one additional LLM call — acceptable only when the specialist answer is genuinely needed.
5. Never chain more than one layer of sub-agent calls. Janet → sub-agent, never Janet → sub-agent → sub-agent.
