# Longevity Coach — Epic Status Dashboard

Last updated **2026-04-28**.

Companion to [epics.md](./epics.md) (strategy, stable) and [product.md](./product.md) (vision). This file is the **at-a-glance status** of each epic: how far through the build pipeline, what's still outstanding, what's broken right now.

## Pipeline stages

Every epic moves through five stages. Each stage is a discrete "is it true?" gate, not a percentage. The progress bar shows which stages are passed.

| Stage | Means |
|---|---|
| **Planned** | Spec exists in [epics.md](./epics.md) with bundled features, mechanism, success criterion. |
| **Feature Complete** | Every bundled feature is shipped to production. |
| **Unit Tested** | Direct unit tests cover the core logic of the bundled features. |
| **Regression Tested** | Bundled features exercised end-to-end via an automated regression pass before each release. |
| **User Reviewed** | A real user (Dave + James in pilot, real members in beta) has used it long enough to surface real-world friction. |

Symbol key: `●` passed · `◐` partial · `○` not yet · `↻` regressed (was passed, broken now).

## Summary

| # | Epic | Pipeline | Estimate | Open bugs | Closed bugs |
|---|---|---|---:|---:|---:|
| 1 | The Front Door | `●●●◐◐` | 90% | 2 (P2, P3) | 1 |
| 2 | The Intake | `●●●◐○` | 85% | 0 | 0 |
| 3 | The Number | `●●○○○` | 50% | 1 (P1) | 0 |
| 4 | The Protocol | `●●○○○` | 50% | 0 | 0 |
| 5 | The Report | `●◐○○○` | 35% | 1 (P3) | 0 |
| 6 | The Coach | `●●○○○` | 60% | 1 (P2) | 0 |
| 7 | The Daily Return | `●◐○○○` | 25% | 0 | 0 |
| 8 | The Living Record | `●○○○○` | 5% | 0 | 0 |
| 9 | The Care Team | `●○○○○` | 5% | 0 | 0 |
| 10 | The Knowledge Engine | `●○○○○` | 5% | 1 (P2) | 0 |
| 11 | The Trust Layer | `●●◐○○` | 55% | 1 (P2) | 0 |
| 12 | The Distribution | `●○○○○` | 5% | 0 | 0 |

**Bug totals:** 7 open, 1 closed. (Bug log: forthcoming `qa/QA-bugs.md`. The single closed bug is BUG-001, signup form clearing — fixed 2026-04-27.)

---

## Per-epic detail

### Epic 1: The Front Door

`●●●◐◐` Planned · Feature Complete · Unit Tested · ◐ Regression Tested · ◐ User Reviewed
**Estimate: 90%** — feature-complete enough for early members; missing the `/account` self-service page and a single Account link in the nav.

**Shipped:**
- Marketing pages: `/`, `/science`, `/team`, `/stories`, `/sample-report`, `/legal/collection-notice`.
- Auth flows: signup, signin, password reset, email verification (OTP + PKCE).
- Welcome email on activation (Resend).
- Stripe checkout (monthly + annual) and webhook lifecycle handling.
- Logged-in nav with Dashboard / Report / Documents links.
- Live QA Playwright suite: 33/33 passing on public pages.
- Vitest integration tests on auth + Stripe + onboarding actions.

**Outstanding:**
- `/account` page — profile edit, address edit, subscription cancel, password change, export-everything button.
- Account link in the logged-in nav (currently no surface to reach `/account` even if it existed).
- Welcome-email idempotency upgrade (currently a 60s time window, should be a `profiles.welcome_email_sent_at` flag).

**Open bugs:**
- **BUG-002** (P2): Welcome email idempotency is a 60s window, not a DB flag. A double-click on the verification link inside a minute = two welcome emails.
- **BUG-006** (P3): No Account link in the logged-in nav. The page does not exist yet, but the nav slot is also missing.

**Closed bugs:**
- **BUG-001** (FIXED 2026-04-27): Signup form cleared all fields after a server-side validation error. Fix: server actions echo `{ email, full_name }` back via `state.values`, form passes those to `defaultValue`. Verified by `tests/live-qa/qa_run.py::test_signup_short_password`.

---

### Epic 2: The Intake

`●●●◐○` Planned · Feature Complete · Unit Tested · ◐ Regression Tested · ○ User Reviewed
**Estimate: 85%** — questionnaire + uploads + Janet document analyser all live; no real member has yet completed an intake with a real blood panel.

