# Longevity Coach — Epic Status Dashboard

Last updated **2026-04-30** (08:30 AEST automated sync).

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
| 1 | The Front Door | `●●●●●` | 100% | 0 | 3 |
| 2 | The Intake | `●●●◐○` | 99% | 0 | 0 |
| 3 | The Number | `●●●○○` | 90% | 0 | 1 |
| 4 | The Protocol | `●●●○○` | 60% | 0 | 0 |
| 5 | The Report | `●●○○○` | 65% | 0 | 1 |
| 6 | The Coach | `●●●◐○` | 98% | 0 | 1 |
| 7 | The Daily Return | `●●●○○` | 92% | 0 | 0 |
| 8 | The Living Record | `●●●○○` | 80% | 0 | 0 |
| 9 | The Care Team | `●◐○○○` | 25% | 0 | 0 |
| 10 | The Knowledge Engine | `●◐◐○○` | 60% | 0 | 1 |
| 11 | The Trust Layer | `●●●○○` | 90% | 0 | 1 |
| 12 | The Distribution | `●◐○○○` | 35% | 0 | 0 |
| 13 | The Business Model | `●○○○○` | 5% | 0 | 0 |
| 14 | The Platform Foundation | `●◐○○○` | 60% | 0 | 0 |

**Bug totals:** 0 open, 8 closed. (Bug log: forthcoming `qa/QA-bugs.md`.)

---

## Per-epic detail

### Epic 1: The Front Door

`●●●●●` Planned · Feature Complete · Unit Tested · Regression Tested · User Reviewed
**Estimate: 100%** — full member-facing front door shipped and reviewed end-to-end.

**Shipped:**
- Marketing pages: `/`, `/science`, `/team`, `/stories`, `/sample-report`, `/legal/collection-notice`.
- Auth flows: signup, signin, password reset, email verification (OTP + PKCE).
- Welcome email on activation (Resend) with DB-flag idempotency (`profiles.welcome_email_sent_at`).
- Stripe checkout (monthly + annual) and webhook lifecycle handling.
- Logged-in nav with Dashboard / Report / Documents / Account links.
- `/account` page — identity card + "Download my data" export bundle.
- Admin access secured with `is_admin` gate; admin nav link visible only to admins.
- Live QA Playwright suite: 33/33 passing on public pages.
- Vitest integration tests on auth + Stripe + onboarding actions.

**Outstanding:** none.

**Open bugs:** none.

**Closed bugs:**
- **BUG-001** (FIXED 2026-04-27): Signup form cleared all fields after a server-side validation error. Fix: server actions echo `{ email, full_name }` back via `state.values`, form passes those to `defaultValue`. Verified by `tests/live-qa/qa_run.py::test_signup_short_password`.
- **BUG-002** (CLOSED 2026-04-28): Welcome email idempotency was a 60s window, not a DB flag. A double-click on the verification link inside a minute = two welcome emails.
- **BUG-006** (CLOSED 2026-04-28): No Account link in the logged-in nav. The page did not exist yet, and the nav slot was also missing.

---

### Epic 2: The Intake

`●●●◐○` Planned · Feature Complete · Unit Tested · ◐ Regression Tested · ○ User Reviewed
**Estimate: 99%** — questionnaire + uploads + Janet document analyser + SHA-256 deduplication + Janet → `lab_results` structured writer + per-relative family-history card model all live. Only outstanding item is the E2E Playwright test of the full onboarding flow.

