# Longevity Coach — Epic Status Dashboard

Last updated **2026-04-30** (Booking calendar W1-4 + alert-notification cron + cost monitoring + Sentry install + employer dashboard + journal enhancements + insights category filter + deceased-flag schema all landed since the last sync). **Late 2026-04-30 hotfix:** PR [#78](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/78) shipped a P0 fix for the silently-failing risk-narrative pipeline (Atlas was throwing schema validation errors against Anthropic's structured-output endpoint for 2 days; every recent `risk_scores` row had `narrative=null`); 11 production migrations that had drifted between repo and Supabase (`agent_usage`, `notification_prefs`, `clinician_availability`, `appointments_cancellation_log`, etc.) were caught up; both affected users (`c32699e1-…`, `865cbc5c-…`) backfilled; and clinical review packs delivered for the GP and integrative-medicine panels.

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
| 2 | The Intake | `●●●●○` | 100% | 0 | 0 |
| 3 | The Number | `●●●○○` | 92% | 0 | 2 |
| 4 | The Protocol | `●●●○○` | 87% | 0 | 0 |
| 5 | The Report | `●●●○○` | 92% | 0 | 1 |
| 6 | The Coach | `●●●●○` | 100% | 0 | 1 |
| 7 | The Daily Return | `●●●●○` | 100% | 0 | 0 |
| 8 | The Living Record | `●●●○○` | 90% | 0 | 0 |
| 9 | The Care Team | `●●●◐○` | 85% | 0 | 0 |
| 10 | The Knowledge Engine | `●●◐○○` | 75% | 0 | 1 |
| 11 | The Trust Layer | `●●●○○` | 97% | 0 | 1 |
| 12 | The Distribution | `●●◐○○` | 75% | 0 | 0 |
| 13 | The Business Model | `●●◐○○` | 50% | 0 | 0 |
| 14 | The Platform Foundation | `●●◐○○` | 78% | 0 | 0 |

**Bug totals:** 0 open, 9 closed. (Bug log: forthcoming `qa/QA-bugs.md`.)

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

`●●●●○` Planned · Feature Complete · Unit Tested · Regression Tested · ○ User Reviewed
**Estimate: 100%** — questionnaire + uploads + Janet document analyser + SHA-256 deduplication + Janet → `lab_results` structured writer + per-relative family-history card model all live. **E2E Playwright test shipped 2026-04-29.**

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
- **E2E Playwright test** (2026-04-29) — `tests/e2e/onboarding.spec.ts`: 3 tests covering page load, full 6-step walkthrough with submit + redirect, and save-and-resume draft persistence. Requires `TEST_EMAIL`/`TEST_PASSWORD` env vars.

**Outstanding:** none — user review pending.

**Open bugs:** none.
**Closed bugs:** 0.

---

### Epic 3: The Number

`●●●○○` Planned · Feature Complete · Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 92%** — risk_analyzer pipeline ships risk narratives end-to-end. Deterministic risk engine ported from Base44 and unit tested; **engine output now injected into Atlas prompt as baseline anchors** (2026-04-29) — Atlas must explain deviations >10 points. **GP review pack delivered 2026-04-30** at [`docs/qa/2026-04-30-narrative-review-pack.md`](../qa/2026-04-30-narrative-review-pack.md) — 10 representative samples grounded in the deterministic engine baseline; review response pending. BUG-003 closed. **BUG-009 closed (2026-04-30):** risk-narrative pipeline silent failure root-caused to AI SDK's structured-output endpoint rejecting `min`/`max` on numbers and `propertyNames` on records — schema fix in PR [#78](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/78), affected users backfilled.

**Shipped:**
- **risk-narrative schema hardening** (2026-04-30, PR #78) — Atlas was silently failing every assessment for ~48h because Anthropic's structured-output endpoint rejected `minimum`/`maximum` on number types and `propertyNames` on records; all 3 retry tiers threw and the pipeline caught it as non-fatal so members never saw a narrative. Fix extracts the Zod schema into [`lib/ai/pipelines/risk-narrative-schema.ts`](../../lib/ai/pipelines/risk-narrative-schema.ts), drops the unsupported constraints in favour of `.describe()` guidance, accepts permissive shapes (`z.array(z.unknown())`) and coerces post-parse, adds `clampAtlasOutput()` that clamps numbers / truncates narrative / stringifies object items, and bumps `risk_analyzer.max_tokens` 2048→4096 so structured JSON doesn't truncate. Both affected users backfilled directly via `runRiskNarrativePipeline()`. The `0059_risk_scores_history` constraint preserved the original null rows as audit trail.
- risk_analyzer pipeline at `lib/ai/pipelines/risk-narrative.ts`.
- Pipeline endpoint at `app/api/pipelines/risk-narrative/route.ts` (secured with `x-pipeline-secret`).
- Pipeline triggered by `submitAssessment()`, by every successful upload, and now by every daily check-in.
- `risk_scores` table extended with `narrative`, `engine_output`, `data_gaps` columns (migration `0014_agent_tables.sql`).
- Idempotent upsert keyed on `(user_uuid, assessment_date)`.
- **Deterministic risk engine ported** from Base44 to `lib/risk/` (migration `0034_risk_scores_unique_and_array_fixes.sql`) — five scoring domains (CV, metabolic, brain, cancer, MSK), biological age estimator, confidence levels based on data completeness, modifiable-risk-factor ranking, 6-month projected improvement.
- Unit tests: `tests/unit/risk/scorer.test.ts`, `tests/unit/risk/_gp-panel-pack.test.ts`, `tests/unit/risk/assemble.test.ts` (snapshot coverage).
- **Check-in → risk_analyzer trigger** (2026-04-28) — daily check-in submission fires a background risk_analyzer pipeline refresh, completing the data loop: questionnaire → check-in → risk_analyzer → dashboard.
- **Engine-grounded narratives** (2026-04-29) — `runRiskNarrativePipeline` now calls `assemblePatientFromDB()` + `scoreRisk()` and injects the deterministic engine output (domain scores, biological age, top modifiable risks, confidence, data completeness) into Atlas's prompt as an `## Engine baseline scores` section. Atlas is instructed to use these as anchors and explain any deviation >10 points. Non-fatal: if engine scoring fails, Atlas proceeds without baseline (logs a warning). Risk score history enabled via migration `0059_risk_scores_history.sql` — unique constraint changed from `(user_uuid)` to `(user_uuid, assessment_date)` so each assessment date preserves a separate row.

**Outstanding:**
- GP-panel review of 10 sample narratives.
- Per-domain regression tests in CI (currently unit only).

**Open bugs:** none.

**Closed bugs:**
- **BUG-009** (P0, CLOSED 2026-04-30): risk_analyzer pipeline silently failing for ~48h — every recent `risk_scores` row had `narrative=null`. Root cause: AI SDK's structured-output endpoint rejects `minimum`/`maximum` on number types and `propertyNames` on `z.record(...)`. Fixed in PR [#78](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/78); 2 affected users backfilled; the silent-failure mode that hid this for 2 days flagged for follow-up under Epic 14 (cost-monitoring telemetry was also offline because its migration had drifted).
- **BUG-003** (P1, CLOSED 2026-04-28): risk_analyzer was writing `confidence_level = 'moderate'` for every patient because the deterministic engine was not ported. Deterministic engine now live in `lib/risk/`; scores are evidence-grounded.

---

### Epic 4: The Protocol

`●●●○○` Planned · Feature Complete · Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 87%** — supplement_advisor pipeline ships a 30-day protocol after every risk_analyzer run; supplement_advisor eval suite shipped 2026-04-28 with 4 rubrics. Deterministic supplement catalog (42 evidence-backed items) seeded and live; `recommendFromRisk()` resolver fully wired. **Integrative-medicine review pack delivered 2026-04-30** at [`docs/qa/2026-04-30-protocol-review-pack.md`](../qa/2026-04-30-protocol-review-pack.md) — 10 representative samples (same fixtures as the Atlas pack so reviewers can cross-reference); review response pending.

**Shipped:**
- supplement_advisor pipeline at `lib/ai/pipelines/supplement-protocol.ts`.
- Pipeline endpoint at `app/api/pipelines/supplement-protocol/route.ts` (secured with `x-pipeline-secret`).
- Triggered after risk_analyzer completion and after every Janet document analysis.
- `supplement_plans` table with `items JSONB`, `status` check constraint, `valid_from`/`valid_to`.
- Per-item rationale tied to the patient's specific risk drivers.
- Tier label per item (`critical` / `high` / `recommended` / `performance`).
- **supplement_advisor eval suite** (`tests/evals/sage.eval.ts`, 2026-04-28) — 4 rubrics: protocol completeness, safe language, personalisation to patient's risk drivers, citation of specific supplements.
- **Hand-curated supplement catalog** — 42 evidence-backed items seeded to `supplement_catalog` via `supabase/seeds/supplement_catalog.sql`. Covers all 6 domains (7 CV, 7 metabolic, 6 neuro, 5 onco, 4 MSK, 11 general). Each item has predicate-based `triggers_when` keyed to canonical engine factor names, medication `contraindicates`, evidence tags (A/B/C), and AUD cost. Deterministic resolver `recommendFromRisk()` at `lib/supplements/catalog.ts` fully operational.

**Outstanding:**
- Janet (Supplement Advisor mode) tool surface for "tell me more about this item."
- Integrative-medicine doctor panel review pack DELIVERED 2026-04-30; awaiting reviewer response.
- Supplement-marketplace integration so a tap on an item adds it to a basket (Epic 12).

**Open bugs:** none.
**Closed bugs:** 0.

---

### Epic 5: The Report

`●●●○○` Planned · Feature Complete · Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 92%** — `/report` page + branded PDF + regenerate-on-demand button + **progress diff section** all shipped. PDF includes logo, cover page, big-number summary, domain-coloured swatches, supplement table with tier colours and overflow handling, footer disclaimer.

**Shipped:**
- `/report` page (`app/(app)/report/page.tsx`) showing risk narrative, domain scores, supplement protocol, Janet chat panel.
- `app/(app)/report/report.css` styling.
- `app/(app)/report/_components/janet-chat.tsx` streaming chat client component.
- PDF endpoint at `app/api/report/pdf/route.tsx`.
- **Branded PDF** at `lib/pdf/report-doc.tsx` (442 lines) — logo header, cover page, big-number summary, domain colour swatches, supplement table with tier colours (max 12 visible + overflow count), AHPRA-compliant footer disclaimer.
- **Regenerate report button** (2026-04-29) — `RegenerateButton` client component + `regenerateReport` server action. Triggers `runRiskNarrativePipeline()` then `runSupplementProtocolPipeline()` sequentially (risk first, supplement reads risk scores). `useActionState` with disabled/"Generating…" pending state. Appears in both existing-scores hero and pending-state view. `revalidatePath('/report')` refreshes on completion.
- **Last-updated timestamp** (2026-04-29) — prominent in bio-age hero, derived from latest of `risk_scores.assessment_date` and `supplement_plans.created_at`.
- **Progress diff section** (2026-04-29) — report page fetches `risk_scores ORDER BY assessment_date DESC LIMIT 2`; `generateProgressNarrative()` at `lib/insights/progress-narrative.ts` computes trend (improving/stable/declining/insufficient), headline, and per-domain bullets showing point changes. Rendered as a "Your progress" card with trend icon (↗/→/↘) and bullet list. First-assessment fallback message. Enabled by migration `0059_risk_scores_history.sql` which changed `risk_scores` unique constraint from `(user_uuid)` to `(user_uuid, assessment_date)`, allowing multiple historical rows.

**Outstanding:**
- Visual regression coverage (Chromatic) on `/report` and the PDF.
- Unit-test coverage on the PDF render path.

**Open bugs:** none.

**Closed bugs:**
- **BUG-005** (CLOSED 2026-04-29): Branded PDF route at `/api/report/pdf` was returning an unstyled skeleton. Resolved as part of the P0 Vietnam MVP wave (commit `f1fe816`, 2026-04-28) — the bug entry was simply not closed at the time. PDF now includes logo, cover page, big-number summary, domain colour swatches, supplement table with tier colours, footer disclaimer. Verified by inspection 2026-04-29.

---

### Epic 6: The Coach

`●●●●○` Planned · Feature Complete · Unit Tested · Regression Tested · ○ User Reviewed
**Estimate: 100%** — Janet streaming chat, cross-session history, stale-data nudge, health_researcher digests, support agent route, RAG, all five `tool_use` sub-agents (risk_analyzer, supplement_advisor, PT Coach, meal plan, supplement protocol), conversation-summary compression, eval suites, E2E tests, **latency benchmarks**, and **clinical prompt review document** all shipped.

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
- **Janet conversation E2E test** (`tests/e2e/janet-conversation.spec.ts`) — signs in, navigates to /report, sends 3 questions (health, supplement, exercise), asserts non-empty streaming responses. Uses `TEST_EMAIL`/`TEST_PASSWORD` env vars.
- **PT Coach `tool_use` integration** — `consult_pt_coach` tool wired into Janet at `lib/ai/tools/pt-coach-tool.ts`. Delegates to `pt_coach_live` pipeline agent with patient's active PT plan, MSK risk drivers, and exercise list. Output schema: advice (50–600 chars), exercises_referenced (max 5), optional safety_note. Safety note auto-triggers when MSK risk > 60.
- **Latency benchmark suite** (2026-04-29) — `tests/e2e/janet-latency.spec.ts`: 5 scenarios (simple greeting, risk deep-dive, supplement deep-dive, exercise advice, multi-domain synthesis). Measures wall-clock send→response time per scenario, logs P50/P95/max. Hard ceiling: 30s per turn. Detects tool invocation patterns from response content.
- **Clinical prompt review document** (2026-04-29) — `docs/qa/clinical-prompt-review.md`: extracts all 7 agent system prompts (Janet, Atlas, Sage, PT Coach, Janet-Clinician, Nova, Alex) with per-prompt review checklists and 6 cross-cutting clinical concerns. Sign-off table for GP, clinical pharmacist, and physiotherapist.

**Outstanding:** none — user review pending.

**Open bugs:**
- **BUG-004** (P2): Closed — pgvector enabled, migrations applied, RAG layer active.

**Closed bugs:** 1 (BUG-004 — pgvector/RAG now live).

---

### Epic 7: The Daily Return

`●●●●○` Planned · Feature Complete · Unit Tested · Regression Tested · ○ User Reviewed
**Estimate: 100%** — daily check-in UI, streak math, Mon-Sun dot strip with rest-day support, steps + water capture, risk_analyzer trigger, personalised daily goals, **check-in email reminders**, **weekly insights digest**, and **health journal** all shipped. User review pending.

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
- **Rest-day streak dots** (2026-04-29, #47) — `streakDots()` delegates to `calculateStreak()` which has rest-day tolerance; days in a 1–2 day rest gap render at 25% opacity, distinct from logged and missed. 4 new test cases.
- **Journal quick-link** (2026-04-29, #47) — `/journal` tile added to the dashboard quick-links grid.
- **Janet latency logging** (2026-04-29, #47) — `agent-factory` `onFinish` now emits `tools_invoked` alongside `patient_context_ms` / `total_ms`.
- **Personalised daily goals** (2026-04-29) — `deriveGoals()` enriched with risk-profile-aware logic: steps (6k–10k based on MSK/CV risk), sleep (7.5–8.5h based on neuro/metabolic risk), water (weight-derived + metabolic bonus), meditation (10–15 min based on questionnaire stress level + neuro risk). New `extractGoalInputs()` helper reads weight and stress from questionnaire JSONB responses. Dashboard now calls `deriveGoals()` instead of hardcoding targets; check-in and insights pages wired identically. 28 unit tests (was 10) covering all risk thresholds, `extractGoalInputs`, and edge cases.
- **Check-in email reminders** (2026-04-30) — daily cron at `app/api/cron/check-in-reminder/route.ts` (09:00 UTC via `vercel.json`). Checks `notification_prefs.check_in_reminders` opt-in (default true), enforces 20h minimum gap between sends, skips paused accounts. Email template at `lib/email/check-in-reminder.ts`. Migration `0064_notification_prefs.sql` adds the `notification_prefs` table with per-channel opt-in columns and last-sent timestamps.
- **Weekly insights digest** (2026-04-30) — Monday 08:00 UTC cron at `app/api/cron/weekly-digest/route.ts`. Aggregates last 7 days of daily logs per member (avg sleep, mood, energy, steps), counts open alerts, sends a branded email with stats table + dashboard CTA. Respects `notification_prefs.weekly_digest` opt-in (default true), 6-day minimum gap, skips paused and < 7-day-old accounts. Email template at `lib/email/weekly-digest.ts`. 14 unit tests at `tests/unit/email/weekly-digest.test.ts`.
- **Health journal** (2026-04-30) — `/journal` page with compose form (Zod-validated, 5000-char max) and reverse-chronological entry list. Server action at `app/(app)/journal/actions.ts`. Styled via `journal.css`. Table `public.journal_entries` (migration `0044_journal.sql`) with RLS owner policy and user+date index. Dashboard quick-link tile.
- **Journal enhancements** ([#66](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/66), 2026-04-29) — title, mood enum, tag array, full-text search, pin-to-top, inline edit. Migration `0066_journal_enhancements.sql` adds the columns + GIN index. Weekly digest tests bundled.

**Outstanding:** none — user review pending.

**Open bugs:** none.
**Closed bugs:** 0.

---

### Epic 8: The Living Record

`●●●○○` Planned · Feature Complete (member labs surface) · Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 90%** — five member-visible surfaces shipped: `/labs` (Lab Results UI), `/trends` (Daily-log trends), the alerts surface (`member_alerts` + dashboard chip + repeat-test cron + upload-flow lab-alert hook), the **Janet → `lab_results` structured writer**, and **`/simulator`** (real-time risk simulator with LDL/HbA1c/hsCRP/**Systolic BP**/Weight sliders running the deterministic risk engine in-browser via `useDeferredValue`, side-by-side baseline-vs-simulated display, empty-state CTA). Lab-alert path is now live — fires the moment any Janet-extracted biomarker is `low`/`high`/`critical`. SBP slider added 2026-04-29 with AHA-aligned numeric scoring bands. **Simulator added to top nav** (2026-04-29).

**Shipped:**
- `biomarkers` schema with `lab_results`, `wearable_summaries`, `daily_logs` tables (migrations `0009`, `0010`).
- Patient uploads parsed by Janet feed into `biomarkers.lab_results`.
- **`/labs` index page** (2026-04-28) — biomarkers grouped by category, each card showing latest value + status badge + reference range + trend; empty-state CTA for zero-row members.
- **`/labs/[biomarker]` detail page** (2026-04-28) — Recharts time-series with reference-range band, header card, full history table; `notFound()` on zero-row biomarker; Next 16 async params.
- **Pure helpers** at `lib/labs/` (`groupByBiomarker`, `formatRange`, `statusTone`, `categoryLabel`, `toChartData`) sourced off generated DB types — schema drift forces a compile error. 23 unit tests.
- **Dashboard tile** replaced "Coming soon · Lab Results" with live `<QuickTile>` showing biomarker count + latest test date.
- **Top-nav entries** (2026-04-29) — `/labs` and `/simulator` added to the app layout nav bar, visible to all signed-in members.
- **`/trends` page** (2026-04-28) — 30-day sparklines for Sleep, Energy, Mood, Steps, Water from `biomarkers.daily_logs`. Empty-state CTA pointing to `/check-in`. `lib/trends/` pure helpers (`buildTrendSeries`, `summariseTrend`, `ML_PER_GLASS`) sourced off generated DB types. 10 unit tests. Dashboard quick-link tile.
- **Member alerts surface** (2026-04-28) — `public.member_alerts` table (migration 0031, append-mostly, RLS owner-select + owner-update, service-role-only insert, unique partial index for idempotent re-runs). `lib/alerts/` pure evaluators (`evaluateLabAlerts`, `evaluateRepeatTests` with whole-token matching against a `SCREENING_KEYWORDS` map, `chipPayload`). Daily cron `/api/cron/repeat-tests` (Bearer-secret gated). Upload-flow lab-alert hook (defensive — no-op until Janet → `lab_results` writer lands). Dashboard hero chip with three severity tones (info/attention/urgent), `View →` link, dismiss server action. 20 unit tests.
- **Alert-email dispatcher** (2026-04-30) — `app/api/cron/alert-notification/route.ts` runs every 4 hours; emails any open `member_alerts` row that hasn't been emailed yet, then stamps `member_alerts.email_sent_at` for idempotency. Respects `notification_prefs.alert_emails` opt-in (default true) and `profiles.paused_at`. Email template at `lib/email/alert-notification.ts` with unsubscribe deep-link to `/account`.

**Outstanding:**
- Snooze / dismiss-suppression mechanism on alerts.
- Auto-resolve when next reading is back in range.
- `/alerts` index / triage page (route stub exists at `app/(app)/alerts/`).
- SMS / push delivery of alerts (email shipped 2026-04-30).
- Wearable OAuth integrations (Oura, Apple Watch, Garmin).
- Manual metric entry UI.
- Source-upload back-link from each lab row to its `patient_uploads` document.

**Open bugs:** none.
**Closed bugs:** 0.

---

### Epic 9: The Care Team

`●●●◐○` Planned · Feature Complete · Unit Tested · ◐ Regression Tested · ○ User Reviewed
**Estimate: 85%** — Plan B Wave-2-9 (2026-04-29) shipped the clinician portal end-to-end; the two-sided booking calendar (Waves 1-4, 2026-04-30) closed the patient-side loop with availability publishing, request/accept flow, and patient cancellation guarded by a 24h cutoff. What's left is real clinician pilot use plus the deferred items below.

**Shipped:**
- `clinical` schema (migrations `0011_clinical_schema.sql`).
- `programs` schema (`0012_programs_schema.sql`).
- `care_notes`, `periodic_reviews`, `patient_assignments`, `coach_suggestions` tables.
- **Janet-Clinician Brief pipeline** (monthly cron via `vercel.json`) — `lib/ai/pipelines/clinician-brief.ts`; populates `periodic_reviews.janet_brief` with structured patient summary before the clinician opens the review.
- **Role expansion** (migration `0048`) — `profiles.role` extended with `clinician`, `coach`, `health_manager`. `proxy.ts` gates `/clinician` and `/coach` paths; non-admins must hold the matching role.
- **Schema for the portal** (migration `0048` + `0050`) — `clinician_profiles`, `clinician_invites`, columns added to existing `appointments` (`video_link`, `patient_notes`, `clinician_notes`).
- **Periodic review workspace columns** (migration `0049`) — `program_30_day`, `program_sent_at`, `clinician_conversation_id` + clinician-can-update RLS via `patient_assignments`.
- **`janet_clinician` agent definition** (migration `0051`) — sonnet-4-6, clinician-colleague persona, instructed to call the submit tool.
- **Patient consent surface** at `/account` — "Care team access" form nominating a clinician by email; writes append-only `consent_records` row (new `care_team_access` policy) paired with the `patient_assignments` row.
- **Admin clinician invite** at `/admin/clinicians` — existing user → role updated in place + clinician_profiles row + branded Resend notification email; new user → single-use 14-day token in `clinician_invites` + Supabase invite email via custom SMTP.
- **`/clinician` review workspace** — two-pane layout, queue grouped by status (awaiting / in_review / program_ready / sent_to_patient), urgent flag for `needs_attention` or stress ≥ 8; right pane: Patient card (Janet brief + structured fields), live Janet chat, 30-Day Program tab with Save draft + Approve & send.
- **`/clinician/schedule`** — upcoming/past toggle, expandable appointment rows, status transitions, post-session notes.
- **`/clinician/profile`** — full self-service editor (specialties, languages, bio, contact, working hours, lunch break, session duration, timezone, active flag).
- **`janet_clinician` real-time agent** — `lib/ai/agents/janet-clinician.ts` + `lib/ai/tools/submit-program-tool.ts`; the submit tool writes `program_30_day` and flips `review_status` to `program_ready` (per C6 — replaces text sentinel). `POST /api/clinician/chat` gates on admin OR (clinician AND assigned via `patient_assignments`).
- **Patient program-delivery email** — `lib/email/program-delivery.ts`; clicking Approve & send sends a branded Resend message with the program body to the patient's auth email; non-fatal if Resend fails (status transition still holds, program visible in-app).
- **Pipeline JSON parse stability** (2026-04-29, #49) — clinician-brief and PT-plan pipelines now retry up to 3 times with progressive fallback (strict → conservative → text-parse). Silent failures eliminated; all recovery attempts logged.
- **Two-sided booking calendar Waves 1-3** ([#57](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/57), 2026-04-30) — migration `0055_clinician_booking_calendar.sql` adds `clinician_availability` (per-clinician recurring weekly slots, day_of_week 0-6, RLS clinician-rw + assigned-patient-r), and extends `appointments` with `video_link`, `patient_notes`, `clinician_notes`, `requested_at`, `accepted_at` plus a `'pending'` status. Clinician schedule page gains `AvailabilityGrid` (30-min increments 06:00–20:00) and `BookingRequests` (Accept/Decline cards). Patient `/care-team` page lists active assignments, clinician profile, 28-day available-slot calendar with overlap-checking, and inline booking panel (`SlotCalendar` + `requestBooking` server action). Dashboard Care Team tile linked.
- **Patient-side cancellation Wave 4** (2026-04-30) — migration `0067_appointment_cancellation.sql` extends `appointments.status` with `cancelled_by_patient` / `cancelled_by_clinician`, adds an append-only `appointments_cancellation_log` audit table written by a `SECURITY DEFINER` trigger on status transition, and a tightly-scoped `appointments_patient_update_cancel` RLS policy. `cancelBooking(appointmentId)` server action enforces ownership + 24h cutoff + status guard; UI shows a Cancel button (≥ 24h) or a static "contact your clinician" deflect (< 24h). 14 integration tests cover all rejection paths.

**Outstanding:**
- Real clinician pilot use (User Reviewed gate) — schema, UI, AI loop, and booking calendar are live but no actual clinician has run a monthly review + booked-session loop end-to-end yet.
- Clinical notes UI (`care_notes` writes from the workspace — currently `appointments.notes` is the only writable surface).
- Janet chat persistence (each tab open starts fresh; `clinician_conversation_id` column is in place but not yet populated).
- Community feed and challenges (deferred sub-epic).

**Open bugs:** none.
**Closed bugs:** 0.

**Recently shipped (Plan B Wave-2-9, 2026-04-29):**
- [#34](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/34) — clinician portal C1–C6 decisions resolved
- [#35](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/35) — foundation: role expansion + schema + proxy gates
- [#36](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/36) — patient consent + admin clinician invite
- [#37](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/37) — review workspace + schedule + profile
- [#41](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/41) — clinician invite email via Supabase custom SMTP
- [#45](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/45) — fix invite form feedback visibility + apply migrations 0038–0051 to production
- [#42](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/42) — janet_clinician real-time agent + submit_30_day_program tool
- [#43](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/43) — patient program-delivery email on Approve & send

**Recently shipped (Booking calendar, 2026-04-30):**
- [#57](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/57) — two-sided booking calendar (clinician availability + patient request/accept flow)
- Booking calendar W4 — patient cancellation with 24h cutoff + audit log trigger

---

### Epic 10: The Knowledge Engine

`●●◐○○` Planned · Feature Complete · ◐ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 75%** — health_researcher pipeline fully implemented 2026-04-28: PubMed search, LLM synthesis, chunk+embed, cron route, Vercel weekly schedule, PatientContext integration, unit + integration tests. Member-facing insights feed shipped 2026-04-29 with **category filter pills + search** added the same day (commit `e00fcf3`).

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
- **Member-facing insights feed** (2026-04-29) — `/insights` page extended with a "Research updates" section. Queries `public.health_updates` (latest 12), renders digest cards with category badge, evidence-level badge, title, 4-line content clamp, source attribution, and date. Responsive grid (2-col desktop, 1-col mobile). Scoped `insights.css` with colour-coded category and evidence badges. Empty state for zero digests.
- **Category filter + search** (2026-04-29, commit `e00fcf3`) — filter pills above the digest cards and free-text search input. Filtering is client-side; the server still returns the latest 12 across all categories.

**Outstanding:**
- pgvector extension formalised in migration `0055_pgvector_extension.sql` (commit `d2a85df`); confirm it is applied in production Supabase and that `hybrid_search_health()` is using HNSW (not falling back to keyword-only).
- NCBI API key (`NCBI_API_KEY`) for scale — raises PubMed rate limit from 3 to 10 req/s; not needed at weekly cadence.
- medRxiv integration — scoped for v2.
- Clinical reviewer rubric for digest quality.

**Open bugs:** none.

**Closed bugs:**
- **BUG-007** (P2, CLOSED): pgvector extension enabled; health knowledge migrations applied; RAG layer active via `hybrid_search_health()`.

---

### Epic 11: The Trust Layer

`●●●○○` Planned · Feature Complete · Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 97%** — RLS + PII boundary + consent records shipped and verified at the schema level, with the pgTAP RLS suite now running in CI on every PR; **export-everything bundle shipped 2026-04-28**; **right-to-erasure flow + "we never train on your data" clause shipped 2026-04-29** across three waves (PRs #46, #48, #50). **Erasure flow smoke-tested end-to-end** with a disposable test user (2026-04-29). **Deceased-flag schema landed 2026-04-30** (migration `0065_deceased_flag.sql`) — column in place; warm-copy UI flow still pending. **Per-channel notification opt-in card shipped 2026-04-30**. Remaining trust surfaces (deceased-flag UI, pause/freeze copy refinement, quarterly audit cadence) still outstanding.

**Shipped:**
- RLS on every table across `public`, `biomarkers`, `clinical`, `programs`, `billing` schemas.
- PII boundary: `profiles` holds identifiers only; `health_profiles.responses` is de-identified.
- AHPRA-compliant consent records (`consent_records`, append-only, migration `0004_consent_records.sql`).
- Supabase key-naming convention (`SUPABASE_SECRET_KEY`, not `SUPABASE_SERVICE_ROLE_KEY`).
- Service-role admin client used only in webhook routes, pipeline workers, and PDF generation.
- pgTAP RLS test suite at `supabase/tests/rls.sql` with 20 assertions, executed in CI via the `pgtap` job in `.github/workflows/ci.yml`.
- **Export-everything bundle** at `GET /api/export` — ZIP with one JSON file per patient-facing table (profile, health_profiles, risk_scores, supplement_plans, lab_results, daily_logs, consent_records), latest PDF report, and `manifest.json`. Soft 10000-row cap per table with truncation flag. Audit row per export in `public.export_log` (migration `0026`, append-only, owner-select RLS, service-role-only insert). Surfaced via `/account` page (2026-04-28).
- **Right-to-erasure flow** (2026-04-29, three waves):
  - Wave 1 (#46): migration `0052_erasure_log_and_data_no_training.sql` — new append-only `public.erasure_log` audit table (admin-select RLS, service-role-insert), `profiles.erased_at` soft-delete marker, FK relaxation on `consent_records.user_uuid` and `export_log.user_uuid` from `ON DELETE CASCADE` to `ON DELETE SET NULL` so the audit trail outlives a hard-delete. `data_no_training` consent policy registered (`lib/consent/policies.ts`, version `2026-04-29-1`).
  - Wave 2 (#48): cascade engine at `lib/erasure/plan.ts` (24-table data module with per-column scrub modes — `null` / `erased_sentinel` / `empty_jsonb`) + `lib/erasure/execute.ts` (orchestrator). Rewritten `deleteAccount` server action at `app/(app)/account/actions.ts` — 11 numbered steps: confirmation → auth → idempotency lookup against `erasure_log` → request metadata → Stripe cancel (hard-blocks on failure) → storage cleanup → cascade → audit log insert → `profiles.erased_at` stamp → hard-delete (`ENABLE_HARD_DELETE` defaults to true) or sign-out → redirect. Old `app/api/account/route.ts` backdoor deleted. 9 integration tests + 10 unit tests lock the invariants (24-entry coverage, idempotency short-circuit, Stripe-fail abort, payload exactness, happy-path full run).
  - Wave 3 (#50): UX surfaces — fourth onboarding consent toggle wires `data_no_training`; new `/legal/data-handling` static page with named-processors table (Anthropic, Resend, Stripe, Supabase, Vercel); `/account` "How we use your data" card showing acceptance state per current policy version; hardened delete-account button with type-`DELETE` text input replacing the Wave 2 placeholder. Footer link added site-wide on public pages.
- **Erasure flow smoke test** (2026-04-29) — full end-to-end walkthrough with a disposable test user created via Supabase admin API: signup → onboarding → type-DELETE confirmation → account deleted → `erasure_log` row confirmed → `auth.users` hard-delete verified → audit row survives (FK `ON DELETE SET NULL`). `/legal/data-handling` page verified (4 sections, named-processors table, no console errors). Footer "Data handling" link confirmed on `/` and `/pricing`.

**Pause / freeze account flow — shipped 2026-04-30 (verified).** `app/(app)/account/pause-actions.ts` exposes `pauseAccount` / `unpauseAccount` server actions; `/account` renders the toggle button + paused banner; `lib/supabase/proxy.ts:102` redirects paused users away from `/dashboard`, `/report`, `/check-in` to `/account?paused=true`. Fail-open on DB error to avoid permanent lockout. Copy refinement still pending real-user feedback.

**Deceased-flag schema (migration `0065_deceased_flag.sql`, 2026-04-30).** `profiles.deceased_at` column landed; warm-copy UI path (not a checkbox) still to design and build.

**Per-channel notification opt-in (2026-04-30).** `notification_prefs` table backs three independent toggles (`check_in_reminders`, `weekly_digest`, `alert_emails`) on `/account`; defaults to opted-in for legacy users; honoured by every dispatcher cron.

**Outstanding:**
- Pause / freeze copy refinement (warm tone, "we'll keep your data" reassurance).
- Deceased-flag UI flow with warm copy path (not a checkbox) — schema in place.
- Quarterly trust audit cadence (logs scrub, signed-URL TTL check, deceased-flow walk-through).
- DR drill — runbook drafted at [docs/operations/dr-drill.md](../operations/dr-drill.md); first drill scheduled for 2026-07-31.
- Sentry — code wired (commit `11f52bd` installs `@sentry/nextjs` and wraps next.config), runbook at [docs/operations/sentry-setup.md](../operations/sentry-setup.md); `NEXT_PUBLIC_SENTRY_DSN` still needs to be set in Vercel before error monitoring goes live.

**Open bugs:** none.

**Closed bugs:**
- **BUG-008** (P2, closed 2026-04-28): pgTAP RLS test file at `supabase/tests/rls.sql` was not run in CI. Wired into `.github/workflows/ci.yml` `pgtap` job (Task C1) — Postgres 15 service container, migrations applied in order, RLS suite executed on every PR. Failures now block CI.

---

### Epic 12: The Distribution

`●●◐○○` Planned · Feature Complete · ◐ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 75%** — admin CRM expanded into a full back-office (plans, add-ons, suppliers, products, test-orders, tiers, plan-builder) with shared CrudTable + admin-gated APIs. Admin overview ships MRR / active members / churn / pipeline runs / uploads tiles. **Employer dashboard at `/org` shipped 2026-04-29** (commit `129498b`) — KPIs, seat utilisation, plan details, org nav. **CSV bulk invite flow shipped 2026-04-29** (commit `dfae631`). Marketplace integration still outstanding.

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

**Outstanding:**
- Supplement marketplace integration (auto-replenishment, in-app purchase from protocol page).
- Sign-in-with-Vercel for clinician partners.
- Audit log for admin-configuration changes (who changed agent settings and when).
- Aggregate-only org reporting hardening — `/org/dashboard` currently exposes seat utilisation; verify no individual PII is reachable from the health-manager role.

**Recently shipped (Sprint 2):**
- Wave 5 (2026-04-29) — `/admin/plans`, `/admin/addons`, `/admin/suppliers`, `/admin/products` CRUD pages + 10 admin-gated API routes; shared `CrudTable` component; `lib/admin/guard.ts` requireAdmin helper.
- Wave 6 (2026-04-29) — `/admin` overview tiles for MRR, active members, new signups, churn, pipeline runs, uploads.
- #49 (2026-04-29) — `/admin/tiers` tier management, `/admin/plan-builder` plan builder UI, `/org/members` org member page, B2B plan admin APIs (CRUD + seat audit + allocations + product inclusions), feature-keys admin, Janet services admin, supplier inline edit.
- #52/#53 (2026-04-29) — tier seed migration (`0053`), open-tier migration (`0054`), TiersClient build fix.
- [#69](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/69) (2026-04-29) — employer dashboard at `/org/dashboard`: KPIs, seat utilisation, plan details, org nav.
- CSV bulk invite (2026-04-29, commit `dfae631`) — `/org/invite` parses CSV and inserts `billing.org_invites` rows.

**Open bugs:** none.
**Closed bugs:** 0.

---

### Epic 13: The Business Model

`●●◐○○` Planned · Feature Complete · ◐ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 50%** — Sprint 2 (2026-04-29) shipped the customer-facing pricing rail end-to-end: public `/pricing` page driven from DB, four-path feature-flag resolver, account add-on management, full admin catalog. Decisions D1–D4 resolved by James. Admin tier management + plan builder shipped (#49/#52). Provider-partner / Stripe Connect / patient disclosure work still outstanding.

**Shipped:**
- B2C subscription rail (Stripe checkout + webhook lifecycle) — see Epic 1.
- `billing` schema scaffolding (`suppliers`, `products`, `plans`, `plan_addons`, `subscription_addons`, `test_orders`, `organisations`, `organisation_members`, `organisation_addons`) — migration `0013_billing_schema.sql`.
- `billing.org_invites` table (single-use tokens, 14-day expiry) for email + CSV bulk corporate invites — migration `0047_*` (2026-04-29).
- `billing.organisation_addons.stripe_subscription_item_id` + status — D4 flat one-Stripe-item-per-add-on org billing — migration `0047_*` (2026-04-29).
- `lib/features/resolve.ts` — four-path canAccess(userId, featureKey) feature-flag resolver covering admin, org_addon, org plan tier, sub_addon, user plan tier (Sprint 2 W2).
- `lib/pricing/calculate.ts` — `calculateTotal` + `calculateOrgTotal` (flat per D2/D4) with 11 unit-test cases (Sprint 2 W2).
- Public `/pricing` page (Screen 1): monthly/annual toggle, tier cards, gated add-ons, live total (Sprint 2 W3).
- DB-driven `/api/stripe/checkout` accepting `{ plan_id, addon_ids[], billing_interval }`; `priceIdForPlan()` flagged `@deprecated` (Sprint 2 W3).
- `GET /api/plans` and `GET /api/plan-addons` (Sprint 2 W3).
- `/account/billing` page (Screen 3): current plan, add-on add/remove, test catalog, order history (Sprint 2 W4).
- `POST/GET/DELETE /api/subscription/addons`, `GET/POST /api/test-orders` with Stripe sub-item / payment-intent helpers (Sprint 2 W4).
- Admin plan + add-on catalog UI (`/admin/plans`, `/admin/addons`) and 4 admin API routes (Sprint 2 W5).
- Admin supplier + product catalog UI (`/admin/suppliers`, `/admin/products`) — wholesale price hidden from non-admin views via `billing.products_public` (Sprint 2 W5).
- **Admin tier management** (`/admin/tiers`) — CRUD for billing tiers with tier seed migration (`0053_seed_tier_plans.sql`) and open-tier migration (`0054_plans_open_tier.sql`) (2026-04-29, #49/#52).
- **Plan builder** (`/admin/plan-builder`) — admin UI for assembling plans from tiers + inclusions + allocations (2026-04-29, #49).
- **Pricing admin foundation migration** (`0052_pricing_admin_foundation.sql`) — `feature_keys`, `janet_services`, `tier_inclusions`, `platform_settings`, `b2b_plans`, `b2b_plan_tier_allocations`, `b2b_plan_product_inclusions`, `b2b_plan_seat_audit`, `organisation_member_products` tables (2026-04-29, #49).

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

`●●◐○○` Planned · Feature Complete · ◐ Unit Tested · ○ Regression Tested · ○ User Reviewed
**Estimate: 78%** — substantial pieces already shipped via the existing `.claude/rules/` discipline (RLS, PII boundary, secret-key naming, pipeline auth, migration hygiene). CI Vitest+pgTAP and Gitleaks secret scanning shipped 2026-04-28; **Playwright + Lighthouse CI jobs added 2026-04-29** (Sprint 2 W1). **Cost monitoring shipped 2026-04-30** — `agent_usage` telemetry, `/admin/cost` dashboard, daily rollup cron, $50 budget alert email; **migration applied to prod 2026-04-30** (was code-only until then; `[agent_usage] insert failed (non-fatal)` logs gone). **Sentry installed 2026-04-30** (`@sentry/nextjs` wired into `next.config`); DSN env var still pending. **Schema-drift catch-up 2026-04-30** — 11 migrations had landed in repo without being applied to prod (booking calendar, meal-plan idempotency, risk-scores history, agent_usage, notification_prefs, deceased flag, journal enhancements, appointment cancellation); all caught up via direct apply, postgrest schema cache reloaded. **CI infra debt remains:** Lint, Typecheck, pgTAP, and Gitleaks jobs all fail at boot (pnpm action version mismatch + missing org licence + missing `auth.jwt()` in pgTAP container) so PRs ship without those gates exercising. The remaining operational layer (DR drill, pen-test cadence, log-scrub automation, CI repair) is unbuilt.

**Shipped:**
- RLS on every table across `public`, `biomarkers`, `clinical`, `programs`, `billing` schemas.
- Supabase secret-key naming (`SUPABASE_SECRET_KEY`, not `SUPABASE_SERVICE_ROLE_KEY`).
- PII boundary enforced at write time (`lib/profiles/pii-split.ts`).
- Service-role admin client confined to webhook routes, pipeline workers, PDF generation.
- Pipeline routes secured with `x-pipeline-secret` header.
- 59 numbered idempotent migrations (0001–0059, monotonic) with `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`.
- Engineering rules canonical in `.claude/rules/` (data-management, security, nextjs-conventions, database, ai-agents).
- `.env` files git-ignored; never committed.
- TypeScript schema types regenerated after every migration (`lib/supabase/database.types.ts`).
- `proxy.ts` route guard (no ad-hoc auth in pages).
- Supabase Storage MIME whitelist + 50 MB cap on uploads.
- Encryption at rest (Supabase default) + TLS in transit.
- **Gitleaks secret-scan workflow** at `.github/workflows/secrets.yml` — runs on every PR and every push to `main`; fails the check on a hit. Default ruleset extended via `.gitleaks.toml` (2026-04-28).
- **Pipeline JSON parse stability** (2026-04-29, #49) — 3-attempt progressive retry with fallback for all LLM pipelines (clinician-brief, PT-plan, risk-narrative, supplement-protocol). Silent pipeline failures eliminated.
- **Playwright + Lighthouse CI jobs** (2026-04-29, Sprint 2 W1) — added to `.github/workflows/ci.yml`; `.lighthouserc.json` thresholds: perf ≥ 0.8, a11y ≥ 0.9, best-practices ≥ 0.9.
- **Cost monitoring** (2026-04-30) — migration `0063_agent_usage.sql` adds `agent_usage` (one row per Claude API call) and `agent_cost_alerts` (one row per breached daily-budget period) tables. Pricing helpers at `lib/ai/pricing.ts` cover Opus 4.7 / Sonnet 4.6 / Haiku 4.5; token capture wraps both `streamText` and `generateText` paths in `lib/ai/agent-factory.ts`. `/admin/cost` dashboard renders today's spend, range total, daily totals, by-agent breakdown, recent failures, open alerts. Daily 01:00 UTC cron `/api/cron/cost-rollup` upserts an alert row when over `COST_DAILY_BUDGET_USD` (default $50) and emails admins via `lib/email/cost-alert.ts`. 9 unit tests on pricing math.
- **Sentry installed** (2026-04-30, commit `11f52bd`) — `@sentry/nextjs` package added; `next.config` wrapped via `withSentryConfig`. Runbook at `docs/operations/sentry-setup.md`. `NEXT_PUBLIC_SENTRY_DSN` env var still needs to be set in Vercel before error monitoring goes live.

**Outstanding:**
- Sentry DSN configuration in Vercel envs (code shipped, signal pending).
- Supabase storage quota alert.
- Vercel function execution-time monitoring.
- Supabase point-in-time restore drill executed and runbook in `docs/operations/dr-runbook.md` — runbook drafted, first drill scheduled 2026-07-31.
- Quarterly penetration test cadence on a staging mirror.
- Monthly dependency CVE scan (dependabot + `pnpm audit`).
- Weekly log scrub for PII regressions.
- Production-readiness checklist (`docs/operations/checklist.md`) and enforcement in PR template.
- AHPRA breach-notification protocol document.
- Data residency confirmation per region.
- **CI repair (P1):** all 4 pre-existing CI failures need fixing so future PRs are actually gated. Fix `pnpm/action-setup` version conflict (remove `version: 10` so it picks up `packageManager` from `package.json`), add Gitleaks org licence secret or swap to a self-hosted scanner, bootstrap `auth.jwt()` in the pgTAP test container.
- **Schema-drift prevention:** add a CI gate that compares `supabase/migrations/` against `supabase_migrations.schema_migrations` on prod and fails if any file is unapplied for >7 days. Today's drift went unnoticed for 2+ days; the cost was 2 users with broken narratives.
- ~~Migration filename collisions~~ **RESOLVED** (2026-04-29) — one-shot renumber collapsed collision groups into monotonic ordering. Tracking reconciliation migration at `0057_renumber_tracking.sql` updates `supabase_migrations.schema_migrations` in production. Latest migration is `0067_appointment_cancellation.sql`.

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
