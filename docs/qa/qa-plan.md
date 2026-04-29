# Longevity Coach — Forever QA Plan

Last updated **2026-04-28**. Drafted by: QA, in the Dan Shipper school. AI-native, pragmatic, fast feedback over perfect coverage, obsessed with the vibe of the product. Built around the official `webapp-testing` skill (Python Playwright + the `with_server.py` lifecycle helper) we already use for live QA.

**Companion docs:**
- [product.md](../product/product.md) — who we serve, the four values, what makes us different.
- [epics.md](../product/epics.md) — the twelve bodies of work.
- [epic-status.md](../product/epic-status.md) — the dashboard.
- [2026-04-27-qa-report.md](./2026-04-27-qa-report.md) — most recent regression report (91 tests, 90 pass, 1 external).
- This file: how we know what we shipped is right.

---

## 0. The frame

Most QA plans optimise for "no bugs." That's the wrong target for Longevity Coach. Longevity Coach is a **medical-grade second opinion** that produces a credible biological age, a defensible risk picture, and a 30-day plan a member will actually follow. The thing we're really testing is whether **the loop holds**: signup → questionnaire → upload → bio-age → narrative → protocol → report → return tomorrow. If that loop breaks for one member, we've broken something irreplaceable: trust in the very thing they came here to build.

So the QA hierarchy is:

1. **Trust integrity** (RLS, PII boundary, consent records, signed URL TTL, never-train clause). Existential.
2. **Loop integrity** (questionnaire submits → risk_analyzer writes narrative → supplement_advisor writes protocol → `/report` renders → Janet replies). The product.
3. **AI quality** (risk_analyzer narrative, supplement_advisor protocol, Janet coaching, Janet document analyser). The moat.
4. **Vibe** (does `/report` feel like medicine; does Janet feel like a coach who remembers). The brand.
5. **Everything else** (perf, polish, accessibility). Important but ranked.

We test in that order. We invest in tests in that order.

---

## 1. Automated test routines

### Tier 1: Unit tests (Vitest)

Pure functions only. Fast, run on every save, must stay under 5 seconds total.

| Target | Why test it |
|---|---|
| Questionnaire validation (`requiredMissing`, toggle strictness, multiselect minima) | Already 14 tests passing. The intake is the data spine. |
| `splitFullName()` (PII helper) | Single source of truth for derived first/last name. Off-by-one breaks reports. |
| `pii-split.ts` (PII vs questionnaire splitter) | If this drifts, PII leaks into `health_profiles.responses` — vault migration impossible. |
| Deterministic risk engine scoring functions (when ported) | One test per domain (CV, metabolic, neuro, onco, MSK), one per bio-age estimator. Ported from Base44. |
| Supplement-tier mapper (when added) | Tier label assignment is rules-based; easy to regress. |
| Streak math (M-T-W-T-F-S-S dots, day boundaries, timezones) | Streaks are emotional. Off-by-one across midnight kills retention. |
| Date-of-birth → age helper | Computed at read time, never stored. Wrong age corrupts every score. |
| Drip email day-N selector | Sending Day-3 to a member on Day-7 is worse than no email. |

**Goal:** every file in `lib/profiles/`, `lib/risk/`, `lib/supplements/`, `lib/streaks/` has a sibling `.test.ts`. Coverage isn't the metric; *every branch in critical helpers* is the metric.

### Tier 2: Integration tests (Vitest + Supabase)

Two flavours: mocked Supabase (fast, used for server actions) and real Supabase (slower, used for RLS and trigger behaviour).

#### 2a. Mocked-Supabase integration (fast)

Already shipped: 29 tests across `tests/integration/auth/`, `tests/integration/onboarding/`, `tests/integration/stripe/`. Run on every PR. No network. Mocks lie about RLS — those are covered in 2b.