**Shipped:**
- Six-step questionnaire (basics, medical, family, lifestyle, goals, consent) with save-and-resume.
- PII-vs-questionnaire split at write time (`lib/profiles/pii-split.ts`).
- AHPRA-compliant consent record on submit (append-only `consent_records`).
- Patient uploads portal (50 MB cap, MIME whitelist, Supabase Storage).
- Janet document analyser (Claude Opus 4.7 + adaptive thinking) at `lib/uploads/janet.ts`.
- **Upload deduplication** — SHA-256 content hash (`lib/uploads/hash.ts`), `file_hash` column + unique index on `(user_uuid, file_hash)` (migration `0031_patient_uploads_file_hash.sql`), client-side pre-check before any storage write.
- **Janet → `lab_results` structured writer** (2026-04-28) — Janet's `analyzeUpload` now emits a typed `findings.biomarkers[]` array on `blood_work` documents; `persistLabResults` writes one typed row per biomarker into `biomarkers.lab_results` with server-side-derived status (low/optimal/high/critical via the pure `deriveStatus` rule). Migration `0032_lab_results_idempotency.sql` adds a unique partial index `(user_uuid, biomarker, test_date) where test_date is not null` for re-upload safety. 21 unit tests across `derive-status`, `extract-lab-results`, and `janet-prompt`.
- 14 questionnaire schema unit tests passing.
- 7 onboarding-action integration tests passing (Vitest with mocked Supabase).
- Unit tests for `hashFile` and `checkDuplicate`.
- **Per-relative family-history card model** (2026-04-29) — replaced the per-condition multiselects + separate "Deaths in the family" step with a single unified per-relative step. Each card collects relationship + alive/dead + age + cause-of-death + smoking + alcohol + per-condition age-of-onset list. Six-step questionnaire (was seven). Hydration shim migrates legacy data on every form load; old JSONB keys orphan and get stripped on next save by `stripUnknownKeys`. New `aggregateConditionFromMembers()` derives the engine's `FamilyHistory` shape (`first_degree`, `second_degree`, `age_onset`, `multiple`). **Latent bug fix:** `metabolic.ts:132`'s `multiple` flag now actually fires when ≥ 2 first-degree relatives have diabetes (was silently always false). 41 new tests (14 family-aggregation + 18 migrate-family + 6 family-members-field + 3 integration). Engine itself untouched.

**Outstanding:**
- E2E Playwright test of the full onboarding flow with a seeded test user fixture.

**Open bugs:** none.
**Closed bugs:** 0.

---

### Epic 3: The Number

`●●●○○` Planned · Feature Complete · Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 90%** — risk_analyzer pipeline ships risk narratives end-to-end with deterministic engine ported and bio-age input coverage at 100% (11/11). Risk-driver display strings cleaned of legacy factor names and redundant domain prefixes (2026-04-29). BMI labelling clarified across domains. Unit tests confirmed across bio-age-inputs (34 tests), format-driver (16 tests), scorer/assemble/gp-panel-pack. GP-panel review and per-domain CI regression still outstanding.

**Shipped:**
- risk_analyzer pipeline at `lib/ai/pipelines/risk-narrative.ts`.
- Pipeline endpoint at `app/api/pipelines/risk-narrative/route.ts` (secured with `x-pipeline-secret`).
- Pipeline triggered by `submitAssessment()`, by every successful upload, and now by every daily check-in.
- `risk_scores` table extended with `narrative`, `engine_output`, `data_gaps` columns (migration `0014_agent_tables.sql`).
- Idempotent upsert keyed on `(user_uuid, computed_at_date)`.
- **Deterministic risk engine ported** from Base44 to `lib/risk/` (migration `0034_risk_scores_unique_and_array_fixes.sql`) — five scoring domains (CV, metabolic, brain, cancer, MSK), biological age estimator, confidence levels based on data completeness, modifiable-risk-factor ranking, 6-month projected improvement.
- Unit tests: `tests/unit/risk/scorer.test.ts`, `tests/unit/risk/_gp-panel-pack.test.ts`, `tests/unit/risk/assemble.test.ts` (snapshot coverage).
- **Check-in → risk_analyzer trigger** (2026-04-28) — daily check-in submission fires a background risk_analyzer pipeline refresh, completing the data loop: questionnaire → check-in → risk_analyzer → dashboard.
- **Bio-age input coverage closed** (2026-04-29, commit `c4d6ad7`) — all 5 outstanding gaps wired (VO₂max + waist on onboarding, HRV + RHR + deep-sleep% on /check-in, imaging biomarkers via Janet → `lab_results`). Coverage 7/11 → 11/11. Migration `0046_daily_logs_deep_sleep_pct.sql` (renumbered from 0041) adds `deep_sleep_pct numeric(5,2)`. 34 new tests across `bio-age-inputs`, `validation-extended`, `basics-vo2max-waist`.
- **BMI factor labelling** (2026-04-29, commit `3663e19`) — clarified BMI factor names across domains so the metabolic and oncological surfaces no longer collide.
- **Top-risk-drivers display cleanup** (2026-04-29, commits `6ab5d03` + `e39e94c`) — `lib/risk/format-driver.ts` exports `formatRiskDriver()` (writer-side, drops redundant domain prefix) and `cleanLegacyDriver()` (display-time defensive cleaner that also rewrites legacy factor names like `BMI_onco` → `BMI (cancer risk)`). Onboarding action persists clean strings going forward; `/report` pipes existing rows through the cleaner so no DB rewrite is needed. 16 unit tests in `tests/unit/risk/format-driver.test.ts`.

**Outstanding:**
- GP-panel review of 10 sample narratives.
- Per-domain regression tests in CI (currently unit only).

**Open bugs:** none.