**Shipped:**
- Six-step questionnaire (basics, medical, family, lifestyle, goals, consent) with save-and-resume.
- PII-vs-questionnaire split at write time (`lib/profiles/pii-split.ts`).
- AHPRA-compliant consent record on submit (append-only `consent_records`).
- Patient uploads portal (50 MB cap, MIME whitelist, Supabase Storage).
- Janet document analyser (Claude Opus 4.7 + adaptive thinking) at `lib/uploads/janet.ts`.
- 14 questionnaire schema unit tests passing.
- 7 onboarding-action integration tests passing (Vitest with mocked Supabase).

**Outstanding:**
- A real member completing the intake with a real blood panel and uploading it (pilot prerequisite).
- Family-history sub-fields (age of onset, cancer types) — blocked on James.
- E2E Playwright test of the full onboarding flow with a seeded test user fixture.

**Open bugs:** none.
**Closed bugs:** 0.

---

### Epic 3: The Number

`●●○○○` Planned · Feature Complete · ○ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 50%** — Atlas pipeline shipped 2026-04-28 and writes risk + bio-age + narrative end-to-end, but the deterministic risk engine has not been ported. Every score is currently labelled `confidence_level = 'moderate'`.

**Shipped:**
- Atlas pipeline at `lib/ai/pipelines/risk-narrative.ts`.
- Pipeline endpoint at `app/api/pipelines/risk-narrative/route.ts` (secured with `x-pipeline-secret`).
- Pipeline triggered by `submitAssessment()` and by every successful upload.
- `risk_scores` table extended with `narrative`, `engine_output`, `data_gaps` columns (migration `0014_agent_tables.sql`).
- Idempotent upsert keyed on `(user_uuid, computed_at_date)`.

**Outstanding:**
- Port deterministic risk engine from Base44 (`base44/functions/riskEngine/entry.ts`, 1231 lines) to `lib/risk/`.
- Wire deterministic engine into `submitAssessment()` before the LLM pipeline.
- Atlas reads `engine_output` and writes narrative only (faster, higher confidence).
- Per-domain unit tests on the deterministic scoring functions.
- GP-panel review of 10 sample narratives.

**Open bugs:**
- **BUG-003** (P1): Atlas writes `confidence_level = 'moderate'` for every patient because the deterministic engine has not been ported. The narrative is honest but the score is not yet defensible to a clinician. Blocks the GP-panel review and any clinician-channel pilot.

**Closed bugs:** 0.

---

### Epic 4: The Protocol

`●●○○○` Planned · Feature Complete · ○ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 50%** — Sage pipeline shipped 2026-04-28; writes a 30-day protocol after every Atlas run. No deterministic catalog yet — items are LLM-derived.

**Shipped:**
- Sage pipeline at `lib/ai/pipelines/supplement-protocol.ts`.
- Pipeline endpoint at `app/api/pipelines/supplement-protocol/route.ts` (secured with `x-pipeline-secret`).
- Triggered after Atlas completion and after every Janet document analysis.
- `supplement_plans` table with `items JSONB`, `status` check constraint, `valid_from`/`valid_to`.
- Per-item rationale tied to the patient's specific risk drivers.
- Tier label per item (`critical` / `high` / `recommended` / `performance`).

**Outstanding:**
- Hand-curated supplement catalog (~40 evidence-backed items) for deterministic Phase 1 generation.
- Janet (Supplement Advisor mode) tool surface for "tell me more about this item."
- Integrative-medicine doctor panel review of 10 sample protocols.
- Sage eval suite (rationale specificity, item-to-driver linkage, no-overclaim).
- Supplement-marketplace integration so a tap on an item adds it to a basket (Epic 12).

**Open bugs:** none directly.
**Closed bugs:** 0.

---

### Epic 5: The Report

`●◐○○○` Planned · ◐ Feature Complete · ○ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 35%** — `/report` page shipped with all in-app surfaces; the branded PDF route exists but renders an unstyled skeleton.

**Shipped:**
- `/report` page (`app/(app)/report/page.tsx`) showing risk narrative, domain scores, supplement protocol, Janet chat panel.
- `app/(app)/report/report.css` styling.
- `app/(app)/report/_components/janet-chat.tsx` streaming chat client component.
- PDF endpoint scaffold at `app/api/report/pdf/route.tsx`.
- `lib/pdf/report-doc.tsx` skeleton.

**Outstanding:**
- Branded PDF: logo header, domain colour swatches, narrative typography, supplement table, footer disclaimer.
- Last-updated timestamp prominent on `/report`.
- Regenerate-on-demand button.
- "What changed since last report" diff when run twice.
- Visual regression coverage (Chromatic) on `/report` and the PDF.

