# Changelog: Agent rename — human names to role-based identifiers
Date: 2026-04-29
Phase: Cross-cutting

## What was built
Consistent role-based naming for all AI agents and pipelines that do not carry a patient-facing human persona.

## What changed
- supabase/migrations/0036_rename_agent_slugs.sql — renames 4 slugs in agents.agent_definitions, updates CHECK constraint on agent_conversations.agent, back-fills existing rows
- lib/ai/tools/risk-analyzer-tool.ts (was atlas-tool.ts) — RiskAnalyzerOutputSchema, buildRiskAnalyzerPrompt, riskAnalyzerTool, slug 'risk_analyzer'
- lib/ai/tools/supplement-advisor-tool.ts (was sage-tool.ts) — SupplementAdvisorOutputSchema, buildSupplementAdvisorPrompt, supplementAdvisorTool, slug 'supplement_advisor'
- lib/ai/agents/support.ts (was alex.ts) — streamSupportTurn, slug 'support'
- lib/ai/pipelines/health-researcher.ts (was nova.ts) — runHealthResearcherPipeline, slug 'health_researcher'
- lib/ai/agents/janet.ts — updated imports and tool map keys (risk_analyzer_summary, supplement_advisor_summary)
- lib/ai/patient-context.ts — comment updated
- lib/ai/pipelines/risk-narrative.ts — slug 'risk_analyzer', log prefix updated
- lib/ai/pipelines/supplement-protocol.ts — slug 'supplement_advisor', log prefix updated
- app/api/chat/support/route.ts (was chat/alex/) — imports streamSupportTurn
- app/api/cron/health-researcher/route.ts (was cron/nova/) — imports runHealthResearcherPipeline
- app/(app)/_components/support-fab.tsx (was alex-fab.tsx) — SupportFAB, /api/chat/support, CSS classes updated, persona greeting neutralised
- app/(app)/_components/support-fab.css (was alex-fab.css) — all .alex-* → .support-*
- lib/stores/chat-store.ts — support/toggleSupport/closeSupport keys
- app/(app)/layout.tsx — SupportFAB import and usage
- app/(app)/dashboard/page.tsx — removed "Sage" from user-visible notification copy
- tests/integration/ai/chat-route.test.ts — import and mock paths updated
- tests/integration/ai/nova.test.ts — import and function refs updated
- tests/integration/ai/risk-narrative.test.ts — slug assertion updated
- tests/integration/ai/supplement-protocol.test.ts — slug assertion updated
- tests/unit/ai/nova-helpers.test.ts — import path updated
- tests/unit/ai/tools/risk-analyzer-tool.test.ts (was atlas-tool.test.ts)
- tests/unit/ai/tools/supplement-advisor-tool.test.ts (was sage-tool.test.ts)
- .claude/rules/ai-agents.md — build-order table, sub-agent section, RAG section
- docs/architecture/agent-system.md — 18 targeted replacements
- docs/product/epic-status.md — agent name references updated
- docs/qa/qa-plan.md — latency targets, test descriptions
- docs/features/agent-manager/feature-proposal.md — agent list and file paths
- docs/project-status.html — agent name references updated
- app/(app)/onboarding/actions.ts — inline comments updated

## Migrations applied
- 0036_rename_agent_slugs.sql — renames agent slugs from human names to role-based identifiers, fixes CHECK constraint, back-fills existing conversation rows

## Deviations from plan
None — all tasks executed as specified.

## Known gaps / deferred items
- Authenticated E2E (Playwright) not run in worktree — requires full env vars; verify on staging after merge
- Historical docs/engineering/changes/ entries intentionally not retroactively edited
