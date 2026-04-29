# Executive Summary: Sprint 2 Engineering Completeness
Date: 2026-04-29
Audience: Product owner, clinical advisor

## What was delivered

Members can now download a branded PDF health report directly from the report page. Janet — the AI health coach — can now answer questions about exercise using the patient's personalised monthly workout plan, and can call on a specialist exercise coach when needed. A clinician brief is generated automatically each month, giving any connected clinician a concise, evidence-based summary of how each patient is progressing. The daily check-in page now shows personalised step, sleep, and water targets derived from the patient's risk profile. Members can write private journal notes that Janet reads as context. The streak tracker on the dashboard now allows one or two rest days without breaking the streak. Members can delete their account from the account page, pause access temporarily, and the onboarding consent step now explicitly states that health data is never used to train AI models. A risk simulator lets members explore how changing a single biomarker (e.g. LDL cholesterol) would shift their domain risk scores.

## What phase this advances

- **Phase 2 — Intelligence:** PT plan pipeline (Epic 4), clinician brief pipeline (Epic 9), personalised goals (Epic 7), weekly insights (Epic 7)
- **Phase 3 — Engagement:** Health journal (Epic 8), daily return streak improvements (Epic 7), Janet exercise tool (Epic 6)
- **Trust layer:** Right-to-erasure, pause/freeze, ToS disclosure (Epic 11)

## What comes next

The next logical step is applying all seven database migrations to the production Supabase instance (`supabase db push`) and verifying the PT plan and clinician brief crons fire correctly on their first scheduled run. After that, the open items from Phase 2 are the knowledge base population (Epic 10 — `health_researcher` pipeline worker) and the clinician portal UI for reviewing briefs (Epic 9).

## Risks or open items

- **Migrations not yet applied to production:** All seven new migration files exist in the codebase but have not been pushed to the production database. Until they are applied, the PT plan pipeline, journal, pause/unfreeze, and goals features will fail at runtime. Priority: apply before enabling the new crons.
- **`ENABLE_HARD_DELETE` env var:** Account deletion scrubs PII but does not remove the auth record unless this env var is set to `true` in the Vercel dashboard. James to decide whether to enable this in production.
- **TypeScript types:** `database.types.ts` uses `as any` casts for the new tables until `supabase gen types typescript --local` is run post-migration. No runtime impact, but affects autocomplete and future type safety.