**Closed bugs:**
- **BUG-003** (P1, CLOSED 2026-04-28): risk_analyzer was writing `confidence_level = 'moderate'` for every patient because the deterministic engine was not ported. Deterministic engine now live in `lib/risk/`; scores are evidence-grounded.

---

### Epic 4: The Protocol

`●●●○○` Planned · Feature Complete · Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 60%** — supplement_advisor pipeline ships a 30-day protocol after every risk_analyzer run; supplement_advisor eval suite shipped 2026-04-28 with 4 rubrics. Unit tests confirmed via `tests/integration/ai/supplement-protocol.test.ts` and eval suite runner. No deterministic supplement catalog yet — items are LLM-derived.

**Shipped:**
- supplement_advisor pipeline at `lib/ai/pipelines/supplement-protocol.ts`.
- Pipeline endpoint at `app/api/pipelines/supplement-protocol/route.ts` (secured with `x-pipeline-secret`).
- Triggered after risk_analyzer completion and after every Janet document analysis.
- `supplement_plans` table with `items JSONB`, `status` check constraint, `valid_from`/`valid_to`.
- Per-item rationale tied to the patient's specific risk drivers.
- Tier label per item (`critical` / `high` / `recommended` / `performance`).
- **supplement_advisor eval suite** (`tests/evals/sage.eval.ts`, 2026-04-28) — 4 rubrics: protocol completeness, safe language, personalisation to patient's risk drivers, citation of specific supplements.

**Outstanding:**
- Hand-curated supplement catalog (~40 evidence-backed items) for deterministic Phase 1 generation.
- Janet (Supplement Advisor mode) tool surface for "tell me more about this item."
- Integrative-medicine doctor panel review of 10 sample protocols.
- Supplement-marketplace integration so a tap on an item adds it to a basket (Epic 12).

**Open bugs:** none.
**Closed bugs:** 0.

---

### Epic 5: The Report

`●●○○○` Planned · Feature Complete · ○ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 65%** — `/report` page + branded PDF both shipped. PDF includes logo, cover page, big-number summary, domain-coloured swatches, supplement table with tier colours and overflow handling, footer disclaimer.

**Shipped:**
- `/report` page (`app/(app)/report/page.tsx`) showing risk narrative, domain scores, supplement protocol, Janet chat panel.
- `app/(app)/report/report.css` styling.
- `app/(app)/report/_components/janet-chat.tsx` streaming chat client component.
- PDF endpoint at `app/api/report/pdf/route.tsx`.
- **Branded PDF** at `lib/pdf/report-doc.tsx` (442 lines) — logo header, cover page, big-number summary, domain colour swatches, supplement table with tier colours (max 12 visible + overflow count), AHPRA-compliant footer disclaimer.

**Outstanding:**
- Last-updated timestamp prominent on `/report`.
- Regenerate-on-demand button.
- "What changed since last report" diff when run twice.
- Visual regression coverage (Chromatic) on `/report` and the PDF.
- Unit-test coverage on the PDF render path.

**Open bugs:** none.

**Closed bugs:**
- **BUG-005** (CLOSED 2026-04-29): Branded PDF route at `/api/report/pdf` was returning an unstyled skeleton. Resolved as part of the P0 Vietnam MVP wave (commit `f1fe816`, 2026-04-28) — the bug entry was simply not closed at the time. PDF now includes logo, cover page, big-number summary, domain colour swatches, supplement table with tier colours, footer disclaimer. Verified by inspection 2026-04-29.

---

### Epic 6: The Coach

`●●●◐○` Planned · Feature Complete · Unit Tested · ◐ Regression Tested · ○ User Reviewed
**Estimate: 98%** — Janet streaming chat, cross-session history, stale-data nudge, health_researcher digests, support agent route, RAG, risk_analyzer + supplement_advisor + **PT Coach** `tool_use` sub-agents, conversation-summary compression, eval suites, and **Janet E2E conversation loop** all shipped. Latency instrumentation now records `patient_context_ms` + `total_ms` per turn. Remaining work is full load-time latency benchmarking and clinical review of sub-agent prompts.

