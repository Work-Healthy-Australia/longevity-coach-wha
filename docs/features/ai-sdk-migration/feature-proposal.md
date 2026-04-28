# Feature Proposal — Vercel AI SDK Migration

**Date:** 2026-04-28  
**Phase:** 2 (foundation uplift) / 3 (agent enablement)  
**Status:** Approved (engineering-initiated, required for Alex + Agent Manager)

---

## Problem

The current AI layer uses `@anthropic-ai/sdk` directly. This limits:
- Multi-provider support (can't switch to OpenRouter for cost/model routing)
- Streaming response handling (hand-rolled ReadableStream management)
- Structured output (manual JSON parse + Zod + retry loop)
- Future MCP tool use (AI SDK has `experimental_createMCPClient` built in)
- Vercel platform integrations (AI Gateway, observability, Queues)

## Solution

Migrate to Vercel AI SDK (`ai` package) with:
- `@ai-sdk/anthropic` — Anthropic direct (default, prompt caching supported)
- `@ai-sdk/openai` compat layer for OpenRouter (any model via `/api/v1` bridge)
- `generateObject` for pipelines — replaces manual JSON + Zod retry
- `streamText` + `toDataStreamResponse()` for conversational agents
- `useChat` hook on client — replaces custom fetch+ReadableStream loop

## Architecture

```
lib/ai/providers.ts
  ├─ anthropicProvider (createAnthropic)
  └─ openrouterProvider (createOpenAI with OpenRouter base URL)

Pipelines (Atlas, Sage) → generateObject(model, schema, prompt)
  └─ Auto-validates + auto-retries on schema mismatch

Agents (Janet, Alex) → streamText(model, system, messages)
  └─ toDataStreamResponse() → useChat() client hook
```

## Database changes

None. This is a pure code change.

## New env vars

| Var | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | Optional; enables OpenRouter model routing from Agent Manager |

## Risk

- **Breaking change to `/api/chat` stream format**: switching from plain text stream to AI SDK data stream format. Janet chat client component must be updated simultaneously. No external consumers — safe.
- `generateObject` mode changes: AI SDK uses `tool` mode for structured output with Claude. Verified compatible with Claude Sonnet 4.6.
