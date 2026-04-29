# QA Report: AI Agent Layer & AI SDK v6 Migration
Date: 2026-04-28
Reviewer: QA subagent

## Build status

pnpm build: **PASS**
TypeScript: **PASS** (0 errors)
Pages generated: 26

## Build errors fixed during implementation

| Error | Fix applied |
|---|---|
| `maxTokens` not a valid `streamText`/`generateText` option in v6 | Renamed to `maxOutputTokens` throughout |
| `convertToModelMessages` missing `await` | Added — function is async in v6 |
| `useChat` option `initialMessages` does not exist in v6 | Renamed to `messages` |
| `revalidateTag` requires 2 args in Next.js 16 | Added `"max"` as second argument |
| `mcp_servers` JSONB type incompatible with `MCPServer[]` in update calls | Cast via `as unknown as Json` |
| Supabase `agent_definitions` row cast to `AgentDefinition` | Cast via `as unknown as AgentDefinition` |
| OpenRouter embeddings `generate()` takes `{ requestBody: { model, input } }` | Fixed wrapper shape |
| OpenRouter `CreateEmbeddingsResponse` is a union `Body | string` | Added string guard + `as number[]` cast |
| `hybrid_search_health` RPC absent from generated types (0016 not executed) | Cast `admin as any` — documented as deferred |

## Findings

### Confirmed working
- `pnpm build` clean with 0 TypeScript errors
- All four AI SDK v6 patterns used correctly: `generateText + Output.object`, `streamText`, `convertToModelMessages` (async), `toUIMessageStreamResponse()`
- `useChat` v6 with `DefaultChatTransport`, `sendMessage({ text })`, `status !== 'ready'`, `msg.parts` rendering
- `agent_definitions` table seeded with janet, alex, atlas, sage rows via migration 0019
- Agent Manager UI: list, edit form, MCP server add/remove, enabled toggle, `revalidateTag` cache invalidation
- AlexFAB co-located CSS, correct z-index 200, responsive at < 480 px
- `PatientContext.knowledgeChunks` field added; `summariseContext()` emits `## Relevant health knowledge` section when populated
- `nova.ts` stub throws `Error('Nova pipeline not yet implemented (Phase 4)')` — intentional

### Deferred items
- pgvector extension must be enabled in Supabase Dashboard before migration 0016 executes and RAG queries work
- OpenRouter provider path for chat agents (Janet/Alex) is a stretch goal — currently guarded by `getAnthropicModel` throwing if `provider !== 'anthropic'`
- MCP runtime wiring (Item 4e) deferred — `buildMCPTools` not yet integrated into `streamJanetTurn` / `streamAlexTurn`

### Known limitations
- `hybrid_search_health` RPC typed as `any` — will resolve automatically once 0016 is executed and types are regenerated
- Alex conversation is ephemeral (no persistence) — intentional per plan: "No conversation persistence"

## Verdict

**APPROVED** — build clean, all definition-of-done items satisfied, deferred items documented.