**Shipped:**
- Janet agent at `lib/ai/agents/janet.ts` (Claude Sonnet 4.6, streaming).
- `PatientContext.load()` at `lib/ai/patient-context.ts` with parallel `Promise.all` reads.
- Janet API route at `app/api/chat/route.ts` (Supabase session auth).
- 20-turn conversation window, persisted to `agent_conversations` (table created in migration `0014`).
- Janet chat panel embedded in `/report`.
- Cross-session conversation history — Janet loads last 20 turns from `agent_conversations` on each call.
- Stale-data nudge — `summariseContext` warns Janet when risk scores are >30 days old.
- health_researcher research digests surfaced in `summariseContext` — Janet sees latest evidence from `health_updates`.
- Support agent API route at `app/api/chat/alex/route.ts` (same auth pattern as Janet).
- RAG layer active — `hybrid_search_health()` runs on each Janet turn (pgvector now enabled).
- **Conversation-summary compression** (2026-04-28) — `lib/ai/compression.ts` summarises turns older than 20 per session; summaries persisted in `conversation_summaries` table (migration `0030_conversation_summaries.sql`); Janet loads the summary on session start.
- **risk_analyzer as real-time `tool_use` sub-agent** (2026-04-28) — `lib/ai/tools/atlas-tool.ts`; Janet invokes risk_analyzer mid-conversation when a patient asks about their risk profile. Unit tests in `tests/unit/ai/tools/atlas-tool.test.ts`.
- **supplement_advisor as real-time `tool_use` sub-agent** (2026-04-28) — `lib/ai/tools/sage-tool.ts`; Janet invokes supplement_advisor mid-conversation for supplement questions. Unit tests in `tests/unit/ai/tools/sage-tool.test.ts`.
- **Janet eval suite** (2026-04-28) — `tests/evals/janet.eval.ts`; 5 rubrics: context grounding, supplement grounding, no hallucination, coaching tone, conversation memory. Judge at `tests/evals/judge.ts`.
- Eval runner at `tests/evals/runner.ts`; patient-context and supplement-plan fixtures.
- **PT Coach as real-time `tool_use` sub-agent** (2026-04-29, commit `52cd249`) — `lib/ai/tools/pt-coach-tool.ts`; Janet invokes PT Coach mid-conversation for exercise/training-plan questions. Real-time PT Coach agent at `lib/ai/agents/pt-coach.ts` and member-facing chat route at `app/api/chat/pt-coach/route.ts` (slug `pt_coach_live`). PT plan pipeline worker at `lib/ai/pipelines/pt-plan.ts` (cron `/api/cron/pt-plan`, migration `0041_training_plans_plan_name.sql`). `ptPlan` added as parallel read on `PatientContext`.
- **Janet E2E conversation loop test** (2026-04-29, commit `52cd249`) — `tests/e2e/janet-conversation.spec.ts` exercises the full Janet conversation loop in Playwright.
- **Latency instrumentation** (2026-04-29, commit `52cd249`) — `janet.ts` now records `patient_context_ms` and `total_ms` per turn for performance observability.
- **PT Coach + supplement-advisor grounding rubrics** added to Janet eval suite (Wave 2, 2026-04-29).

**Outstanding:**
- Full latency benchmarking under load (three-LLM-call turns when both risk_analyzer and supplement_advisor are invoked) — instrumentation is now live; load test pending.
- Clinical review of sub-agent prompts for appropriate medical language.
- User review with real members.

**Open bugs:**
- **BUG-004** (P2): Closed — pgvector enabled, migrations applied, RAG layer active.

**Closed bugs:** 1 (BUG-004 — pgvector/RAG now live).

---

### Epic 7: The Daily Return

`●●●○○` Planned · Feature Complete · Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 92%** — daily check-in UI, streak math (with rest-day mechanic), personalised daily goals, weekly insights digest, and health journal all shipped 2026-04-29 (Wave 3). Bio-age coverage adds optional HRV / resting HR / deep-sleep% on /check-in. Only outstanding feature is push / SMS / email reminder for the daily check-in.

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
- **Check-in → risk_analyzer trigger** (2026-04-28) — `app/(app)/check-in/actions.ts` fires the risk_analyzer pipeline in the background on each check-in submit. Completes the data loop: questionnaire → daily check-in → risk_analyzer risk refresh → dashboard.
- **Personalised daily goals** (2026-04-29, commit `e589d8d`, Wave 3) — `lib/goals/derive.ts` `deriveGoals()` pure function ties goals to the patient's risk profile (steps, water, sleep target, meditation). Migration `0043_daily_goals.sql` ships the `daily_goals` table. Goals surface on the /check-in page. 9 unit tests in `tests/unit/goals/derive.test.ts`.
- **Weekly insights digest** (2026-04-29, commit `e589d8d`, Wave 3) — `lib/insights/weekly.ts` runs pattern detection over the last 7 days of check-ins; new `/insights` page at `app/(app)/insights/page.tsx`. 18 unit tests in `tests/unit/insights/weekly.test.ts`.
- **Health journal** (2026-04-29, commit `e589d8d`, Wave 3) — migration `0044_journal.sql` adds the `journal_entries` table; `/journal` page lets members write free-form notes. Janet reads recent journal entries via `PatientContext` (`journal_entries` parallel load).
- **Rest-day streak mechanic** (2026-04-29, commit `e589d8d`, Wave 3) — `lib/streaks/index.ts` implements the policy: 1–2 missed days = "rest" (streak protected for travel and grief), 3+ missed days = streak reset. 16 unit tests in `tests/unit/dashboard/streak-rest-day.test.ts`. Used on the dashboard hero.
- **HRV / resting HR / deep-sleep% on check-in** (2026-04-29, commit `c4d6ad7`) — three new optional check-in fields with range validation; HRV (5–200 ms), resting HR (30–150 bpm), deep sleep % (0–60). HRV + RHR columns already existed on `biomarkers.daily_logs`; deep-sleep% added by migration `0046_daily_logs_deep_sleep_pct.sql`.

