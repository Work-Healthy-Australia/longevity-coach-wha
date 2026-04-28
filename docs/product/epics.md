# Longevity Coach — Epics

Last updated **2026-04-28**. Drafted in the Dan Shipper school: bundled by thesis, not by phase number.

**Companion docs:**
- [product.md](./product.md) — who we serve, the four values, what makes us different.
- [epic-status.md](./epic-status.md) — at-a-glance status of each epic.
- [../qa/qa-plan.md](../qa/qa-plan.md) — how we test what we ship.

---

## 0. The frame

The legacy `phase-XX-` documents are a delivery sequence. This document is the **thesis layer**: fourteen epics, each with a one-sentence claim, a bundle of features, the mechanism that makes it work, and the criterion that says we got it right.

An epic earns shipping when **the success criterion is true** — not when every feature in the bundle is feature-complete.

---

## Epic 1 — The Front Door

**Thesis:** A stranger arrives, understands the offer, creates an account, and pays — without ever leaving the product.

**Bundle:**
- Public marketing pages (`/`, `/science`, `/team`, `/stories`, `/sample-report`).
- Sign-up, sign-in, email verification (OTP + PKCE), password reset.
- Welcome email on activation (idempotent).
- Stripe checkout (monthly + annual) and webhook lifecycle handling.
- Logged-in nav with Dashboard / Report / Documents / Account links.
- `/account` self-service profile and subscription management.

