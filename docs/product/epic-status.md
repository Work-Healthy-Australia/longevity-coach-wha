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
| 1 | The Front Door | `●●●●◐` | 95% | 0 | 3 |
| 2 | The Intake | `●●●◐○` | 85% | 0 | 0 |
| 3 | The Number | `●●○○○` | 50% | 1 (P1) | 0 |
| 4 | The Protocol | `●●○○○` | 50% | 0 | 0 |
| 5 | The Report | `●◐○○○` | 35% | 1 (P3) | 0 |
| 6 | The Coach | `●●○○○` | 60% | 1 (P2) | 0 |
| 7 | The Daily Return | `●●◐○○` | 65% | 0 | 0 |
| 8 | The Living Record | `●○○○○` | 5% | 0 | 0 |
| 9 | The Care Team | `●○○○○` | 5% | 0 | 0 |
| 10 | The Knowledge Engine | `●○○○○` | 10% | 1 (P2) | 0 |
| 11 | The Trust Layer | `●●◐○○` | 65% | 1 (P2) | 1 |
| 12 | The Distribution | `●○○○○` | 5% | 0 | 0 |
| 13 | The Business Model | `●○○○○` | 0% | 0 | 0 |
| 14 | The Platform Foundation | `●◐○○○` | 45% | 0 | 0 |

**Bug totals:** 5 open, 4 closed. (Bug log: forthcoming `qa/QA-bugs.md`.)

---

## Per-epic detail

### Epic 1: The Front Door

`●●●●◐` Planned · Feature Complete · Unit Tested · Regression Tested · ◐ User Reviewed
**Estimate: 95%** — full member-facing front door shipped end-to-end; only outstanding gate is sustained user review.

**Shipped:**
- Marketing pages: `/`, `/science`, `/team`, `/stories`, `/sample-report`, `/legal/collection-notice`.
- Auth flows: signup, signin, password reset, email verification (OTP + PKCE).
- Welcome email on activation (Resend) with DB-flag idempotency (`profiles.welcome_email_sent_at`).
- Stripe checkout (monthly + annual) and webhook lifecycle handling.
- Logged-in nav with Dashboard / Report / Documents / Account links.
- `/account` page — minimal cut shipped 2026-04-28 (identity card + "Download my data" button only). Full self-service surfaces (profile edit, address edit, subscription cancel, password change) deferred — see Epic 11 outstanding.
- Live QA Playwright suite: 33/33 passing on public pages.
- Vitest integration tests on auth + Stripe + onboarding actions.

**Outstanding:**
- Sustained user-review pass on `/account` flows with real members.

**Open bugs:** none.

**Closed bugs:**
- **BUG-001** (FIXED 2026-04-27): Signup form cleared all fields after a server-side validation error. Fix: server actions echo `{ email, full_name }` back via `state.values`, form passes those to `defaultValue`. Verified by `tests/live-qa/qa_run.py::test_signup_short_password`.
- **BUG-002** (CLOSED 2026-04-28): Welcome email idempotency was a 60s window, not a DB flag. A double-click on the verification link inside a minute = two welcome emails.
- **BUG-006** (CLOSED 2026-04-28): No Account link in the logged-in nav. The page did not exist yet, and the nav slot was also missing.

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

`●●◐○○` Planned · Feature Complete · ◐ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 65%** — daily check-in UI shipped 2026-04-28, streak math shipped (UTC-safe, 10 unit tests), Mon-Sun dot strip shipped 2026-04-28, steps + water capture shipped 2026-04-28, dashboard wired with today-strip + streak hero + supplement adherence + action picker; remaining work is reminders, weekly digest, and journal.

**Shipped:**
- Drip-email cron at `app/api/cron/drip-emails/route.ts`.
- `lib/email/drip.ts` template wrapper.
- `drip_email_log` table (migration `0018_drip_tracking.sql`).
- `daily_logs` table in `biomarkers` schema (`0010_biomarkers_daily_logs.sql`).
- `/check-in` daily form at `app/(app)/check-in/` — mood, energy, sleep, exercise, **steps, water**, notes; upserts one row per UTC day (2026-04-28).
- Streak math at `computeStreak()` in `app/(app)/dashboard/page.tsx` — UTC-consistent with the writer; locked in by 10 deterministic unit tests in `tests/unit/dashboard/streak.test.ts`.
- **Mon-Sun streak dot strip** in dashboard hero — `streakDots()` pure helper, 7 dots oldest→newest, today distinct, 6 unit tests in `tests/unit/dashboard/streak-dots.test.ts` (2026-04-28).
- **Steps + water capture in check-in** — `parseCheckInForm()` validates ranges (0–60000 steps, 0–20 glasses), 6 unit tests in `tests/unit/check-in/validation.test.ts`; dashboard Steps/Water tiles now populate from real data (2026-04-28).
- New dashboard surface: streak hero, today-strip (sleep/energy/steps/water with progress bars), single-action picker, three big numbers (bio age, top risk, supplement adherence), what's-new row, quick links, coming-soon shelf.
- Migration `0020_expose_schemas_to_postgrest.sql` + Supabase Cloud API config to expose `biomarkers` and `billing` schemas.

