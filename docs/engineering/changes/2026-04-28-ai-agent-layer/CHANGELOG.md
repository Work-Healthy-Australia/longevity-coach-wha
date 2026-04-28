# Changelog: AI Agent Layer & AI SDK v6 Migration
Date: 2026-04-28
Phase: Phase 2 (Intelligence) + Phase 3 (Engagement)

## What was built

- **AI SDK v6 foundation** — `lib/ai/types.ts` (AgentDefinition, MCPServerConfig), `lib/ai/providers.ts` (Anthropic + OpenRouter instances, `getAnthropicModel`), `lib/ai/loader.ts` (cached `loadAgentDef` at 60 s TTL)
- **Atlas pipeline (risk narrative)** — migrated from raw Anthropic SDK + JSON.parse + retry to `generateText + Output.object`; loads system prompt and model from `agent_definitions` at runtime
- **Sage pipeline (supplement protocol)** — same migration pattern as Atlas
- **Janet agent** — migrated to `streamText + convertToModelMessages`; loads def from `agent_definitions`; conversation persistence via `onFinish`
- **`/api/chat` route** — returns `result.toUIMessageStreamResponse()`
- **`janet-chat.tsx`** — migrated to `useChat` v6 (`@ai-sdk/react`) with `DefaultChatTransport`; renders via `msg.parts`
- **Zustand chat store** — `lib/stores/chat-store.ts`; persisted to `localStorage` under key `lc-chat`; tracks Alex open/unread state
- **Alex CS agent** — `lib/ai/agents/alex.ts`; ephemeral; page-path aware; no patient health data (privacy boundary)
- **`/api/chat/alex` route** — streams Alex turns; authenticated; accepts `currentPath` in body
- **AlexFAB** — fixed bottom-right FAB (56 × 56 px, z-200); slide-up panel (400 × 520 px); unread badge; responsive; co-located CSS
- **Agent Manager** — `/admin/agents` list; `/admin/agents/[slug]` edit form (system prompt, model, provider, temperature, max tokens, enabled); MCP server add/remove UI; server actions with `revalidateTag` cache invalidation; Agents nav link in admin layout
- **RAG foundation** — `lib/ai/rag.ts` (`embedText` via OpenRouter pplx-embed-v1-4b, `retrieveKnowledge` via `hybrid_search_health` RPC); `PatientContext.knowledgeChunks` field; `summariseContext` emits knowledge section; `nova.ts` Phase 4 stub

## What changed

| File | Change |
|---|---|
| `lib/ai/pipelines/risk-narrative.ts` | Replaced `@anthropic-ai/sdk` + `callAtlas` retry with `generateText + Output.object + loadAgentDef` |
| `lib/ai/pipelines/supplement-protocol.ts` | Same — replaced `callSage` retry wrapper |
| `lib/ai/agents/janet.ts` | Full rewrite — `streamText`, `convertToModelMessages`, `loadAgentDef`, `onFinish` persistence |
| `app/api/chat/route.ts` | Replaced manual ReadableStream with `toUIMessageStreamResponse()` |
| `app/(app)/report/_components/janet-chat.tsx` | Replaced manual fetch/stream with `useChat` v6 |
| `app/(app)/layout.tsx` | Added `<AlexFAB />` import and render |
| `app/(admin)/layout.tsx` | Added Agents nav link |
| `lib/ai/patient-context.ts` | Added `knowledgeChunks: string[]` to `PatientContext`; `summariseContext` emits knowledge section |
| `.env.example` | `OPENROUTER_API_KEY` already present alongside `ANTHROPIC_API_KEY` |

## Migrations applied

- `0019_agent_definitions.sql` — `agent_definitions` table with seed rows for janet, alex, atlas, sage

## Deviations from plan

- `maxTokens` → `maxOutputTokens` throughout (AI SDK v6 renamed the field — plan used the v5 name)
- `useChat` `initialMessages` → `messages` (v6 renamed the option)
- `revalidateTag` requires a second `cacheLife` argument in Next.js 16 (`"max"`) — plan did not specify this
- OpenRouter `embeddings.generate()` takes `{ requestBody: { model, input } }` — plan showed the OpenAI-SDK-style flat signature
- MCP runtime wiring (Item 4e) deferred — the admin UI CRUD works but live MCP tool injection into `streamText` not yet integrated

## Known gaps / deferred items

- **pgvector** (migration 0016): marked as applied but never executed. Enable `vector` extension in Supabase Dashboard → Database → Extensions, then `supabase db push` to execute.
- **RAG `hybrid_search_health` RPC**: typed as `any` pending 0016 execution and type regen.
- **MCP runtime wiring**: `buildMCPTools` pattern is documented in the original plan under Item 4e — wire into agent `streamText` calls once MCP servers are actively needed.
- **OpenRouter chat agents**: `getAnthropicModel` throws if `provider !== 'anthropic'`; OpenRouter streaming path is a post-MVP stretch goal.
- **Nova pipeline**: Phase 4 stub only.