**Mechanism:** Marketing pages live in `app/(public)/`. Auth flows live in `app/(auth)/` and route through `proxy.ts` (Next.js 16's renamed `middleware.ts`). Stripe integration lives at `app/api/stripe/`, reads the raw body for signature verification.

**Success criterion:** A new visitor can land on `/`, finish onboarding (questionnaire + payment), and be sitting on `/dashboard` within 12 minutes. Median time-to-first-report under 24 hours.

---

## Epic 2 — The Intake

**Thesis:** A member shares their health background once. Forever after, every component of the platform reads from that one source of truth.

**Bundle:**
- Six-step questionnaire (basics, medical, family, lifestyle, goals, consent) with save-and-resume.
- PII-vs-questionnaire split at write time (`lib/profiles/pii-split.ts`).
- AHPRA-compliant consent record on submit (append-only `consent_records`).
- Patient uploads portal (50 MB cap, MIME whitelist, Supabase Storage).
- Janet document analyser (Claude Opus 4.7 + adaptive thinking) parses every upload and stores extracted biomarkers.

**Mechanism:** Questionnaire schema lives in `lib/questionnaire/`. Server actions in `app/(app)/onboarding/actions.ts` split PII to `profiles` and de-identified questionnaire data to `health_profiles.responses`. Uploads write to `patient_uploads` with `janet_*` columns populated by `lib/uploads/janet.ts`.

**Success criterion:** A member completes the questionnaire in under 10 minutes (median), every PII field lands in the correct table, and any blood panel they upload is parsed within 30 seconds with the extracted values displayed.

---

## Epic 3 — The Number

**Thesis:** Every member walks away with a biological age and a five-domain risk picture they trust enough to share with their GP.

**Bundle:**
- Deterministic risk engine ported from Base44 (`lib/risk/`) — five scoring functions plus bio-age estimator.
- Risk engine runs synchronously inside `submitAssessment()` and writes `risk_scores.engine_output`.
- Atlas pipeline (risk narrative LLM) reads `engine_output` and writes a per-domain narrative + top drivers + recommended screenings + data gaps.
- Confidence label on every score (`high` when biomarkers present, `moderate` when questionnaire-only).
- Risk scores recomputed on every new upload.

**Mechanism:** Two-step pipeline: deterministic arithmetic for the score, LLM for the explanation. Atlas is a pipeline worker (async, idempotent upsert keyed on `user_uuid`). Triggered by the `health_profiles.completed_at` write and by `patient_uploads.janet_status = 'complete'` events.

**Success criterion:** A member who completes the questionnaire receives a bio-age and risk picture within 60 seconds of submission. The narrative names which questionnaire answers and which uploaded biomarkers drove each score. A panel of three GPs reviewing 10 sample reports rate them ≥ 4/5 on "would I send this to a patient."

---

## Epic 4 — The Protocol

**Thesis:** Every member walks away with a 30-day supplement plan they can buy at the chemist tonight.

**Bundle:**
- Sage pipeline (supplement protocol LLM) reads risk + uploads + questionnaire and writes `supplement_plans.items`.
- Per-item rationale linked to the specific risk driver it addresses.
- Tier label per item (`critical` / `high` / `recommended` / `performance`).
- Auto-replanning when risk scores change.
- Janet (Supplement Advisor mode) can answer questions about any item.
- Hand-curated supplement catalog (~40 evidence-backed items) for deterministic Phase 1 generation; LLM-enhanced generation in Phase 2.

**Mechanism:** Sage is a pipeline worker. Triggered by Atlas completion. Writes to `supplement_plans` (one active row per patient, status check constraint). Janet reads `supplement_plans.items` via `PatientContext`.

**Success criterion:** Every protocol contains at least three tier-`critical` items with rationale text under 200 characters that names the patient's specific driver. A panel of three integrative-medicine doctors reviewing 10 sample protocols rate them ≥ 4/5 on "would I prescribe this."

---

## Epic 5 — The Report

**Thesis:** Members have one place — in the app and in PDF — to see everything the platform knows about them.

**Bundle:**
- `/report` in-app page combining bio-age, domain scores, narrative, supplement protocol, Janet chat panel.
- Last-updated timestamp prominent.
- Branded PDF export at `/api/report/pdf` (logo, domain colours, narrative, supplement table, footer disclaimer).
- Regenerate-on-demand button.
- "What changed since last report" diff when run twice.

**Mechanism:** `/report` is a server component that reads `risk_scores`, `supplement_plans`, `agent_conversations`. PDF generated server-side via `lib/pdf/report-doc.tsx` (React-PDF), piped to Supabase Storage with a one-hour signed URL.

**Success criterion:** A member can download a PDF that prints cleanly and looks like a clinical document, not a marketing brochure. A non-technical member shown the in-app report can verbally summarise their bio-age, top risk, and top supplement within 60 seconds.

---

## Epic 6 — The Coach

**Thesis:** Janet is the patient's coach who remembers everything, available 24/7, who never makes them re-explain.

**Bundle:**
- Janet streaming chat agent (Claude Sonnet 4.6).
- `PatientContext.load()` runs all DB reads in parallel via `Promise.all` (target < 50ms).
- 20-turn conversation window per patient with older turns summarised to one sentence per session.
- Sub-agent tool calls: Atlas (risk narrative), Sage (supplement protocol), PT Coach (live exercise).
- Hybrid RAG over `health_knowledge` (pgvector HNSW + BM25 + RRF fusion) — populated by Nova.
- Stale-data nudges (e.g. "your risk scores are 30 days old — let me refresh that").
- Persona-aware support agent (Alex) for platform questions.

**Mechanism:** Janet runs at `app/api/chat/route.ts`, streams via Anthropic SDK. PatientContext lives at `lib/ai/patient-context.ts`. Sub-agents are real-time `tool_use` (the user waits ~3s when a specialist is needed). Janet → sub-agent only one layer deep — never sub-agent → sub-agent.

**Success criterion:** A member returning after two weeks gets a Janet response that references their last conversation by name. Median first-token latency under 800ms. Hallucination rate (claims unsupported by PatientContext) under 1% on a 100-conversation sample.

---

## Epic 7 — The Daily Return

**Thesis:** Members come back daily because the platform makes the next 24 hours of their health concrete.

**Bundle:**
- Daily check-in (mood, sleep, energy, weight) — under 90 seconds.
- Personalised daily goals (steps, water, sleep target, meditation) tied to risk profile.
- Habit streak with rest-day mechanic (protects streaks across travel and grief).
- Drip email sequence (Day 1, 3, 7, 14, 30 re-engagement).
- Push / SMS / email reminder for the daily check-in.
- Weekly insights digest ("your energy is consistently low on Mondays").
- Health journal for free-form notes.

**Mechanism:** Check-ins write to `daily_checkins` (already in schema). Streak math lives in `lib/streaks/` (to be built). Drip emails run via Vercel Cron (`app/api/cron/drip-emails/route.ts`, already shipped). Janet reads the last 7 days of check-ins via `PatientContext`.

**Success criterion:** Day-7 retention > 40%. Day-30 retention > 25%. Median check-in completion under 90 seconds. Drip emails open-rate > 35%.

---

## Epic 8 — The Living Record

**Thesis:** Members go deeper over time — uploading lab results, connecting wearables, watching their bio-age trend across years.

**Bundle:**
- Longitudinal biomarker charts (HbA1c, hs-CRP, vitamin D, etc.) per patient.
- Out-of-range alerts.
- Wearable integrations (Oura, Apple Watch, Garmin) via OAuth.
- Manual metric entry for members without wearables.
- Risk simulator: "if I lower my LDL to X, my CV risk drops to Y."
- "Repeat this test in 6 months" reminders driven by the recommended-screenings narrative.

**Mechanism:** Biomarkers stored in the `biomarkers` schema (`biomarkers.lab_results`, `biomarkers.wearable_summaries`, `biomarkers.daily_logs` — schemas exist). Charts via Recharts in client components. Wearable OAuth tokens stored encrypted in `wearable_devices`.

**Success criterion:** A member two years in can see their bio-age trend across 24 monthly snapshots and the three biomarkers that moved the most. The risk simulator agrees with the deterministic risk engine within 2 points on every domain.

---

## Epic 9 — The Care Team

**Thesis:** Members hand the keys to a clinician when they want a human second opinion. The clinician walks in already informed.

**Bundle:**
- Clinician portal with patient list, patient detail, alerts.
- Care-team invitation and per-patient permission management.
- Janet-Clinician brief pipeline: monthly auto-generated clinical brief + 30-day plan suggestion.
- In-platform appointment booking (calendar integration, Stripe payment).
- Clinical notes (private to care team).
- Periodic review record (`periodic_reviews` table — schema exists).
- Community feed and challenges (deferred sub-epic).

**Mechanism:** Clinician role gated via `profiles.role = 'clinician'` and `patient_assignments` rows. Clinician-side reads use the user client (RLS enforces patient consent), pipeline-side writes use the admin client. Janet-Clinician runs on a 1st-of-month cron per assignment.

**Success criterion:** A clinician opening a patient for the first time can summarise the patient's risk picture in under 3 minutes. Patient consent for care-team access is captured via the consent-record flow (AHPRA audit).

---

## Epic 10 — The Knowledge Engine

**Thesis:** Janet always knows the latest research, and her answers are grounded in cited evidence.

**Bundle:**
- Nova research digest pipeline (weekly cron, ~200s runtime).
- Six-category parallel literature scan (PubMed, Nature, Cell, medRxiv, Cochrane, plus one rotating).
- LLM synthesis per category, embedded into `health_knowledge` (pgvector HNSW + GIN hybrid index).
- Embedding model: `perplexity/pplx-embed-v1-4b` via OpenRouter (2560 dims, 32K context, INT8, MRL).
- `health_updates` structured digest table for the in-app research feed.
- Hybrid RAG search function `hybrid_search_health()` called by Janet at session start (~30ms overhead).
- Citations surfaced in Janet's responses ("a 2026 Cell paper on rapamycin in mice…").

**Mechanism:** Nova runs at `app/api/cron/nova/route.ts` (to be built). Migration `0016_knowledge_base_pgvector.sql` is written but blocked on enabling the `vector` extension in Supabase. Nova is independent of every other component — it only writes; nothing reads from it synchronously.

**Success criterion:** Janet's responses cite a research source in > 30% of substantive answers. Citation accuracy (does the cited paper actually say what Janet claims) > 95% on a quarterly audit. Nova runtime stays under 250s.

---

## Epic 11 — The Trust Layer

**Thesis:** A patient (or their GP, or the AHPRA auditor) can ask "where is my data and what are you doing with it" and get a clear answer.

**Bundle:**
- RLS on every table (already enforced).
- PII boundary: identifiers on `profiles`, de-identified questionnaire on `health_profiles.responses`.
- AHPRA-compliant consent records (append-only, captures user UUID + policy version + timestamp + channel).
- "We never train on your data" clause in ToS, surfaced in onboarding.
- Export-everything button (downloadable JSON + PDF bundle).
- Right-to-erasure flow (single-row scrub since PII is single-table).
- Pause / freeze account option.
- Deceased-flag flow handled with a warm copy path, not a checkbox.
- pgTAP RLS test suite executed in CI (currently written but not run).
- Quarterly trust audit (read deploy logs for PII, rotate signed-URL TTLs, walk the deceased flow with someone who has lost a parent).

**Mechanism:** Existing RLS via Supabase plus the new key-naming convention (`SUPABASE_SECRET_KEY`, not `SUPABASE_SERVICE_ROLE_KEY`). Service-role admin client used only in webhook routes, pipeline workers, and PDF generation. PII handling rules in `.claude/rules/data-management.md` and `.claude/rules/security.md`.

**Success criterion:** Zero PII leaks in production logs. RLS test suite green in CI. Export-everything completes in under 30 seconds. Every consent change has a corresponding `consent_records` row.

---

## Epic 12 — The Distribution

**Thesis:** The product reaches members through three channels — direct consumer, employer-paid, and clinician-referred — without forking the codebase.

**Bundle:**
- Corporate account management (employee invitations, team challenges, aggregate reporting, no individual PII visible to admins).
- Admin CRM for the Longevity Coach team (members, subscriptions, support, agent definitions, prompt library).
- Supplement marketplace integration (auto-replenishment via supplier API, in-app purchase from the protocol page).
- Sign-in-with-Vercel for clinician partners (Phase 6).
- Pricing tiers (individual / family / clinical / corporate) wired to entitlements.

**Mechanism:** Corporate accounts modelled in the `billing` schema (already exists, will be extracted as a standalone billing platform in Phase 6). Admin pages live in `app/(admin)/` (currently stubbed). Marketplace integration via the existing `suppliers` and `products` tables in the `billing` schema.

**Success criterion:** A corporate buyer can upload a 200-employee CSV and have invitations sent within 5 minutes. The admin CRM lets James see a single-screen view of MRR, active members, churn, and pipeline runs in the last 24 hours. Marketplace conversion (member viewing protocol → completed supplement order) > 15%.

---

## Epic 13 — The Business Model

**Thesis:** Longevity Coach makes money three ways — direct subscriptions, employer licences, and a curated provider ecosystem where Janet's recommendations route patients to wholesale partners (pathology, imaging, fitness, nutrition, supplements). The platform earns a margin on every booking; the patient gets one place to act on what they've just learned.

**Bundle:**
- **B2C subscriptions** (already live via Epic 1) — monthly and annual individual plans.
- **B2B corporate licences** (Phase 6 via Epic 12) — per-seat enterprise plans with aggregate dashboards.
- **B2B clinical subscriptions** (Phase 5 via Epic 9) — practitioner subscriptions activating the care-team feature.
- **Provider ecosystem (the new revenue stream):**
  - Admin panel for wholesale provider onboarding (contract terms, margin splits, fulfilment SLA, regional coverage).
  - Third-party catalog: blood work, DEXA scans, PT sessions, gym memberships, meal-kit fulfilment, supplement fulfilment, genetic tests, hormone panels.
  - Janet-driven surfacing — when she suggests a member needs X, the relevant offering appears inline with a one-tap CTA.
  - Patient-facing booking and checkout in-platform; Stripe Connect for split payments.
  - Per-recommendation audit trail: which Janet suggestion → which offering surfaced → did it convert → did the outcome change the next risk score.
  - Provider performance dashboard (orders fulfilled, NPS, refunds, regional performance).
  - Wholesale margin captured per transaction; transparent to the patient ("this booking is provided by Acme Labs; we receive a referral fee").
  - Curated catalog discipline — every offering must be evidence-aligned with the supplement/risk catalog. No pay-to-play placements.

**Mechanism:**
- New tables in the `billing` schema:
  - `provider_partners` — admin-managed; contract terms, margin %, region, status.
  - `provider_offerings` — one row per bookable thing; SKU, price, modality (in-clinic / at-home / digital), evidence tag, recommended-when criteria.
  - `provider_orders` — patient transactions; FK to `provider_partners` and to the originating Janet suggestion.
- Janet uses `tool_use` (`search_offerings(category, region, evidence_tag)`) when a recommendation matches a catalog category.
- Stripe Connect for split payments — patient pays Longevity Coach; we forward the provider's share automatically.
- Admin pages under `app/(admin)/providers/` for onboarding, catalog editing, order monitoring.
- Provider-side pages (deferred to Phase 6) so providers can manage their own listings.
- Replaces and broadens the supplement-marketplace bullet currently inside Epic 12.

**Success criterion:**
- 5 partner integrations live within 6 months of GA (one in each of: pathology, imaging, fitness, nutrition, supplements).
- ≥ 25% of Janet recommendations that surface a relevant offering convert to a booking.
- Provider-ecosystem revenue contributes ≥ 20% of total platform revenue within 12 months of GA.
- Zero pay-to-play violations on quarterly catalog audit (every offering traceable to an evidence-backed protocol element).
- Patient-side disclosure ("we receive a referral fee") visible on every offering.

---

## Epic 14 — The Platform Foundation

**Thesis:** The engineering substrate that makes Longevity Coach defensible as a healthcare-grade product — security, observability, cost discipline, disaster recovery, dependency hygiene. The work that's invisible when it's right and existential when it's wrong.

**Why this is its own epic:** Epic 11 (The Trust Layer) is what we *promise* the patient and the regulator (consent records, export-everything, never-train clause). Epic 14 is the engineering discipline that lets us *keep* those promises. They are paired — neither stands without the other — but they live at different abstraction layers and they're tracked separately so the substrate work doesn't disappear inside feature roadmaps.

**Bundle:**
- **RLS + service-role discipline** — every table has RLS; the admin client is used only in webhook routes, pipeline workers, PDF generation. Documented in `.claude/rules/security.md`; enforced by the pgTAP suite (Epic 11) and integration tests (qa-plan §1.2b).
- **Encryption** — Supabase TLS in transit, AES-256 at rest. Verified quarterly.
- **Secret management** — Vercel env vars only; `.env` files git-ignored; no secrets logged. Gitleaks (or equivalent) secret-scan on every PR.
- **Pipeline auth** — internal HTTP routes require `x-pipeline-secret`; secret rotated quarterly.
- **Observability** — structured logging with no PII; error monitoring (Sentry / Highlight / equivalent); performance metrics; alert routing.
- **CI/CD quality gates** — Vitest + pgTAP + Playwright + Lighthouse must pass before merge to main. Workflow files under `.github/workflows/`.
- **Database migration discipline** — numbered, idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`); `supabase db diff` clean before commit; types regenerated after every schema change.
- **Dependency hygiene** — `pnpm audit` weekly; dependabot enabled; new dependency requires written justification in the PR description.
- **Cost controls** — Anthropic API spend dashboard with 80%-of-budget alert; Supabase storage quota alert; Vercel function execution-time monitoring.
- **Disaster recovery** — Supabase point-in-time restore tested quarterly (actually restored to a fresh project, smoke-tested); runbook in `docs/operations/dr-runbook.md`.
- **Healthcare-readiness posture** — AHPRA breach-notification protocol; data residency (Sydney for AU members; UK region when needed); GDPR posture; documented stance on training data with architecture-level enforcement.
- **Security cadence** — quarterly penetration test on a staging mirror; monthly dependency CVE scan; weekly log scrub for PII regressions.
- **Production-readiness checklist** — every new route or pipeline ships against a checklist before going live (auth ✓, RLS ✓, idempotent ✓, observable ✓, has tests ✓, doc updated ✓).

**Mechanism:**
- Engineering rules canonical in `.claude/rules/` (`data-management.md`, `security.md`, `nextjs-conventions.md`, `database.md`, `ai-agents.md`).
- CI workflows under `.github/workflows/` (none exist yet — gap).
- Supabase project: RLS enforced; daily backups; point-in-time recovery on Pro tier.
- Vercel project: env vars per environment (preview / production); Fluid Compute defaults; observability integration.
- Production-readiness checklist lives in `docs/operations/checklist.md` (to be created).

**Success criterion:**
- Zero secrets in git history (gitleaks green on every PR).
- Zero PII in production logs (weekly regex sweep green).
- 100% of migrations idempotent and re-runnable on a clean DB.
- p99 latency budgets in qa-plan §1.7 met.
- Anthropic API spend per active member per month tracked and within budget.
- Quarterly penetration test produces a written report; remediation tracked.
- Backup restoration drill executed quarterly; runbook current.
- Dependency CVE backlog ≤ 5 high-severity at any time.
- Every new route ships against the production-readiness checklist (no exceptions).

---

## How epics relate to phases

The legacy `phase-XX-` documents map to epics like this:

| Phase | Epics shipped or in progress |
|---|---|
| Phase 1 — Foundation | Epic 1 (Front Door), Epic 2 (Intake), early Epic 11 (Trust Layer), early Epic 14 (Platform Foundation: RLS, PII boundary, migration discipline) |
| Phase 2 — Intelligence | Epic 3 (Number), Epic 4 (Protocol), Epic 5 (Report), early Epic 6 (Coach), continuing Epic 14 (pipeline auth, secret discipline) |
| Phase 3 — Engagement | Epic 6 (Coach: full coach suite + RAG), Epic 7 (Daily Return), continuing Epic 14 (CI workflows, observability) |
| Phase 4 — Clinical Depth | Epic 8 (Living Record), Epic 10 (Knowledge Engine: Nova), early Epic 13 (Business Model: pathology + imaging partners) |
| Phase 5 — Care Network | Epic 9 (Care Team), continuing Epic 13 (PT, gym, meals partners) |
| Phase 6 — Scale | Epic 12 (Distribution), late Epic 11 (Trust Layer audit cadence), full Epic 13 (Business Model: provider catalog + Stripe Connect), late Epic 14 (DR drills, pen-test cadence, production-readiness enforcement) |

Phases describe **when**. Epics describe **why**. The two views are complementary; neither replaces the other.