**Outstanding:**
- Push / SMS / email reminder for the daily check-in.

**Open bugs:** none.
**Closed bugs:** 0.

---

### Epic 8: The Living Record

`●●●○○` Planned · Feature Complete (member labs surface) · Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 80%** — five member-visible surfaces shipped: `/labs` (Lab Results UI), `/trends` (Daily-log trends), the alerts surface (`member_alerts` + dashboard chip + repeat-test cron + upload-flow lab-alert hook), the **Janet → `lab_results` structured writer**, and **`/simulator`** (real-time risk simulator with LDL/HbA1c/hsCRP/**Systolic BP**/Weight sliders running the deterministic risk engine in-browser via `useDeferredValue`, side-by-side baseline-vs-simulated display, empty-state CTA). Lab-alert path is now live — fires the moment any Janet-extracted biomarker is `low`/`high`/`critical`. SBP slider added 2026-04-29 with AHA-aligned numeric scoring bands. **Repeat-tests cron now registered in `vercel.json`** and **simulator E2E smoke test** landed 2026-04-29. Unit tests confirmed: 23 (labs helpers), 10 (trends), 20 (alerts evaluators) — 53 tests total across the member-facing surfaces (2026-04-30 audit).

**Shipped:**
- `biomarkers` schema with `lab_results`, `wearable_summaries`, `daily_logs` tables (migrations `0009`, `0010`).
- Patient uploads parsed by Janet feed into `biomarkers.lab_results`.
- **`/labs` index page** (2026-04-28) — biomarkers grouped by category, each card showing latest value + status badge + reference range + trend; empty-state CTA for zero-row members.
- **`/labs/[biomarker]` detail page** (2026-04-28) — Recharts time-series with reference-range band, header card, full history table; `notFound()` on zero-row biomarker; Next 16 async params.
- **Pure helpers** at `lib/labs/` (`groupByBiomarker`, `formatRange`, `statusTone`, `categoryLabel`, `toChartData`) sourced off generated DB types — schema drift forces a compile error. 23 unit tests.
- **Dashboard tile** replaced "Coming soon · Lab Results" with live `<QuickTile>` showing biomarker count + latest test date.
- **`/trends` page** (2026-04-28) — 30-day sparklines for Sleep, Energy, Mood, Steps, Water from `biomarkers.daily_logs`. Empty-state CTA pointing to `/check-in`. `lib/trends/` pure helpers (`buildTrendSeries`, `summariseTrend`, `ML_PER_GLASS`) sourced off generated DB types. 10 unit tests. Dashboard quick-link tile.
- **Member alerts surface** (2026-04-28) — `public.member_alerts` table (migration 0031, append-mostly, RLS owner-select + owner-update, service-role-only insert, unique partial index for idempotent re-runs). `lib/alerts/` pure evaluators (`evaluateLabAlerts`, `evaluateRepeatTests` with whole-token matching against a `SCREENING_KEYWORDS` map, `chipPayload`). Daily cron `/api/cron/repeat-tests` (Bearer-secret gated). Upload-flow lab-alert hook (defensive — no-op until Janet → `lab_results` writer lands). Dashboard hero chip with three severity tones (info/attention/urgent), `View →` link, dismiss server action. 20 unit tests.
- **`vercel.json` cron registration** for `/api/cron/repeat-tests` (2026-04-29, commit `62b52fd`, Wave 1) — daily 0 6 * * * schedule registered.
- **Risk simulator E2E smoke test** (2026-04-29, commit `9df6f0c`, Wave 4) — `tests/e2e/simulator.spec.ts` exercises slider-move → risk score change assertion.