**Outstanding:**
- Personalised daily goals tied to risk profile (currently goals are static defaults like 8 hours sleep, 8000 steps).
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
**Estimate: 10%** — Nova pipeline PLAN.md approved 2026-04-28. DB migrations written; pipeline implementation is a stub; cron route not built.

**Shipped:**
- `health_updates` table for the structured digest display (`0015_health_updates.sql`).
- pgvector migrations written: `0016_knowledge_base_pgvector.sql`, `0024_health_knowledge_seed.sql`, `0026_health_knowledge_embeddings.sql`.
- `agents` schema created (`0025_agents_schema.sql`).
- `agents.health_updates` table + `nova` agent_definition row written in `0027_nova_health_updates.sql` (pending apply to remote).
- Nova pipeline PLAN.md approved — PubMed 6-category search, LLM synthesis, chunk+embed, 90-day prune fully specced.

**Outstanding:**
- Enable the `vector` extension in Supabase (dashboard action) — blocks `0016` apply.
- Apply migrations `0016` and `0027` to remote DB.
- Full Nova pipeline implementation (`lib/ai/pipelines/nova.ts` — currently a stub that throws).
- `app/api/cron/nova/route.ts` GET handler with `CRON_SECRET` auth.
- `vercel.json` weekly cron entry (`0 2 * * 1`).
- `lib/ai/patient-context.ts` — add 8th Promise.all item loading latest 3 `health_updates`.
- Nova unit tests (`chunkText`) and integration tests (mocked PubMed + Supabase).
- Hybrid RAG `hybrid_search_health()` SQL function.
- In-app research feed page reading `health_updates`.

**Open bugs:**
- **BUG-007** (P2): pgvector migration `0016_knowledge_base_pgvector.sql` is written but blocked on enabling the `vector` extension in the Supabase dashboard. Until the extension is enabled, Janet has no knowledge base (also surfaces under Epic 6 as BUG-004).

**Closed bugs:** 0.

---

### Epic 11: The Trust Layer

`●●◐○○` Planned · Feature Complete · ◐ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 65%** — RLS + PII boundary + consent records shipped and verified at the schema level, with the pgTAP RLS suite now running in CI on every PR; **export-everything bundle shipped 2026-04-28**. Remaining trust surfaces (deceased flow, ToS clause, pause/freeze, right-to-erasure) are not built.

**Shipped:**
- RLS on every table across `public`, `biomarkers`, `clinical`, `programs`, `billing` schemas.
- PII boundary: `profiles` holds identifiers only; `health_profiles.responses` is de-identified.
- AHPRA-compliant consent records (`consent_records`, append-only, migration `0004_consent_records.sql`).
- Supabase key-naming convention (`SUPABASE_SECRET_KEY`, not `SUPABASE_SERVICE_ROLE_KEY`).
- Service-role admin client used only in webhook routes, pipeline workers, and PDF generation.
- pgTAP RLS test suite at `supabase/tests/rls.sql` with 20 assertions, executed in CI via the `pgtap` job in `.github/workflows/ci.yml`.
- **Export-everything bundle** at `GET /api/export` — ZIP with one JSON file per patient-facing table (profile, health_profiles, risk_scores, supplement_plans, lab_results, daily_logs, consent_records), latest PDF report, and `manifest.json`. Soft 10000-row cap per table with truncation flag. Audit row per export in `public.export_log` (migration `0026`, append-only, owner-select RLS, service-role-only insert). Surfaced via `/account` page (2026-04-28).

**Outstanding:**
- "We never train on your data" clause in ToS, surfaced in onboarding.
- Right-to-erasure flow (single-row scrub since PII is single-table).
- Pause / freeze account flow.
- Deceased-flag flow with warm copy path (not a checkbox).
- Quarterly trust audit cadence (logs scrub, signed-URL TTL check, deceased-flow walk-through).

**Open bugs:** none.

