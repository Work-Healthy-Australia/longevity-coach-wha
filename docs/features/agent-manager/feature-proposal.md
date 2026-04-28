# Feature Proposal — Agent Manager UI

**Date:** 2026-04-28  
**Phase:** 3 (Engagement)  
**Status:** Approved (engineering sign-off, user-requested)

---

## Problem

Agent system prompts, models, and tool connections are hardcoded in source files. To evolve agent behaviour, the team must deploy code. This slows iteration and prevents James from tuning agent personality/tone without engineering.

## Solution

An admin UI at `/admin/agents` backed by a `agent_definitions` database table. Admins can:
1. View all registered agents (Janet, Alex, Atlas, Sage)
2. Edit system prompt, model, provider, temperature, max tokens
3. Add / remove MCP server connections per agent (stored as JSONB)
4. Enable / disable agents

At runtime, agents load their definition from DB (fast single-row query). Changes take effect on the next request — no redeploy needed.

## Architecture

```
agent_definitions (Supabase table)
  id, slug, display_name, model, provider, system_prompt,
  temperature, max_tokens, enabled, mcp_servers jsonb, updated_at

Admin UI: /admin/agents
  → /admin/agents/[slug] (edit form)
  → Server action saves to agent_definitions

Runtime agents:
  lib/ai/agents/janet.ts — loads definition by slug 'janet' at request time
  lib/ai/agents/alex.ts  — loads definition by slug 'alex'
  
Pipelines (Atlas, Sage):
  lib/ai/pipelines/* — load by slug at invocation time
```

## MCP connector design

MCP servers are stored as JSONB on the agent definition:

```json
{
  "mcp_servers": [
    {
      "id": "uuid",
      "name": "Supabase MCP",
      "type": "sse",
      "url": "https://mcp.supabase.com/...",
      "enabled": true
    }
  ]
}
```

At runtime, if an agent has enabled MCP servers, `experimental_createMCPClient` from the AI SDK creates the clients and passes their tools to `streamText`. This scales naturally — new MCP servers are added in the UI, no code change.

## Database changes

New table: `agent_definitions` (migration 0019)
- Not patient data, not PII → `public` schema
- Primary writer: admin UI via server action
- RLS: admin-only write, service_role read for runtime agents

## New routes

| Route | Auth | Purpose |
|---|---|---|
| `GET /admin/agents` | Admin only | Agent list |
| `GET /admin/agents/[slug]` | Admin only | Agent detail + edit form |
| Server action `updateAgentDefinition` | Admin only | Save changes |