| Suite | What it covers |
|---|---|
| `tests/integration/auth/actions.test.ts` | All 13 paths through `signIn`, `signUp`, `requestPasswordReset`, `updatePassword`. |
| `tests/integration/onboarding/actions.test.ts` | `saveDraft` and `submitAssessment` happy paths plus the no-user error path. |
| `tests/integration/stripe/webhook.test.ts` | All 8 lifecycle event types plus signature failure plus missing user metadata. |
| **(new) risk_analyzer pipeline** | Trigger risk_analyzer with a fixture `health_profiles.responses`. Assert `risk_scores.narrative` is populated, scores are present, idempotent on second run. |
| **(new) supplement_advisor pipeline** | Trigger supplement_advisor with a fixture `risk_scores`. Assert `supplement_plans.items` has ≥ 3 critical-tier items with rationale strings under 200 chars. |
| **(new) Janet streaming response** | Mock Anthropic SDK. Assert `PatientContext.load()` is called once, the system prompt includes the patient summary, and turns persist to `agent_conversations`. |

#### 2b. Real-Supabase integration (RLS + trigger truth)

Spin up a separate Supabase project named `longevity-coach-test` (mirrors the prod region, Sydney). Reset between runs via `supabase db reset`. Do not mock RLS. Mocks lie; this is how the soft-delete-bug class slips through in similar projects.

| Suite | What it covers |
|---|---|
| **RLS isolation (patient-owned)** | Create user A and user B. For every patient-owned table (`profiles`, `health_profiles`, `risk_scores`, `subscriptions`, `patient_uploads`, `supplement_plans`, `consent_records`, `agent_conversations`), assert B cannot SELECT, UPDATE, or DELETE A's rows. Run on every PR. Non-negotiable. |
| **RLS isolation (clinician-gated)** | Create patient A, clinician C with a `patient_assignments` row, clinician D without one. Assert C can read A's `risk_scores` and `care_notes`, D cannot. |
| **RLS isolation (admin-only)** | Assert non-admin users cannot read `agent_definitions`, `suppliers`, `plans`, `add_ons`. |
| **Service-role bypass scope** | Confirm service-role can write to `risk_scores`, `supplement_plans`, `subscriptions`. Confirm service-role does NOT bypass FK constraints. |
| **Auth trigger** | New `auth.users` row → `handle_new_user` populates `profiles.id` and `profiles.full_name`. |
| **Consent append-only** | Insert one consent record, attempt UPDATE → policy denies. Attempt DELETE → policy denies. |
| **Pipeline idempotency** | Run risk_analyzer twice on the same `(user_uuid, computed_at_date)`. Assert no duplicate row, second run updates the first. |
| **Migration safety** | After every new migration: run all prior tests against the new schema. Migrations that break tests get rolled back, not patched. |

The pgTAP file at `supabase/tests/rls.sql` (20 assertions, written 2026-04-27) is the starting point. **Wire it into CI on every PR via `supabase db test`.** This is the single highest-value QA investment we are not yet making.

### Tier 3: End-to-end browser tests (Playwright TS)

Headless on every push to main. Already exist at `tests/e2e/` for auth and the public landing.