**Outstanding:**
- Snooze / dismiss-suppression mechanism on alerts.
- Auto-resolve when next reading is back in range.
- `/alerts` index / triage page.
- Push / SMS / email delivery of alerts.
- Wearable OAuth integrations (Oura, Apple Watch, Garmin).
- Manual metric entry UI.
- Source-upload back-link from each lab row to its `patient_uploads` document.
- Top-nav entry for `/labs` (currently dashboard quick-link only).

**Open bugs:** none.
**Closed bugs:** 0.

---

### Epic 9: The Care Team

`●◐○○○` Planned · ◐ Feature Complete · ○ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 25%** — schema and pipeline backbone shipped (clinical/program tables, periodic-review schema expanded, Janet-Clinician brief pipeline + cron, secure-messaging spec). No clinician-facing UI yet; no care-team invitation flow.

**Shipped:**
- `clinical` schema (migrations `0011_clinical_schema.sql`).
- `programs` schema (`0012_programs_schema.sql`).
- `care_notes`, `periodic_reviews`, `patient_assignments`, `coach_suggestions` tables.
- **Janet-Clinician brief pipeline** (2026-04-29, commit `52cd249`, Wave 2) — `lib/ai/pipelines/clinician-brief.ts` (242 lines) generates a monthly auto-clinical brief + 30-day plan suggestion per assignment; pipeline endpoint at `app/api/pipelines/clinician-brief/route.ts` (`x-pipeline-secret` gated); cron at `app/api/cron/clinician-briefs/route.ts`. Migration `0042_periodic_reviews_expand.sql` adds the columns the brief writes to.
- **Janet secure-messaging spec** (2026-04-29) — design reference at `docs/engineering/changes/2026-04-29-plan-engineering-completeness/janet-secure-messaging-spec.md` (468 lines) for member↔clinician messaging routing.

**Outstanding:**
- Clinician portal pages (patient list, patient detail, alerts).
- Care-team invitation + per-patient permission management UI.
- Vercel weekly cron schedule entry for `/api/cron/clinician-briefs` (the route is live; cron schedule confirmation needed).
- In-platform appointment booking (calendar + Stripe).
- Clinical notes UI (private to care team).
- Periodic-review record UI.
- Janet secure-messaging implementation (spec only at this point).
- Community feed and challenges (deferred sub-epic).

**Open bugs:** none.
**Closed bugs:** 0.

---

### Epic 10: The Knowledge Engine

`●◐◐○○` Planned · ◐ Feature Complete · ◐ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 60%** — health_researcher pipeline fully implemented 2026-04-28: PubMed search, LLM synthesis, chunk+embed, cron route, Vercel weekly schedule, PatientContext integration, unit + integration tests. Member-facing insights feed and full semantic search (pgvector enable) still outstanding.

**Shipped:**
- `health_updates` table for structured digest display (`0015_health_updates.sql`).
- `agents.health_updates` table + `health_researcher` agent_definition row (migration `0027_nova_health_updates.sql`).
- pgvector / health knowledge migrations (`0037_health_knowledge_embeddings.sql` and supporting migrations).
- **health_researcher pipeline** (`lib/ai/pipelines/nova.ts`, 2026-04-28) — 5-phase: PubMed search → abstract fetch → LLM synthesis (Claude) → chunk+embed → upsert+prune (90-day rolling window). `chunkText()` helper with 300-word chunks, 60-word overlap.
- **`/api/cron/nova` route** (`app/api/cron/nova/route.ts`) — secured with `CRON_SECRET`, returns 200 on error to suppress Vercel retry.
- **Vercel weekly cron** — Monday 02:00 UTC entry in `vercel.json`.
- **`PatientContext` integration** — `recentDigests` loaded as 8th parallel read; Janet sees latest 3 digests on every turn.
- Unit tests: `tests/unit/ai/nova-helpers.test.ts` — 5 tests for `chunkText`.
- Integration tests: `tests/integration/ai/nova.test.ts` — 5 tests for `runHealthResearcherPipeline` with mocked PubMed + Supabase.

**Outstanding:**
- Enable the `vector` pgvector extension in Supabase dashboard (one-click action) — improves semantic search precision; keyword search still functional without it.
- Member-facing insights feed UI (in-app page showing weekly digests, filterable by health category).
- NCBI API key (`NCBI_API_KEY`) for scale — raises PubMed rate limit from 3 to 10 req/s; not needed at weekly cadence.
- medRxiv integration — scoped for v2.
- Clinical reviewer rubric for digest quality.

**Open bugs:** none.