**Closed bugs:**
- **BUG-008** (P2, closed 2026-04-28): pgTAP RLS test file at `supabase/tests/rls.sql` was not run in CI. Wired into `.github/workflows/ci.yml` `pgtap` job (Task C1) — Postgres 15 service container, migrations applied in order, RLS suite executed on every PR. Failures now block CI.

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

### Epic 13: The Business Model

`●○○○○` Planned · ○ Feature Complete · ○ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 0%** — designed 2026-04-28; no provider-ecosystem code yet. The B2C revenue stream is shipped via Epic 1 (Stripe checkout). The adjacent `billing` schema (`suppliers`, `products`, `plans`, `add_ons`, `organisations`) already exists from Epic 12 work.

**Shipped:**
- B2C subscription rail (Stripe checkout + webhook lifecycle) — see Epic 1.
- `billing` schema scaffolding (`suppliers`, `products`, `plans`, `add_ons`, `organisations`) — migration `0013_billing_schema.sql`.

**Outstanding:**
- `provider_partners` table — admin-managed; contract terms, margin %, region, status.
- `provider_offerings` table — one row per bookable thing; SKU, price, modality, evidence tag, recommended-when criteria.
- `provider_orders` table — patient transactions, FK to `provider_partners` and originating Janet suggestion.
- Admin pages under `app/(admin)/providers/` for onboarding, catalog editing, order monitoring.
- Janet `tool_use` for `search_offerings(category, region, evidence_tag)`.
- Stripe Connect integration for split payments to providers.
- Per-recommendation audit trail (Janet suggestion → offering surfaced → conversion → outcome).
- Provider-facing dashboard (Phase 6 — providers manage their own listings).
- Catalog evidence-discipline review process (no pay-to-play; every offering traceable to a risk driver).
- Patient-side disclosure copy ("we receive a referral fee").
- B2B corporate revenue stream (lives in Epic 12).
- B2B clinical revenue stream (lives in Epic 9 + Epic 12).

**Open bugs:** none.
**Closed bugs:** 0.

---

### Epic 14: The Platform Foundation

`●◐○○○` Planned · ◐ Feature Complete · ○ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 45%** — substantial pieces already shipped via the existing `.claude/rules/` discipline (RLS, PII boundary, secret-key naming, pipeline auth, migration hygiene). CI Vitest+pgTAP and Gitleaks secret scanning shipped 2026-04-28. The remaining operational layer (Sentry, cost monitoring, DR drill, pen-test cadence) is unbuilt.

**Shipped:**
- RLS on every table across `public`, `biomarkers`, `clinical`, `programs`, `billing` schemas.
- Supabase secret-key naming (`SUPABASE_SECRET_KEY`, not `SUPABASE_SERVICE_ROLE_KEY`).
- PII boundary enforced at write time (`lib/profiles/pii-split.ts`).
- Service-role admin client confined to webhook routes, pipeline workers, PDF generation.
- Pipeline routes secured with `x-pipeline-secret` header.
- 19 numbered idempotent migrations with `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`.
- Engineering rules canonical in `.claude/rules/` (data-management, security, nextjs-conventions, database, ai-agents).
- `.env` files git-ignored; never committed.
- TypeScript schema types regenerated after every migration (`lib/supabase/database.types.ts`).
- `proxy.ts` route guard (no ad-hoc auth in pages).
- Supabase Storage MIME whitelist + 50 MB cap on uploads.
- Encryption at rest (Supabase default) + TLS in transit.
- **Gitleaks secret-scan workflow** at `.github/workflows/secrets.yml` — runs on every PR and every push to `main`; fails the check on a hit. Default ruleset extended via `.gitleaks.toml` (2026-04-28).

**Outstanding:**
- CI workflow file extension — Playwright + Lighthouse on every PR (Vitest + pgTAP already running).
- Sentry / Highlight / equivalent error monitoring + alert routing.
- Anthropic API spend dashboard + 80%-of-budget alert.
- Supabase storage quota alert.
- Vercel function execution-time monitoring.
- Supabase point-in-time restore drill executed and runbook in `docs/operations/dr-runbook.md`.
- Quarterly penetration test cadence on a staging mirror.
- Monthly dependency CVE scan (dependabot + `pnpm audit`).
- Weekly log scrub for PII regressions.
- Production-readiness checklist (`docs/operations/checklist.md`) and enforcement in PR template.
- AHPRA breach-notification protocol document.
- Data residency confirmation per region.
- Architecture-level enforcement of "we never train on patient data" (no training endpoints, no model fine-tune jobs, no third-party data shares).

**Open bugs:** none directly.
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
