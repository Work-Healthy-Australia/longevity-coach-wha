# Plan: AI Agent Layer & AI SDK v6 Migration
Date: 2026-04-28
Phase: Phase 2 (Intelligence) + Phase 3 (Engagement)
Status: Complete

## Objective

Migrate all AI calls from the raw `@anthropic-ai/sdk` to Vercel AI SDK v6, introduce a database-driven agent definition system so prompts and models are editable without redeploy, wire Atlas and Sage pipelines to load their definitions at runtime, migrate Janet to `streamText` + `useChat` v6, build the Alex CS support agent with a floating FAB on all member pages, create the Agent Manager admin UI, and lay the RAG foundation for Janet's knowledge retrieval.

## Scope

**In scope:**
- `lib/ai/types.ts`, `lib/ai/providers.ts`, `lib/ai/loader.ts` — AI SDK v6 foundation
- AI SDK v6 migration: risk-narrative pipeline, supplement-protocol pipeline, Janet agent, `/api/chat` route, `janet-chat.tsx`
- Zustand chat store (`lib/stores/chat-store.ts`)
- Alex CS agent + `/api/chat/alex` route + AlexFAB component + layout wiring
- Agent Manager admin UI (`/admin/agents` list + `[slug]` edit form + server actions)
- `lib/ai/rag.ts` (embedText + retrieveKnowledge), `PatientContext.knowledgeChunks` field, `nova.ts` stub
- Migration 0019: `agent_definitions` table with seed rows for janet, alex, atlas, sage
- `.env.example` updated with `OPENROUTER_API_KEY`

**Out of scope:**
- pgvector execution (migration 0016 deferred — requires Supabase Dashboard extension toggle)
- Nova digest pipeline implementation (Phase 4)
- RAG knowledge seeding
- OpenRouter provider support for chat agents (stretch goal, post-MVP)

## Data model changes

| Table | Change | PII? | Writer |
|---|---|---|---|
| `agent_definitions` | New table — slug, display_name, model, provider, system_prompt, temperature, max_tokens, enabled, mcp_servers JSONB | No | Admin UI server actions only |

## Tasks

### Task 1 — Pre-flight
Install `@ai-sdk/react`, `@ai-sdk/mcp`, `@openrouter/sdk`. Push migration 0019. Regenerate TypeScript types.

### Task 2 — AI SDK v6 foundation (Items 1–3)
Create `lib/ai/types.ts`, `lib/ai/providers.ts`, `lib/ai/loader.ts`.

### Task 3 — Pipeline migration (Items 4–5)
Rewrite risk-narrative and supplement-protocol to use `generateText + Output.object` loaded from `agent_definitions`.

### Task 4 — Janet + chat route migration (Items 6–7)
Rewrite Janet agent to use `streamText + convertToModelMessages`. Rewrite `/api/chat` to return `toUIMessageStreamResponse()`.

### Task 5 — Janet chat UI migration (Item 8)
Rewrite `janet-chat.tsx` to use `useChat` from `@ai-sdk/react` with `DefaultChatTransport`.

### Task 6 — Alex CS agent + FAB (Items 9–13)
Zustand chat store, Alex agent, `/api/chat/alex` route, AlexFAB component + CSS, wire into app layout.

### Task 7 — Agent Manager admin UI (Items 14–15)
`/admin/agents` list page, `[slug]` edit form with MCP server CRUD, server actions, Agents nav link.

### Task 8 — RAG foundation (Item 16)
`lib/ai/rag.ts`, `knowledgeChunks` field on `PatientContext`, `summariseContext` section, `nova.ts` stub.
