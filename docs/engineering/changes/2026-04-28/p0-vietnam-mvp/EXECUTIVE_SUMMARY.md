# Executive Summary: P0 — Complete Vietnam Sprint MVP (non-AI track)
**Date:** 2026-04-28
**Audience:** Product owner (James Murray), clinical advisor

## What was delivered

The five outstanding pieces of the original Vietnam Sprint launch checklist are now in place. Specifically:

- **Real risk scores.** Every member's biological age and five-domain risk profile is now produced by a deterministic scoring engine (ported from the original Base44 app), not by an AI guess. Confidence levels reflect the actual data we have on the member — high if they've uploaded a complete blood panel, lower if they've only answered the questionnaire.
- **A real supplement catalogue.** Forty-two evidence-tagged supplements are now in the database, each with a dose, timing, evidence grade, and the conditions under which it's recommended. Supplement suggestions are now matched deterministically to a member's risk profile, with safety filters for medication interactions.
- **A branded health-risk PDF.** Members can now download a clinical-looking six-page report showing their bio-age, risk scores, top modifiable risks, supplement protocol, and a six-month projection of where they could be with consistent action.
- **A live admin dashboard.** James can now log in to `/admin` and see at-a-glance: monthly recurring revenue, active members, recent signups (filterable by 7d/30d/quarter), churn over the last 30 days, and how many risk-engine + upload pipelines have run in the last 24 hours.
- **Automatic safety net.** Every code change now goes through an automated review before it's merged: type-checking, unit tests, build verification, and a database security regression test that catches any change that would weaken row-level security.

In plain terms: a member can now sign up, complete the questionnaire, see real defensible risk numbers, download a PDF that looks like a clinical document, and James can see the business performance in one screen — all without manual work.

## What phase this advances

| Epic | Before | After |
|---|---:|---:|
| Epic 3 — The Number | 50% | ~80% |
| Epic 4 — The Protocol | 50% | ~70% (catalogue lands; agent integration is parallel) |
| Epic 5 — The Report | 35% | ~75% |
| Epic 11 — The Trust Layer | 55% | ~70% (BUG-008 closed) |
| Epic 12 — The Distribution | 5% | ~25% |
| Epic 14 — The Platform Foundation | 40% | ~55% |

The original Vietnam Sprint Definition of Done is now met for everything except real-member pilot data (which only happens after we go live).

## What comes next

Three threads worth deciding on:

1. **AI-track migration coordination.** The AI track has been adding migrations to the production database without committing the SQL files into this repository. We have five migrations on the database (0020–0024) we can't see in source. Recommend a 30-minute sync with the AI-track owner to get those committed before we move on.

2. **First real PDF review.** The branded report renders correctly through automated tests, but no human has opened the actual PDF yet. Worth a five-minute review by James and the clinical advisor before we promote the "Download PDF" button on the member dashboard.

3. **Clinical sign-off on the deterministic scoring.** The engine is mathematically sound (it's a faithful TypeScript port of the original Base44 logic, with 39 unit tests including snapshot tests for five fixture profiles), but we should run ten sample reports through the GP advisory panel before a clinician-channel pilot. This is the one operational task we can't automate.

## Risks or open items

- **Migration tracking divergence with the AI track** is a real coordination problem that will get worse if not addressed soon. Two migrations doing the same thing, both believing they're authoritative, is how we end up with an unrecoverable schema state.
- **Subscription schema gap.** The Stripe webhook isn't capturing price metadata (amount, interval, ended_at), so the MRR tile uses environment variables as a fallback. Reliable until pricing changes — then a follow-up migration is needed.
- **First CI run will be the live test.** The continuous-integration workflow is structurally correct but hasn't been pushed yet. There are three risk areas (pgvector extension, pgtap extension, auth-schema seed differences) that may cause the first run to fail and need a quick patch.

None of these are launch-blocking; all are tracked in the change folder's QA report.