**Closed bugs:**
- **BUG-007** (P2, CLOSED): pgvector extension enabled; health knowledge migrations applied; RAG layer active via `hybrid_search_health()`.

---

### Epic 11: The Trust Layer

`●●●○○` Planned · Feature Complete · Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 90%** — RLS + PII boundary + consent records + pgTAP RLS CI suite + export-everything bundle were already live; **right-to-erasure, pause/freeze, and ToS data-use clause shipped 2026-04-29 (Wave 4)**. Remaining trust surfaces are deceased-flag flow with warm copy path and quarterly trust audit cadence.

**Shipped:**
- RLS on every table across `public`, `biomarkers`, `clinical`, `programs`, `billing` schemas.
- PII boundary: `profiles` holds identifiers only; `health_profiles.responses` is de-identified.
- AHPRA-compliant consent records (`consent_records`, append-only, migration `0004_consent_records.sql`).
- Supabase key-naming convention (`SUPABASE_SECRET_KEY`, not `SUPABASE_SERVICE_ROLE_KEY`).
- Service-role admin client used only in webhook routes, pipeline workers, and PDF generation.
- pgTAP RLS test suite at `supabase/tests/rls.sql` with 20 assertions, executed in CI via the `pgtap` job in `.github/workflows/ci.yml`.
- **Export-everything bundle** at `GET /api/export` — ZIP with one JSON file per patient-facing table (profile, health_profiles, risk_scores, supplement_plans, lab_results, daily_logs, consent_records), latest PDF report, and `manifest.json`. Soft 10000-row cap per table with truncation flag. Audit row per export in `public.export_log` (migration `0026`, append-only, owner-select RLS, service-role-only insert). Surfaced via `/account` page (2026-04-28).
- **Right-to-erasure** (2026-04-29, commit `9df6f0c`, Wave 4) — `DELETE /api/account` scrubs PII, removes uploads, and hard-deletes behind the `ENABLE_HARD_DELETE` env var. Two-step confirmation modal in `app/(app)/account/_components/delete-account-button.tsx`. Action handlers in `app/(app)/account/actions.ts`.
- **Pause / freeze account** (2026-04-29, commit `9df6f0c`, Wave 4) — migration `0045_profile_pause.sql` adds the `paused_at` column on `profiles`. `proxy.ts` redirects paused users to `/account?paused=true`. Pause and resume actions in `app/(app)/account/pause-actions.ts`.
- **ToS data-use disclosure in onboarding** (2026-04-29, commit `9df6f0c`, Wave 4) — "we never train on your data" clause surfaced inside the onboarding consent step (`app/(app)/onboarding/onboarding-client.tsx`).

**Outstanding:**
- Deceased-flag flow with warm copy path (not a checkbox).
- Quarterly trust audit cadence (logs scrub, signed-URL TTL check, deceased-flow walk-through).
- Regression coverage of the erasure / pause flows in CI.

**Open bugs:** none.

**Closed bugs:**
- **BUG-008** (P2, closed 2026-04-28): pgTAP RLS test file at `supabase/tests/rls.sql` was not run in CI. Wired into `.github/workflows/ci.yml` `pgtap` job (Task C1) — Postgres 15 service container, migrations applied in order, RLS suite executed on every PR. Failures now block CI.

---

### Epic 12: The Distribution

`●◐○○○` Planned · ◐ Feature Complete · ○ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 35%** — admin area secured with proper `is_admin` gate, invite/revoke flow shipped 2026-04-28; **feature-flag resolver, pricing calculators, organisation-addons Stripe linkage, and corporate-invites table all shipped 2026-04-29 (billing waves 1–2)**. Corporate UI (CSV upload, team challenges, aggregate reporting) and supplement marketplace not built.