**The Critical Path test** (always green or we don't ship):

```
1. Sign up with a fresh @longevity-coach-test.com address (use service-role to pre-confirm)
2. Land on /onboarding (no health profile yet)
3. Complete the 6-step questionnaire with fixture answers
4. Submit, land on /dashboard?onboarding=complete
5. Wait for risk_analyzer pipeline (poll risk_scores until narrative is present, max 60s)
6. Wait for supplement_advisor pipeline (poll supplement_plans until items present, max 30s)
7. Open /report — assert bio-age, all 5 domain scores, narrative paragraph, supplement table render
8. Open Janet chat panel, send "what is my biggest risk", assert a streaming response that names the patient's actual top driver
9. Upload a fixture blood-panel PDF
10. Wait for Janet document analyser (poll patient_uploads.janet_status until 'complete')
11. Wait for supplement_advisor re-run (poll supplement_plans for new row newer than original)
12. Sign out, /login renders
13. Sign back in, /report still shows the same narrative + protocol
```

This is the golden path. If this breaks, everything stops.

**Additional Tier 3 suites already in place** (`tests/e2e/auth/` and `tests/e2e/public/`):
- Public marketing pages render with correct headings, logos, CTAs.
- Auth-guard redirects work for `/dashboard`, `/onboarding`, `/admin`.
- `/auth/callback` handles both `token_hash + type` and `code` paths.
- Empty submit triggers HTML5 validation; wrong creds show inline error.

### Tier 4: Live QA via the `webapp-testing` skill (Python Playwright)

This tier is what we already ship under `tests/live-qa/`. It exists because Vitest mocks lie and the TS Playwright suite needs a seeded user fixture we haven't built yet. Live QA hits a real running server.

**The skill's three rules** (from `.claude/skills/webapp-testing/SKILL.md`):

1. **Use `scripts/with_server.py`** to manage server lifecycle so the test script doesn't have to know about `pnpm dev`. Run `--help` first; never read the source.
2. **Reconnaissance-then-action**: navigate, wait for `networkidle`, take a screenshot, identify selectors from rendered state, *then* execute actions.
3. **Always wait for `networkidle`** before any DOM inspection on dynamic apps. Skipping this is the #1 cause of flaky live-QA tests.

**Existing live-QA scripts:**

| Script | Coverage | Status |
|---|---|---|
| `tests/live-qa/qa_public.py` | 33 tests across `/`, `/science`, `/team`, `/stories`, `/sample-report`. Heading checks, logo checks, CTA href checks, console error sniff, network-failure sniff. | 33/33 passing 2026-04-27. |
| `tests/live-qa/qa_run.py` | Full auth + flows — signup, signin, password reset, validation echo, redirect-after-error. | 10/11 passing; 1 skipped on Supabase email rate limit. |

**New live-QA scripts to add:**

| Script | Coverage |
|---|---|
| `tests/live-qa/qa_report.py` | Sign in as a seeded test user with completed assessment, open `/report`, screenshot, assert the four sections render (bio-age card, domain scores grid, narrative, supplement table), open Janet chat, send a message, screenshot the streaming response. |
| `tests/live-qa/qa_uploads.py` | Sign in, upload a fixture blood panel, wait for Janet analysis, screenshot the upload list with status badge, assert the protocol page picks up the new biomarkers. |
| `tests/live-qa/qa_account.py` (when `/account` ships) | Sign in, navigate to `/account`, edit profile, screenshot, assert change persists across reload. |
| `tests/live-qa/qa_visual_vibe.py` | Take full-page screenshots of the four "vibe" surfaces (`/`, `/dashboard`, `/report`, `/report` with Janet chat open) at desktop + mobile widths, save to `tests/live-qa/screenshots/{date}/`. Diff against committed baseline. |

**Sample script skeleton (matches the webapp-testing pattern):**

```python
# tests/live-qa/qa_report.py
from playwright.sync_api import sync_playwright

# Run via:
#   python scripts/with_server.py --server "pnpm dev" --port 3000 -- python tests/live-qa/qa_report.py

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:3000/login')
    page.wait_for_load_state('networkidle')

    # Sign in as the seeded test member
    page.fill('input[name="email"]', 'qa-seeded-member@longevity-coach-test.com')
    page.fill('input[name="password"]', os.environ['QA_SEED_PASSWORD'])
    page.click('button:has-text("Sign in")')
    page.wait_for_url('**/dashboard*')
    page.wait_for_load_state('networkidle')

    # Open the report
    page.goto('http://localhost:3000/report')
    page.wait_for_load_state('networkidle')
    page.screenshot(path='tests/live-qa/screenshots/report.png', full_page=True)

    # Assert the four sections render
    assert page.locator('text=Biological age').is_visible()
    assert page.locator('text=Cardiovascular').is_visible()
    assert page.locator('[data-testid="narrative"]').is_visible()
    assert page.locator('[data-testid="supplement-table"]').is_visible()

    browser.close()
```

**Quality gate:** `tests/live-qa/qa_public.py` runs in CI on every push to main; the rest run nightly and pre-release.

### Tier 5: Mobile Safari real-device tests (BrowserStack)

Members are on iPhones. Headless Chromium will not catch the things that bite us. Run before every pilot invite, weekly otherwise.

| Test | Why |
|---|---|
| Questionnaire on iPhone Safari (full 6 steps, all field types) | Touch targets, virtual keyboard behaviour, iOS chip rendering. |
| File upload from iPhone (HEIC, 5 MB blood-panel PDF) | EXIF stripping, iOS photo-picker, network-throttled upload retry. |
| Janet chat on iPhone (long response with code blocks and lists) | Streaming SSE behaviour on iOS Safari, auto-scroll, copy-paste. |
| `/report` PDF download on iPhone Mail handoff | The PDF must open cleanly in Files / Mail, not break the share sheet. |
| Magic-link tap from Mail.app to Safari | The handoff from Mail to Safari breaks in subtle ways. |

### Tier 6: Visual regression (Chromatic)

Run on every PR. The `/report` page, the Janet chat panel, the supplement table, the dashboard — these are the brand. A 2px shift on the bio-age headline is a real regression.

Snapshot targets:
- `/` (landing — desktop + mobile)
- `/dashboard` (no risk, mid-pipeline, complete)
- `/report` (loading, complete, with Janet chat open, after re-upload)
- `/onboarding` (each of the 6 steps with one filled and one unfilled state)
- Branded PDF first page (when shipped)

### Tier 7: Performance budgets (Lighthouse CI)

Members are on home Wi-Fi and middle-aged iPhones. Budgets:
- LCP `< 2.5s` on `/dashboard` and `/report`
- TTI `< 3.5s` on every signed-in route
- risk_analyzer pipeline p95 latency `< 45s` end-to-end
- supplement_advisor pipeline p95 latency `< 25s` end-to-end
- Janet first-token latency `< 800ms`
- Janet full-response p95 `< 12s` for a 200-token reply
- No bundle larger than 250 KB gzipped per route

Alerts on email the moment a budget regresses by > 10%.

### Tier 8: Synthetic monitoring (one cron-driven script in production)

A scheduled Python Playwright script every 30 minutes:
1. Sign in as a dedicated synthetic patient account.
2. Open `/dashboard`, assert it loads under 2.5s.
3. Open `/report`, assert narrative + protocol present.
4. Send a Janet message ("how am I doing this week"), assert streaming starts within 1s.
5. Page if any step fails twice in a row.

This catches Anthropic API outages, Supabase regional flakes, and Stripe webhook silent failures *before* a real member hits them.

---

## 2. AI evaluation suite (the Dan Shipper part)

Longevity Coach's moat is AI quality. Evals get their own pipeline, separate from CI, run on a schedule and after every prompt or model change.

### 2a. risk_analyzer (risk narrative) evals

**Golden dataset:** 30 anonymised completed assessments. Diverse:
- Lifestyle-only (no biomarker uploads)
- One blood panel uploaded
- Five panels uploaded over 12 months
- Edge profiles (very low CV risk + very high metabolic; severe family history; missing key answers)
- Members in their 30s, 50s, 70s

**Metrics tracked over time:**
- **Specificity**: does the narrative cite at least 3 specific questionnaire answers or biomarker values? (LLM-as-judge with rubric, 1–5)
- **Plain-English score**: Flesch-Kincaid grade target 8–10. (Programmatic.)
- **No-overclaim**: zero sentences that recommend or contraindicate a prescription medication. (Regex sweep + LLM judge.)
- **Driver-to-score linkage**: does each domain score have a driver in the narrative? (Programmatic.)
- **GP-readability**: would a GP send this to a patient? (Quarterly human panel of 3 GPs reading 10 random narratives, scored 1–5.)
- **Latency p50 / p95 / p99**.

**Pass bar:** specificity mean ≥ 4.0, no-overclaim 100%, driver-to-score linkage 100%, GP-readability mean ≥ 4.0. If a model upgrade regresses any dimension by `> 0.5`, we don't ship it.

### 2b. supplement_advisor (supplement protocol) evals

**Golden dataset:** the same 30 assessments above, paired with the protocol supplement_advisor produces for each.

**Metrics:**
- **Item-to-driver linkage**: every item has a rationale that names the patient's specific risk driver.
- **Rationale length**: each rationale 80–200 chars (long enough to justify, short enough to read).
- **Tier distribution**: at least 3 `critical`, no more than 12 total items per protocol.
- **Catalog discipline** (when the curated catalog ships): every item appears in `lib/supplements/catalog.ts`. Zero hallucinated names.
- **Doctor-acceptability**: would an integrative-medicine doctor prescribe this? (Quarterly human panel of 3 doctors reading 10 random protocols, scored 1–5.)

**Pass bar:** item-to-driver linkage 100%, rationale length 100% in range, doctor-acceptability mean ≥ 4.0.

### 2c. Janet (real-time coach) evals

**Dataset:** 50 anonymised conversations with at least 5 turns each. Mixed: greeting, follow-up question, supplement clarification, risk-narrative challenge, off-topic question.

**Judge dimensions (LLM-as-judge with rubric, 1–5 each):**
- **Context utilisation**: does the response reference the patient's actual data (top driver, recent upload, supplement on the protocol)?
- **Accuracy**: every factual claim traces to PatientContext or the RAG corpus. Hallucination rate < 1%.
- **Warmth**: would a 50-year-old feel coached, not lectured?
- **Boundary discipline**: refuses to diagnose, refuses to interpret medication dosage, escalates to "talk to your GP" appropriately.
- **Brevity**: median response under 200 tokens; only goes long when explicitly asked.

**Pass bar:** mean ≥ 4.0 across all dimensions, hallucination < 1%. Friday human-judge audit on 10 random conversations; if judge-vs-human agreement drops below 80%, re-tune the rubric.

### 2d. Janet document analyser evals (already shipped)

**Golden dataset:** 20 anonymised blood panels (PDF + scanned image + Apple Health export). Hand-extracted ground-truth biomarker values.

**Metrics:**
- **Extraction accuracy** per biomarker (TC, LDL, HDL, TG, HbA1c, fasting glucose, hs-CRP, vitamin D, ferritin, ALT, AST, GGT, creatinine, eGFR, TSH).
- **Unit normalisation** (mmol/L vs mg/dL, ng/mL vs nmol/L).
- **Reference-range parsing**.
- **Confidence calibration**: when Janet says "high confidence," is the value actually correct?
- **Latency p95 < 30s** for a single panel.

**Pass bar:** extraction accuracy ≥ 95% per biomarker, unit normalisation 100%, reference-range parsing ≥ 90%, latency p95 under 30s. If any biomarker drops below 90%, ship a regression fix before any other AI work.

### 2e. Eval infrastructure

One repo or one folder, separate from website code. Stack:
- `evals/` directory at the project root with one folder per eval suite.
- Datasets versioned in DVC or git-LFS (PII-stripped, fixture-only).
- Runs nightly via Vercel Cron (`app/api/cron/evals/route.ts`).
- Results push to a Supabase `evals` table with `(suite, metric, value, model_id, run_at)` shape.
- Dashboard page at `/admin/evals` (admin-only) showing rolling 7-day trend per metric.
- Email alert on regression > 5% from rolling mean.

The eval board is the room we walk into when someone says "Janet feels off lately." Without it, that complaint is unanswerable.

---

## 3. Manual testing best practices

Automated tests catch the things you can name. Manual testing catches the things you can only feel. Both are required.

### 3a. The "test on your dad" rule

Every engineer, before they ship anything that touches the assessment loop, completes the questionnaire using **a real 60+ relative's data** (with consent, on a test account, with throwaway email). Not a synthetic profile. Not a colleague. An actual parent, aunt, uncle, or family friend who is a plausible target member.

Then they walk through the artifact end to end on their own iPhone.

This is the single highest-leverage QA practice we have. 80% of the bugs we ship are bugs that look fine when you fill the questionnaire as a 30-year-old developer reading scripted text in a quiet office and look broken when your aunt is squinting at the family-history section trying to remember whether her father had high blood pressure.

### 3b. The pre-pilot-invite checklist

Before any new pilot member is invited, one engineer plus one non-engineer run this on a brand-new Apple ID, fresh phone, throttled to LTE:

- [ ] Land on `/` cold. Hero "Get my bio-age" CTA is visible above the fold.
- [ ] Tap CTA → land on `/signup` with form fields visible.
- [ ] Sign up with a real-looking email (not `test+1@`). Receive verification email.
- [ ] Tap link in Apple Mail → land in Safari signed in → land on `/onboarding`.
- [ ] Complete all 6 questionnaire steps. The "what does this mean" copy is present on every section.
- [ ] Family-history section accepts "I don't know" gracefully.
- [ ] Submit → land on `/dashboard?onboarding=complete`.
- [ ] Within 60 seconds, dashboard refreshes to show bio-age + domain scores.
- [ ] Open `/report`. Narrative paragraph reads like a GP letter, not a quiz score.
- [ ] Supplement protocol shows ≥ 3 items with rationale visible.
- [ ] Open Janet chat. Send "what is my biggest risk?" — first token within 1 second; full response references the actual top driver.
- [ ] Upload a fixture blood-panel PDF. Within 30 seconds, the upload list shows "complete" with extracted values.
- [ ] Within another 60 seconds, `/report` updates with new biomarkers reflected in the narrative and protocol.
- [ ] Download PDF. Open in Files. Looks like a clinical document.
- [ ] Sign out. Sign back in via password. Everything is still there.
- [ ] Try to access another account's `/report` directly via URL manipulation. Get redirected to `/login` or `/dashboard`.

If any line fails, no invite ships that day.

### 3c. Bug-bash before every phase boundary

Half a day, whole team, free-form. Rules:
- Use the staging account, not your dev account.
- Try to break it on purpose. Tap things twice. Backgrounded tabs. Airplane-mode mid-upload. Kill Safari mid-Janet-stream.
- Log every paper cut, even visual ones, in `docs/qa/QA-bugs.md` with a screenshot and a severity (P1 / P2 / P3).
- Triage same day. Fix or defer with a written reason.

### 3d. The vibe check (the GP test)

Once a sprint, one person who is **not on the engineering team** (founder, designer, a friendly GP) walks through the report cold. They are asked one question per section: "Would you put this in your patient's hand?"

Longevity Coach fails not when it crashes; it fails when `/report` feels like a calculator output instead of a clinical document. The four vibes that have to land:
- The bio-age card (the headline number).
- The five-domain narrative (the per-domain explanation).
- The supplement protocol table (the actionable plan).
- The Janet chat panel (the coach in the corner).

If a vibe checker says "huh, this is weird" or "I wouldn't show this to my mum," that is a P1.

### 3e. Trust audits (Epic 11)

Quarterly:
- Pull a random member's account in Supabase. Confirm RLS denies access from any other authenticated user.
- Confirm signed URLs for upload artefacts (`patient_uploads` storage bucket) expire in 1 hour.
- Read the deploy logs from the last 7 days. Confirm no PII landed in `console.log`. Use a regex sweep for `@`, `+61`, `19[0-9]{2}`, etc.
- Walk the deceased-flag flow (when shipped) with someone who has lost a parent. Adjust copy if it lands wrong.
- Verify `consent_records` is append-only at the database (attempt UPDATE / DELETE as service-role; should be denied by policy).
- Confirm "we never train on your data" copy in ToS matches the architecture (no training endpoints in `lib/ai/`, no model fine-tune jobs, no third-party data shares).

### 3f. Member interviews (the post-bug postmortem)

When a real pilot member hits a bug, we do not just fix it. Within a week of the fix, we get on a 15-minute call and ask:
- What did you think was happening?
- What did you do next?
- Did you tell anyone (your GP, your partner)?
- What would have been the perfect outcome?

Their words go in a file (`docs/research/member-bug-postmortems.md`). Three of them in a row that mention the same theme is a roadmap input.

---

## 4. Quality gates and CI

What blocks a deploy:
- Tier 1 unit tests fail.
- Tier 2 RLS or pipeline-idempotency tests fail.
- Tier 3 critical-path E2E fails.
- Tier 4 `qa_public.py` fails.
- Lighthouse budget regression > 10%.
- Eval suite 2a (risk_analyzer) regression > 0.5 on any dimension.
- Eval suite 2d (Janet document analyser) regression > 5% on any biomarker.
- Visual regression on the four "vibe" surfaces (`/`, `/dashboard`, `/report`, Janet chat panel).

What does *not* block a deploy:
- Visual regressions on non-vibe screens (review next sprint).
- Eval regressions in suites that haven't shipped yet (track, don't gate).
- Tier 5 mobile real-device suite (gates pilot invites, not main).
- Tier 8 synthetic monitor warning (alerts; doesn't block existing deployments).

### Tooling stack

| Layer | Tool |
|---|---|
| Unit + mocked-Supabase integration | Vitest 4 |
| RLS + trigger truth | pgTAP via `supabase db test` against `longevity-coach-test` project |
| E2E (TS) | Playwright (Node) — `pnpm test:e2e` |
| Live QA (Python) | The `webapp-testing` skill — `python scripts/with_server.py --server "pnpm dev" --port 3000 -- python tests/live-qa/<script>.py` |
| Mobile real-device | BrowserStack |
| Visual regression | Chromatic |
| Performance | Lighthouse CI (Vercel-native) |
| Evals | Standalone `evals/` folder, Vercel Cron runner, Supabase `evals` table, `/admin/evals` board |
| Synthetic monitor | Vercel Cron + a single Python Playwright script |
| Bug log | `docs/qa/QA-bugs.md` (to be created), one row per bug with ID, severity, epic, repro, status |

---

## 5. Sequencing the QA build

The agent layer just landed (2026-04-28). Phase 2 isn't user-reviewed yet. We can't build everything before the next pilot; we sequence the way the product sequences.

| Week | QA build |
|---|---|
| 1 | Wire `pgTAP` RLS suite into CI. risk_analyzer + supplement_advisor integration tests in 2a. Pre-pilot-invite checklist run for the first time on the new Phase 2 surfaces. |
| 2 | Critical-path E2E in Playwright TS, including a seeded test-user fixture. Live-QA `qa_report.py` and `qa_uploads.py` under the `webapp-testing` skill. |
| 3 | risk_analyzer eval suite (2a) live with first golden dataset of 10 fixture assessments; supplement_advisor eval (2b) the same. Synthetic monitor in production. |
| 4 | Janet eval suite (2c) live with first 20 fixture conversations. Doctor panel scheduled for risk_analyzer + supplement_advisor. |
| 5 | Visual regression (Chromatic) on the four vibe surfaces. Lighthouse budgets enforced. |
| 6 | Mobile Safari runs on BrowserStack. Bug-bash before pilot invites. |
| 7 | Trust audit. Pre-pilot-invite checklist run on every new test phone. |
| 8 | Vibe check round with a friendly GP. Member interview protocol locked in. First member-bug postmortem template in `docs/research/`. |

Post-pilot, build evals 2c (richer Janet rubric) and 2d (extended biomarker coverage) in parallel with the daily-engagement and clinician-portal epics, *before* those features ship to users.

---

## 6. The principle to remember

**A test is only worth writing if a real member would notice when it catches the bug.**

That's the bar. Not coverage. Not test count. The thing the member would have noticed, captured before they noticed it.

Everything else is theatre.
