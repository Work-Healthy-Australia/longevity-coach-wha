# Agents — Longevity Coach

The platform uses a mix of real-time conversational agents and asynchronous pipeline workers. See [`../architecture/agent-system.md`](../architecture/agent-system.md) for the full design and the build-order priority list.

Status grounded in code presence in `lib/ai/` as of 2026-04-29.

| # | Agent | Type | Status | % | Description |
|---|---|---|---|---|---|
| 1 | **Sage** | Pipeline worker | ✅ | 75 | Generates personalised daily supplement protocols from de-identified patient data — questionnaire responses, risk score summary, pathology findings. Produces a tier-ranked plan (critical → high → recommended → performance). Code: `lib/ai/pipelines/supplement-protocol.ts`. |
| 2 | **Atlas** | Pipeline worker | ✅ | 75 | Analyses patient health data and produces a structured clinical risk assessment — five-domain risk scores (0–100), biological age estimate, modifiable risk drivers, and a calm risk narrative. Code: `lib/ai/pipelines/risk-narrative.ts`. |
| 3 | **Janet** | Real-time agent | 🔄 | 60 | Patient-facing health coach. Loads `PatientContext` at session start, answers questions about risk profile, supplements, lifestyle, biological age. Books clinician appointments. Code: `lib/ai/agents/janet.ts`. UI integration depth not audited end-to-end in this pass. |
| 4 | **Janet-Clinician Brief** | Pipeline worker | 🆕 | 0 | Generates a clinician-ready brief from a patient's profile for use in care-team handoff. Phase 5. |
| 5 | **PT Coach** | Agent + pipeline | 🆕 | 0 | Live coaching plus monthly plan generation for personal training. Phase 3. |
| 6 | **Alex (Support)** | Real-time agent | 🆕 | 0 | Patient support agent — billing questions, account help, escalation to human support. Phase 3. |
| 7 | **Marco (Meal Plan)** | Pipeline worker | 🆕 | 0 | Generates personalised meal plans from patient context and supplement protocol. Phase 3. |
| 8 | **Nova (Research Digest)** | Pipeline worker | 🆕 | 0 | Populates the RAG knowledge base (`health_knowledge`) with curated longevity research. Phase 4. |

## Architecture rules

- **Real-time agents** stream a single LLM response per user turn; they read pre-computed pipeline output rather than invoking pipelines synchronously. Conversation window is the last 20 turns.
- **Pipeline workers** are async, idempotent, and triggered via `lib/ai/trigger.ts` (fire-and-forget HTTP). Each owns exactly one write target.
- **PatientContext** (`lib/ai/patient-context.ts`) is the read-only context object every real-time agent loads at session start.
- **Janet sub-agent pattern** — Janet may call Atlas, Sage, or PT Coach as `tool_use` sub-agents and synthesise the result before streaming to the user. Never chain more than one layer of sub-agents.

## Glyph legend

| Glyph | Meaning |
|---|---|
| ✅ | Shipped — agent code exists and pipeline is wired |
| 🔄 | In progress — code exists but production integration is partial |
| 📋 | Planned — design exists, code skeleton not yet present |
| 🆕 | Needs planning — only defined in design docs, no code |

## Cross-references

- [`docs/architecture/agent-system.md`](../architecture/agent-system.md) — full design specification (build order, PatientContext contract, Janet sub-agent pattern, RAG strategy).
- [`docs/architecture/ai-vision.md`](../architecture/ai-vision.md) — high-level vision.
- [`.claude/rules/ai-agents.md`](../../.claude/rules/ai-agents.md) — coding rules for agents and pipelines.
- Trigger orchestrator: `lib/ai/trigger.ts`.
- Patient context loader: `lib/ai/patient-context.ts`.
