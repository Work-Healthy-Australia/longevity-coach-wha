# Executive Summary: Agent Blueprint — Shared Factory Layer
Date: 2026-04-28
Audience: Product owner, clinical advisor

## What was delivered

The platform's AI assistant layer has been restructured so that every AI agent — Janet the health coach, Alex the support assistant, and the behind-the-scenes engines that calculate risk scores and supplement protocols — now follows a single, consistent pattern for how they start up and connect to the AI service. Previously each agent had its own copy of the same startup code; now they all share one common foundation.

This change does not alter anything visible to members. Janet still answers health questions, Alex still helps with navigation, and the risk and supplement pipelines still produce the same results. What has changed is internal plumbing: the team now has one place to update how all AI agents behave, one place to add features like rate-limiting or monitoring, and a clear blueprint that the next batch of agents (the meal planner, the fitness coach) can follow without any guesswork.

## What phase this advances

- **Phase 2 — Intelligence:** The Atlas (risk assessment) and Sage (supplement protocol) AI workers now use the shared foundation.
- **Phase 3 — Engagement:** Janet and Alex now use the same shared foundation.

No new user-facing functionality was added; this is an infrastructure improvement that reduces the cost and risk of adding future agents.

## What comes next

The next logical steps on the roadmap are the daily check-in feature (Epic 3.1) and daily habit goals (Epic 3.2). The agent foundation built today means a future meal planning agent (Marco) and fitness coach (PT Coach) can be added with significantly less engineering effort.

One decision still needed from the product team: should the team enable the pgvector database extension in the Supabase dashboard? This is a single click that would activate Janet's ability to draw on a curated library of health research when answering questions — making her responses more evidence-based. No code changes are required; it has been ready since the last sprint.

## Risks or open items

- **No new risks introduced.** This is a refactor of internal code with no changes to data handling, security boundaries, or member-facing features. All 132 automated tests pass.
- **pgvector remains inactive** until a team member enables the extension in the Supabase dashboard (see above).