**Open bugs:**
- **BUG-005** (P3): Branded PDF route at `/api/report/pdf` returns an unstyled skeleton — no logo, no domain colours, no supplement table. Members cannot share a credible PDF with their GP yet.

**Closed bugs:** 0.

---

### Epic 6: The Coach

`●●○○○` Planned · Feature Complete · ○ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 60%** — Janet streaming chat shipped end-to-end; sub-agents wired as background pipelines, not as real-time `tool_use` yet; RAG layer deferred (pgvector not enabled).

**Shipped:**
- Janet agent at `lib/ai/agents/janet.ts` (Claude Sonnet 4.6, streaming).
- `PatientContext.load()` at `lib/ai/patient-context.ts` with parallel `Promise.all` reads.
- Janet API route at `app/api/chat/route.ts` (Supabase session auth).
- 20-turn conversation window, persisted to `agent_conversations` (table created in migration `0014`).
- Janet chat panel embedded in `/report`.

**Outstanding:**
- Atlas + Sage as real-time `tool_use` sub-agents (currently they're background pipelines that write to DB; Janet reads the result).
- pgvector / RAG over `health_knowledge` (migration `0016` written, extension not enabled, Janet has no knowledge base).
- Stale-data nudge ("your risk scores are 30 days old — let me refresh that").
- Conversation-summary compression for older turns.
- Janet eval suite (turn-by-turn quality, hallucination rate, context utilisation).
- Alex support-agent persona switch.

**Open bugs:**
- **BUG-004** (P2): Janet has no knowledge base because the `vector` extension is not enabled in the Supabase project. She answers from `PatientContext` only. Migration `0016_knowledge_base_pgvector.sql` is written and ready to apply once the extension is enabled in the dashboard.

**Closed bugs:** 0.

---

### Epic 7: The Daily Return

`●◐○○○` Planned · ◐ Feature Complete · ○ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 25%** — drip-email cron + table shipped; check-in flow, habits, streaks, push reminders are all unbuilt.

**Shipped:**
- Drip-email cron at `app/api/cron/drip-emails/route.ts`.
- `lib/email/drip.ts` template wrapper.
- `drip_email_log` table (migration `0018_drip_tracking.sql`).
- `daily_logs` table in `biomarkers` schema (`0010_biomarkers_daily_logs.sql`).

**Outstanding:**
- Daily check-in UI (mood, sleep, energy, weight) — 90-second target.
- Personalised daily goals tied to risk profile.
- Habit streak math + Mon-Sun dot UI.
- Rest-day mechanic for travel and grief.
- Push / SMS / email reminder for the daily check-in.
- Weekly insights digest from check-in patterns.
- Health journal for free-form notes.

**Open bugs:** none.
**Closed bugs:** 0.

---

### Epic 8: The Living Record

`●○○○○` Planned · ○ Feature Complete · ○ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 5%** — schema shipped, no UI.

**Shipped:**
- `biomarkers` schema with `lab_results`, `wearable_summaries`, `daily_logs` tables (migrations `0009`, `0010`).
- Patient uploads parsed by Janet feed into `biomarkers.lab_results`.

**Outstanding:**
- Longitudinal biomarker charts per patient.
- Out-of-range alerts.
- Wearable OAuth integrations (Oura, Apple Watch, Garmin).
- Manual metric entry UI.
- Risk simulator ("if I lower my LDL to X, my CV risk drops to Y").
- Repeat-test reminders driven by Atlas's `recommended_screenings`.

**Open bugs:** none.
**Closed bugs:** 0.

---

### Epic 9: The Care Team

`●○○○○` Planned · ○ Feature Complete · ○ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 5%** — schema shipped (clinical and program tables), no UI, no clinician role assignment flow.

**Shipped:**
- `clinical` schema (migrations `0011_clinical_schema.sql`).
- `programs` schema (`0012_programs_schema.sql`).
- `care_notes`, `periodic_reviews`, `patient_assignments`, `coach_suggestions` tables.

**Outstanding:**
- Clinician portal pages.
- Care-team invitation + per-patient permission management.
- Janet-Clinician brief pipeline (monthly cron).
- In-platform appointment booking (calendar + Stripe).
- Clinical notes UI (private to care team).
- Periodic-review record UI.
- Community feed and challenges (deferred sub-epic).

**Open bugs:** none.
**Closed bugs:** 0.

---

### Epic 10: The Knowledge Engine

`●○○○○` Planned · ○ Feature Complete · ○ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 5%** — Nova designed, not built. Migration ready but blocked.

**Shipped:**
- `health_updates` table for the structured digest display (`0015_health_updates.sql`).
- pgvector migration `0016_knowledge_base_pgvector.sql` written.

**Outstanding:**
- Enable the `vector` extension in Supabase (dashboard action).
- Apply migration `0016`.
- Nova pipeline (`app/api/cron/nova/route.ts`).
- Six-category parallel literature scan (PubMed, Nature, Cell, medRxiv, Cochrane, plus one rotating).
- LLM synthesis per category, embed via OpenRouter `perplexity/pplx-embed-v1-4b`.
- Hybrid RAG `hybrid_search_health()` SQL function.
- In-app research feed page reading `health_updates`.

**Open bugs:**
- **BUG-007** (P2): pgvector migration `0016_knowledge_base_pgvector.sql` is written but blocked on enabling the `vector` extension in the Supabase dashboard. Until the extension is enabled, Janet has no knowledge base (also surfaces under Epic 6 as BUG-004).

**Closed bugs:** 0.

---

### Epic 11: The Trust Layer

`●●◐○○` Planned · Feature Complete · ◐ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 55%** — RLS + PII boundary + consent records shipped and verified at the schema level. The visible trust surfaces (export, deceased flow, ToS clause, pause/freeze) are not built. The pgTAP RLS suite is written but not yet executed in CI.

**Shipped:**
- RLS on every table across `public`, `biomarkers`, `clinical`, `programs`, `billing` schemas.
- PII boundary: `profiles` holds identifiers only; `health_profiles.responses` is de-identified.
- AHPRA-compliant consent records (`consent_records`, append-only, migration `0004_consent_records.sql`).
- Supabase key-naming convention (`SUPABASE_SECRET_KEY`, not `SUPABASE_SERVICE_ROLE_KEY`).
- Service-role admin client used only in webhook routes, pipeline workers, and PDF generation.
- pgTAP RLS test suite at `supabase/tests/rls.sql` with 20 assertions.

**Outstanding:**
- "We never train on your data" clause in ToS, surfaced in onboarding.
- Export-everything button (downloadable JSON + PDF bundle).
- Right-to-erasure flow (single-row scrub since PII is single-table).
- Pause / freeze account flow.
- Deceased-flag flow with warm copy path (not a checkbox).
- Run the pgTAP suite in CI on every PR.
- Quarterly trust audit cadence (logs scrub, signed-URL TTL check, deceased-flow walk-through).

**Open bugs:**
- **BUG-008** (P2): pgTAP RLS test file exists at `supabase/tests/rls.sql` with 20 owner/cross-user isolation assertions but is not run in CI. The recent RLS soft-delete bug pattern would not be caught automatically today.

**Closed bugs:** 0.

---

### Epic 12: The Distribution

`●○○○○` Planned · ○ Feature Complete · ○ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 5%** — admin pages stubbed, corporate and marketplace not built.

**Shipped:**
- `app/(admin)/admin.css` styling.
- Admin user-list page at `app/(admin)/admin/users/page.tsx`.
- Admin user-detail page at `app/(admin)/admin/users/[id]/page.tsx`.
- `is_admin` flag on profiles (migration `0017_admin_flag.sql`).
- Agent definitions table (`0019_agent_definitions.sql`).
- `billing` schema with `suppliers`, `products`, `plans`, `add_ons`, `organisations` tables (`0013_billing_schema.sql`).

**Outstanding:**
- Admin CRM: MRR, active members, churn, pipeline runs in last 24h.
- Corporate account management (employee CSV upload, invitations, team challenges, aggregate reporting).
- Supplement marketplace integration (auto-replenishment, in-app purchase from protocol page).
- Pricing tiers (individual / family / clinical / corporate) wired to entitlements.
- Sign-in-with-Vercel for clinician partners.

**Open bugs:** none.
**Closed bugs:** 0.

---

## How this file gets updated

After each ship that touches an epic:
1. Move the line from "Outstanding" to "Shipped" in the epic block.
2. Update the pipeline glyphs and the % estimate in the summary table.
3. If the ship closed a bug, mark it in the bug log and decrement "Open bugs" / increment "Closed bugs" here.

After each new bug logged:
1. Decide which epic it belongs to (a bug can sit under two if it's a true overlap, e.g. BUG-004 / BUG-007).
2. Add the bug ID + one-line summary + severity under the epic's "Open bugs" list.
3. Update the summary table counts.

When an epic moves a stage:
- **Feature Complete** the moment the last bundled feature ships.
- **Unit Tested** when there is a test file and a CI step that runs it.
- **Regression Tested** when there is an automated end-to-end pass that exercises the bundled features pre-release.
- **User Reviewed** after a real member (or pilot clinician for Epic 9) has used it for at least a week of real sessions and logged feedback.