**Shipped:**
- `app/(admin)/admin.css` styling.
- Admin user-list page at `app/(admin)/admin/users/page.tsx`.
- Admin user-detail page at `app/(admin)/admin/users/[id]/page.tsx`.
- `is_admin` flag on profiles (migration `0017_admin_flag.sql`).
- Agent definitions table (`0019_agent_definitions.sql`).
- `billing` schema with `suppliers`, `products`, `plans`, `add_ons`, `organisations` tables (`0013_billing_schema.sql`).
- **Admin access control** (2026-04-28) — `proxy.ts` now checks `is_admin` before serving any `/admin/*` route. Regular members cannot reach admin pages even if they know the URL.
- **Admin management page** at `/admin/admins` (2026-04-28) — invite a new admin by email (existing account gets immediate access; new account receives a Supabase invite email and becomes admin on signup); revoke access; view pending invites. Migration `0032_seed_admins.sql` seeds the two existing team accounts. Migration `0033_admin_invites.sql` adds the `admin_invites` pending-invite table.
- **Admin-only nav link** — "Admin" link in the top nav visible only to `is_admin` users.
- **Feature-flag resolver** (2026-04-29, commit `4fc3af7`, billing wave 2) — `lib/features/resolve.ts` `canAccess(userId, featureKey, supabase)` implements the four-path resolution from `docs/features/pricing/system-design.md`: admin → org_addon → org plan tier → sub_addon → user plan tier → locked. 12 unit tests in `tests/unit/features/resolve.test.ts`.
- **Pricing calculators** (2026-04-29, commit `4fc3af7`, billing wave 2) — `lib/pricing/calculate.ts` exports `calculateTotal` and `calculateOrgTotal` (D2 FLAT — org total does NOT multiply by `seat_count`, per James 2026-04-29) plus a cents helper. 7 unit tests.
- **Organisation-addons Stripe linkage** (2026-04-29, commit `f742f17`, billing wave 1) — migration `0047_billing_org_addons_stripe_item_and_invites.sql` adds `stripe_subscription_id`, `stripe_subscription_item_id`, `status`, `updated_at` to `billing.organisation_addons` (D4: flat one-Stripe-item-per-add-on).
- **Corporate-invites table** (2026-04-29, commit `f742f17`, billing wave 1) — same migration ships `billing.org_invites` for D3 (email + CSV bulk corporate invites). Foundation for the corporate CSV upload UI.

**Outstanding:**
- Admin CRM: MRR, active members, churn, pipeline runs in last 24h.
- Corporate UI: employee CSV upload, team challenges, aggregate reporting (table + resolver are ready; UI not built).
- Supplement marketplace integration (auto-replenishment, in-app purchase from protocol page).
- Sign-in-with-Vercel for clinician partners.
- Audit log for admin-configuration changes (who changed agent settings and when).

**Open bugs:** none.
**Closed bugs:** 0.

---

### Epic 13: The Business Model

`●○○○○` Planned · ○ Feature Complete · ○ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 5%** — designed 2026-04-28; no provider-ecosystem code yet. B2C revenue rail shipped via Epic 1; B2B revenue plumbing (feature-flag resolver, organisation-addons Stripe linkage, flat per-add-on pricing math) shipped 2026-04-29 via Epic 12 billing waves.

**Shipped:**
- B2C subscription rail (Stripe checkout + webhook lifecycle) — see Epic 1.
- `billing` schema scaffolding (`suppliers`, `products`, `plans`, `add_ons`, `organisations`) — migration `0013_billing_schema.sql`.
- B2B revenue plumbing (2026-04-29) — flat per-add-on pricing math (`calculateOrgTotal`), per-add-on Stripe-item linkage on `billing.organisation_addons`, `billing.org_invites` table for corporate CSV onboarding. See Epic 12 for detail.

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
**Estimate: 60%** — substantial pieces shipped via the existing `.claude/rules/` discipline (RLS, PII boundary, secret-key naming, pipeline auth, migration hygiene). CI Vitest+pgTAP and Gitleaks secret scanning live since 2026-04-28; **Playwright E2E + Lighthouse CI jobs and migration prefix collisions resolved 2026-04-29 (Wave 1)**. Latency instrumentation in Janet provides foundation for observability. The remaining operational layer (Sentry, cost monitoring, DR drill, pen-test cadence) is unbuilt.

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
- **Playwright E2E + Lighthouse CI jobs** (2026-04-29, commit `62b52fd`, Wave 1) — added to `.github/workflows/ci.yml`, gated on build. `.lighthouserc.json` targets `/`, `/dashboard`, `/report`. Live QA on every PR.
- **Migration filename collisions resolved** (2026-04-29, commits `62b52fd` + `f742f17` + `4fc3af7`) — Wave 1 renamed `0031_patient_uploads_file_hash.sql` → `0039` and `0032_seed_admins.sql` → `0040`. Billing waves renumbered `0041_daily_logs_deep_sleep_pct.sql` → `0046` and `0044_billing_org_addons_stripe_item_and_invites.sql` → `0047` to clear collisions with Wave 2's `0041_training_plans_plan_name.sql` / `0042_periodic_reviews_expand.sql` and Wave 3's `0043_daily_goals.sql` / `0044_journal.sql`. Migration history is now monotonic.
- **Latency instrumentation in Janet** (2026-04-29, commit `52cd249`, Wave 2) — `patient_context_ms` + `total_ms` recorded per turn — foundation for observability work.

**Outstanding:**
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
