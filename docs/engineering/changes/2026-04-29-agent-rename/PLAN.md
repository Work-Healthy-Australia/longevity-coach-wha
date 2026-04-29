# Plan: Agent rename — human names to role-based identifiers
Date: 2026-04-29
Phase: Cross-cutting (applies to Phase 2, 3, 4)
Status: Implemented

## Objective
Rename all AI agent and pipeline identifiers from human persona names (Atlas, Sage, Nova, Alex) to role-based names (risk_analyzer, supplement_advisor, health_researcher, support) to establish a consistent, self-documenting naming convention across the codebase. Human-like names are reserved for patient-facing personas only: Janet, janet_clinician, and chef.

## Scope
In scope:
- DB slugs in agents.agent_definitions
- CHECK constraint on agent_conversations.agent
- File names in lib/ai/ (tools, agents, pipelines)
- API route paths in app/api/
- React component and CSS class names
- Chat store keys
- All TypeScript identifiers (function names, schema names, variable names)
- Test files
- Rules and architecture docs

Out of scope:
- Historical changelog files (docs/engineering/changes/ prior entries)
- Existing conversation rows in production DB (handled by migration back-fill)
- Janet, janet_clinician, chef — these keep human-like names by product decision

## Data model changes
- agents.agent_definitions: slug and display_name updated for 4 rows — no schema change, data-only update
- agent_conversations.agent: CHECK constraint updated from ('janet','pt_coach_live','alex') to ('janet','pt_coach_live','support') — existing rows back-filled

## Tasks
### Task 1 — DB migration
Files: supabase/migrations/0036_rename_agent_slugs.sql
Renames slugs, updates CHECK constraint, back-fills existing rows. Fully idempotent.

### Task 2 — lib/ai layer
Files: 8 files renamed/updated across tools/, agents/, pipelines/
Renames all TypeScript identifiers, slugs passed to createPipelineAgent/createStreamingAgent.

### Task 3 — App layer
Files: API routes, components, CSS, chat store, layout, dashboard copy
Renames API endpoints, component names, CSS classes, store keys.

### Task 4 — Tests
Files: 7 test files updated
Import paths and slug assertions updated to match new names.

### Task 5 — Docs and rules
Files: ai-agents.md, agent-system.md, epic-status.md, qa-plan.md, agent-manager proposal
All agent name references updated.
