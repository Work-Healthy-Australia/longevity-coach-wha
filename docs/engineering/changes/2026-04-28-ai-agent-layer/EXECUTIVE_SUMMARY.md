# Executive Summary: AI Agent Layer & AI SDK v6 Migration
Date: 2026-04-28
Audience: Product owner, clinical advisor

## What was delivered

Members can now have a live conversation with Janet, their AI health coach, directly on the report page. Janet understands the member's risk scores, biological age, supplement protocol, and uploaded pathology findings — and gives personalised, contextual answers in real time. Every signed-in page now has Alex, a floating support assistant in the bottom-right corner, who can answer questions about how the platform works and guide members who are confused or stuck.

On the admin side, staff can now navigate to the Agents section and edit any AI agent's instructions, change the AI model it uses, and adjust its behaviour settings — all without any code changes or redeployment. This means the team can iterate on how Janet speaks, how Alex responds, and how the risk and supplement analysis agents frame their output, all from a simple admin form.

The platform also now uses a more modern and efficient way of communicating with Anthropic's Claude API, which improves reliability, reduces errors, and makes it easier to add new AI capabilities in future phases.

## What phase this advances

- **Phase 2 — Intelligence:** The Atlas (risk assessment) and Sage (supplement protocol) AI workers are now production-ready and load their instructions from the database. Any future prompt refinements can be made through the admin UI.
- **Phase 3 — Engagement:** Janet (Epic 3.3.1, 3.3.5) and Alex (support agent) are live. Members can chat with their health coach and get support on any page.

## What comes next

The immediate next step is enabling the vector database extension in Supabase (a one-click action in the dashboard) which will allow Janet to draw on a library of health research knowledge when answering questions — making her responses significantly more accurate and evidence-based. This requires no code changes.

Beyond that, Phase 3 work continues: daily check-in tracking, habit goals, and the meal planning feature are next in line per the roadmap.

## Risks or open items

- **pgvector not yet live:** Janet's knowledge retrieval feature is built and ready but will not activate until a team member enables the `vector` extension in the Supabase dashboard. This is a ~30-second action with no risk.
- **Admin prompt editing is live immediately:** Any admin can change an agent's system prompt and it will take effect within 60 seconds on production. There is no review or approval gate on prompt changes. Consider whether this needs a change-control process before external users are onboarded at scale.
- **MCP server connections:** The admin UI allows connecting external tool servers (MCP) to agents, but the runtime wiring is not yet active. Adding servers via the UI is safe — they will have no effect until the runtime connection is switched on in a future release.
