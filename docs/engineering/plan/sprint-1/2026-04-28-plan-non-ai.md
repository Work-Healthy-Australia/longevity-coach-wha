# Plan: Non-AI Workstreams (deterministic + UI + ops)

**Drafted:** 2026-04-28
**Scope:** Everything that does *not* require an LLM, an agent, or a vector store.
**Out of scope:** Atlas, Sage, Janet, Nova, sub-agent tool_use, RAG, knowledge ingestion, prompt engineering. Those run in parallel.

---

## How to read this

The remaining work splits into six independent workstreams. Each one can be picked up by a single contributor without coordinating with the AI track. Inside each workstream, items are listed in dependency order — finish item N before starting item N+1.

Effort markers: **S** (≤ 1 day), **M** (1–3 days), **L** (3–10 days).

---

## Workstream A — Deterministic Risk Engine *(Epic 3, Epic 4 catalog)*

The risk engine and the supplement catalog are *not* LLM work. They're the deterministic layer the agents read from. Today every score is LLM-derived (`confidence_level='moderate'`); porting these unblocks clinical credibility for the whole product.

### A1 — Port the deterministic risk engine **(L, ~3 days)**
- Source: `base/functions/riskEngine/entry.ts` in `Work-Healthy-Australia/base-44-longevity-coach` (~1,231 lines).
- Target: `lib/risk/` in this repo.
- Modules to split out:
  - `lib/risk/cardiovascular.ts` — Framingham + ASCVD adapters, family-history weighting.
  - `lib/risk/metabolic.ts` — HOMA-IR, glycaemic, body-composition.
  - `lib/risk/neurodegenerative.ts` — APOE-aware where genotype present, age-of-onset weighted.
  - `lib/risk/oncological.ts` — sex-stratified, family-history-weighted, smoking-modulated.
  - `lib/risk/musculoskeletal.ts` — sarcopenia + fracture risk.
  - `lib/risk/biological-age.ts` — Phenotypic Age (Levine) variant.
  - `lib/risk/scorer.ts` — orchestrator: input shape → all five domain scores + bio-age + `engine_output` JSON.
- Wire into `app/(app)/onboarding/actions.ts::submitAssessment()` to run **before** Atlas dispatch.
- Atlas downstream reads `risk_scores.engine_output` and writes only the narrative.

**Tests required (gating):**
- One Vitest per domain in `tests/unit/risk/` covering a happy-path scenario, an extreme scenario, and a missing-data scenario. Minimum 3 per domain × 5 domains + bio-age = 18 tests.
- Use 5 fixture profiles (low / medium / high / chronic / pristine) at `tests/fixtures/risk-profiles.ts`.
- Snapshot test the full `engine_output` per fixture so future refactors fail loudly.

**Acceptance:**
- New `risk_scores` rows show `confidence_level='high'` (or `'moderate'` only when key inputs missing).
- Fixture-based snapshots stable across runs.
- `pnpm test` passes; coverage on `lib/risk/` ≥ 90%.

### A2 — Build the deterministic supplement catalog **(M, ~2 days)**
- New migration `0021_supplement_catalog.sql` creating `public.supplement_catalog`:
  ```sql
  create table public.supplement_catalog (
    id              uuid primary key default gen_random_uuid(),
    sku             text unique not null,
    display_name    text not null,
    canonical_dose  text not null,        -- e.g. "1000 IU/day"
    timing_default  text,                  -- e.g. "with breakfast"
    evidence_tag    text not null check (evidence_tag in ('A','B','C')),
    domain          text not null check (domain in ('cardiovascular','metabolic','neurodegenerative','oncological','musculoskeletal','general')),
    triggers_when   jsonb not null default '{}',  -- { "ldl_gt": 140 } etc.
    contraindicates jsonb not null default '[]',  -- list of medication SKUs
    cost_aud_month  numeric(6,2),
    supplier_sku_au text,
    notes           text,
    created_at      timestamptz not null default now()
  );
  alter table public.supplement_catalog enable row level security;
  create policy "catalog_read_authenticated" on public.supplement_catalog
    for select using (auth.role() = 'authenticated');
  ```
- Seed file `supabase/seeds/supplement_catalog.sql` with ~40 evidence-tagged items (vit D, omega-3, magnesium, creatine, NAC, berberine, etc.). Source list approved by James offline.
- New helper at `lib/supplements/catalog.ts`: `recommendFromRisk(engineOutput) → SupplementItem[]` — pure deterministic logic that walks `triggers_when` against the engine output and returns up to 8 ranked items.
- Sage's pipeline (already shipped, agent work) will be modified by the AI track to read from `recommendFromRisk()` first, only embellish copy. That bridge is *their* concern — we only need to expose the function.

**Acceptance:**
- Catalog seeded with ≥ 40 items, every item has `evidence_tag` and at least one `triggers_when` rule.
- `recommendFromRisk()` returns deterministic output for fixture engine outputs (snapshot tests in `tests/unit/supplements/`).
- Catalog table reflects in `database.types.ts` after `supabase gen types`.

### A3 — GP-panel review of 10 sample narratives **(operational, not engineering)**
- Once A1 ships, generate 10 representative reports.
- Send to clinical advisory panel for review.
- Track findings in `docs/qa/gp-panel-2026-XX-XX.md`.

---

## Workstream B — Member Surfaces *(Epic 5, Epic 7, Epic 8)*

Visible work members will feel. Each item is independently shippable.

### B1 — Branded PDF report **(M, ~2 days)** — *Epic 5*
- File: `lib/pdf/report-doc.tsx` — already exists as a skeleton.
- Add: cover page (logo, member name, date, biological age headline), domain-icon scoring grid, supplement table, narrative (when present), footer disclaimer ("informational, not medical advice"), page numbers.
- Use `react-pdf/renderer` `<Image>` with the SVG logo from `docs/brand/longevity-coach-horizontal-logo.png`.
- Fonts: Helvetica family is fine (already registered); upgrade to Fraunces + Inter via `Font.register` if time allows.
- A4 page size, 18 mm margins.
- Acceptance: print preview opens in Acrobat without errors; doesn't fall apart at A3 or letter; one printout test against a Brother HL-L2350DW.

### B2 — Steps + water fields in check-in form **(S, ~0.5 day)** — *Epic 7* — ✅ **DONE 2026-04-28**
- File: `app/(app)/check-in/_components/check-in-form.tsx` and `actions.ts`.
- Add two number inputs: Steps (0–60000), Water glasses (0–20, store as ml × 250).
- Update server action validation.
- Preserve existing fields and the upsert key.

### B3 — Mon-Sun streak dot UI on dashboard **(S, ~0.5 day)** — *Epic 7* — ✅ **DONE 2026-04-28**
- File: `app/(app)/dashboard/page.tsx`.
- Render 7 dots representing the last 7 calendar days. Filled = logged, empty = missed, today = highlighted ring.
- Place above or beside the streak counter in the hero.
- Pure CSS, no new dependencies.

### B4 — Lab results UI **(M, ~2–3 days)** — *Epic 8* — ✅ **DONE 2026-04-28**
- New page: `app/(app)/labs/page.tsx`.
- Reads `biomarkers.lab_results` (table already exists, schema exposed via migration 0020).
- Group by biomarker, show latest value + reference range + colour-coded out-of-range badge.
- Link each biomarker to a `/labs/[biomarker]` detail page with a Recharts time-series.
- Recharts dependency check: already in package.json? If not, add.
- Add to the proxy `PROTECTED_PREFIXES` and the dashboard quick-links tile.

### B5 — Daily-log charting **(S, ~1 day)** — *Epic 8* — ✅ **DONE 2026-04-28**
- New section on `/check-in` (or new page `/trends`): 30-day line charts for sleep_hours, energy_level, mood, steps.
- Reuse Recharts setup from B4.

### B6 — Risk simulator stub **(M, ~2 days)** — *Epic 8* — ✅ **DONE 2026-04-29** (LDL/HbA1c/hsCRP/Weight sliders; SBP deferred — engine treats it as a binary flag)
- New page `/simulator`: sliders for LDL, HbA1c, BP, weight; recompute risk in real-time using `lib/risk/scorer.ts` (depends on A1).
- Pure client-side; no new persistence.
- Out-of-range values clamped with a warning.
- Acceptance: dragging LDL from 160 to 100 visibly drops `cv_risk` in real-time.

### B7 — Out-of-range alerts & repeat-test reminders **(S, ~1 day)** — *Epic 8* — ✅ **DONE 2026-04-28** (migration `0031_member_alerts.sql`, not `0022` — chain moved)
- After a `biomarkers.lab_results` row writes, evaluate against reference ranges.
- Insert a row into a new `public.member_alerts` table (one-time migration `0022_member_alerts.sql`).
- Surface on dashboard as a small chip in the hero.
- Repeat-test reminders: cron job at `app/api/cron/repeat-tests/route.ts` reading `risk_scores.recommended_screenings` (already populated by Atlas).

---

## Workstream C — Trust + Compliance *(Epic 11)*

Member-visible legal posture. None of this needs an LLM.

### C1 — pgTAP RLS suite in CI **(S, ~1 day)** — closes BUG-008
- File: `.github/workflows/db-tests.yml`.
- Workflow steps: spin up `supabase/postgres:15` service container, apply migrations, run `pgtap` against `supabase/tests/rls.sql` (already 20 assertions written).
- Run on every PR + push to main.
- Acceptance: failing the pgTAP test blocks the PR; passing is green.

### C2 — Export-everything button **(M, ~2 days)** — ✅ **DONE 2026-04-28** (migration `0026_export_log.sql`, not `0023` — renumbered after intervening migrations)
- New route: `app/api/export/route.ts`.
- Streams a JSON archive containing: `profiles`, all `health_profiles` versions, `risk_scores` history, `supplement_plans`, `consent_records`, `biomarkers.lab_results`, `biomarkers.daily_logs`, plus a generated PDF (reuses Workstream B1).
- Stream as a single ZIP (use `archiver`) to avoid big-buffer memory.
- Surface as a button on `/account` (page exists, button doesn't).
- Audit row written to `public.export_log` (one-time migration `0023_export_log.sql`).

### C3 — "We never train on your data" ToS clause **(S, ~0.5 day)**
- File: `app/(public)/legal/terms/page.tsx` (create or edit existing).
- Add a numbered clause near the top in plain English: "Your health data is never sent to a third-party model provider for training. Inference calls to Anthropic and OpenAI use the API path explicitly excluded from training (Anthropic's Zero Data Retention; OpenAI's Enterprise no-training opt-out)."
- Cite the data-handling architecture page.
- Surface in onboarding consent step as a one-line callout linking to the section anchor.

### C4 — Right-to-erasure flow **(M, ~2 days)**
- New server action: `app/(app)/account/actions.ts::requestErasure()`.
- Confirms via email (token round-trip), then runs:
  - Anonymise `profiles` row (set `full_name='[erased]'`, `date_of_birth=null`, `phone=null`, `address_postal=null`, `is_erased=true`).
  - Cascade-delete `health_profiles`, `risk_scores`, `supplement_plans`, `biomarkers.*`, `consent_records` (last one *after* writing an erasure receipt).
  - Soft-delete `auth.users` (Supabase admin API).
- Email confirmation receipt with timestamp + serial.
- Acceptance: end-to-end Playwright test confirms a fresh user can erase and a follow-up login fails.

### C5 — Pause / freeze account **(S, ~1 day)**
- Stripe subscription pause via `pauseSubscription({behavior: 'mark_uncollectible'})`.
- Profile flag `is_paused`. While paused: dashboard shows a single "Account paused — reactivate" card and hides everything else.
- Resume button reverses both.

### C6 — Deceased flow **(S, ~1 day)** — sensitive copy
- Inbound flag set by support via admin CRM (Workstream E).
- New `is_deceased` column + `deceased_recorded_at` on `profiles`.
- All notification systems (drip emails, reminders) suppressed via predicate.
- Next-of-kin export: a copy of C2's export, sent once to the email on `profiles.next_of_kin_email` (new optional column captured during onboarding).
- Copy review by James before shipping. **Do not** use the word "deactivated" — use "we've recorded that [name] has passed away".

### C7 — Quarterly trust audit cadence **(operational, not engineering)**
- Runbook at `docs/operations/trust-audit.md` covering: log scrub for PII regressions, signed-URL TTL check, deceased-flow walk-through, RLS spot-check.
- Scheduled in James's calendar (1st of Jan/Apr/Jul/Oct).

---

## Workstream D — Platform Foundation *(Epic 14)*

Engineering substrate. Nothing user-visible; everything load-bearing.

### D1 — GitHub Actions CI workflow **(S, ~1 day)**
- File: `.github/workflows/ci.yml`.
- Jobs:
  - `typecheck` — `pnpm exec tsc --noEmit`.
  - `lint` — `pnpm exec eslint .`.
  - `test` — `pnpm test` (Vitest).
  - `build` — `pnpm build` (Next.js).
  - `pgtap` — see C1, runs in parallel.
- Cache `pnpm-store` and `.next/cache`.
- Acceptance: a PR with a TypeScript error fails CI.

### D2 — Gitleaks secret-scan **(S, ~0.5 day)** — ✅ **DONE 2026-04-28**
- File: `.github/workflows/secrets.yml`.
- Use `gitleaks/gitleaks-action@v2` on every PR.
- Provide a `.gitleaks.toml` allowlist for documentation false positives.
- Acceptance: a fake `STRIPE_SECRET_KEY=sk_live_…` in a PR fails the check.

### D3 — Sentry error monitoring **(S, ~1 day)**
- Add `@sentry/nextjs` package.
- Config: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`.
- Capture: server-action errors, route-handler 500s, client-side runtime errors (no user PII — strip cookies, headers, query strings).
- DSN in env: `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` for source-map upload.
- Acceptance: throw a test error in a server action, see it in Sentry within 60s.

### D4 — Cost-control dashboards **(S, ~0.5 day each)**
- Anthropic API spend dashboard with 80%-of-budget alert (use Anthropic console alerts; document threshold in `docs/operations/budgets.md`).
- Supabase storage quota alert (Supabase project settings → Notifications).
- Vercel function execution-time monitoring (Vercel Observability tab).

### D5 — Disaster recovery drill **(M, 1.5 days the first time)**
- Use Supabase point-in-time restore to a fresh project from yesterday's snapshot.
- Apply migrations.
- Smoke-test signup, onboarding, daily check-in, supplement load.
- Document timing + each step in `docs/operations/dr-runbook.md`.
- Schedule recurring quarterly drill.

### D6 — Production-readiness checklist **(S, ~0.5 day)**
- File: `docs/operations/checklist.md`.
- Check items: auth ✓, RLS ✓, idempotent migration ✓, observable (errors → Sentry) ✓, has tests ✓, doc updated ✓, no PII in logs ✓.
- Linked from PR template (`.github/pull_request_template.md`).

### D7 — AHPRA breach-notification protocol **(S, ~1 day)** — document only
- File: `docs/operations/breach-protocol.md`.
- Steps: detect, contain, notify OAIC (within 30 days for notifiable breaches), notify affected members, regulatory follow-up.
- Sign-off by James + legal.

### D8 — Dependency hygiene **(S, ~0.5 day)**
- Enable Dependabot in `.github/dependabot.yml` (npm + GitHub Actions ecosystems, weekly).
- Add a `pnpm audit` step to D1's CI workflow.
- Document the "new dependency requires PR-description justification" rule in `.claude/rules/database.md` (or a new `dependencies.md`).

---

## Workstream E — Distribution *(Epic 12)*

Admin and corporate surfaces. Builds revenue capacity.

### E1 — Admin CRM dashboard **(M, ~2 days)**
- File: `app/(admin)/admin/page.tsx` (currently a stub).
- Single-screen view: MRR (sum of active subscription `unit_amount`), active members count, churn (cancelled in last 30 days), pipeline runs in last 24h (count from `risk_scores.computed_at`).
- Six small tiles, one query each, all parallelised with `Promise.all`.
- Date-range filter: `7d / 30d / quarter / all`.
- Server component; no client interactivity needed for v1.

### E2 — Corporate account management **(L, ~5 days)**
- New tables (migration `0024_corporate.sql`):
  - `billing.organisations` (already exists from `0013_billing_schema.sql` — extend if needed).
  - `billing.organisation_members` (ditto).
- New admin pages:
  - `app/(admin)/admin/orgs/page.tsx` — list.
  - `app/(admin)/admin/orgs/[id]/page.tsx` — detail with employee CSV upload, invitation send, aggregate-only health summary (no individual PII).
- Email templates for invitations under `lib/email/`.
- Per-employee onboarding link with org-stamp (via signed JWT in URL).
- Acceptance: upload a 200-employee CSV, all receive invitations within 5 minutes (Stripe rate limit and Resend rate limit comfortably handle this).

### E3 — Pricing tiers wired to entitlements **(M, ~2 days)**
- Stripe products: Individual / Family / Clinical / Corporate.
- New `billing.entitlements` table mapping `subscription_id → feature_flag[]`.
- Read entitlements in server components; gate features (e.g. PDF download requires `feature='pdf'`).
- Acceptance: a Family-tier member can add 4 dependants; an Individual member cannot.

### E4 — Sign-in-with-Vercel for clinician partners **(S, ~1 day)**
- Add Vercel OAuth provider in Supabase Auth settings.
- New onboarding path `/clinician-signup` that gates on email-domain whitelist.
- Acceptance: a `@longevitycoach.com.au` email signs in via Vercel and lands on `/clinician/dashboard` (Workstream F).

### E5 — Supplement marketplace **(L, ~5 days)** — depends on Workstream A2
- New page `/marketplace` listing items from `supplement_catalog` with auto-replenish add-to-cart.
- Stripe Connect destination charges (per-supplier split).
- Order persisted in new `billing.supplement_orders` table.
- Members can re-order from their `/report` supplement table with one tap.

---

## Workstream F — Care Network *(Epic 9)*

Clinician-facing surfaces. Schema is shipped; UI is unbuilt.

### F1 — Clinician role assignment **(S, ~1 day)**
- Server action: only an `is_admin` profile can promote another profile to `role='clinician'`.
- Audit row written to `public.role_changes` (one-time migration `0025_role_changes.sql`).

### F2 — Clinician portal **(L, ~5 days)**
- New route group: `app/(clinician)/`.
- Pages:
  - `/clinician/dashboard` — list of assigned patients (read `patient_assignments`).
  - `/clinician/patients/[id]` — full read-only patient view: profile, risk scores, narrative, supplement plan, recent labs, recent check-ins, care notes.
- All reads go through the user-context Supabase client; RLS enforces `patient_assignments` permissions.

### F3 — Care-team invitation flow **(M, ~2 days)**
- Patient-side: "Invite my GP" form → captures clinician email + name.
- Sends email with a signed-token link.
- Clinician follows link → if not registered, prompts for `/clinician-signup` (Workstream E4); if registered, auto-creates `patient_assignments` row.
- Patient can revoke at any time from `/account/care-team`.

### F4 — Clinical notes UI **(M, ~2 days)**
- Read/write UI on `/clinician/patients/[id]/notes` against `clinical.care_notes` (table exists).
- Notes are private to the care team — RLS denies the patient's own client.
- Audit trail mandatory; notes append-only.

### F5 — In-platform appointment booking **(L, ~3 days)**
- New table `clinical.appointments` already exists.
- Calendar UI: clinician sets availability, patient picks a slot.
- Stripe charge captured at booking; refund policy on cancellation.
- Calendar invites via .ics email.

### F6 — Periodic-review record UI **(S, ~1 day)**
- Form on `/clinician/patients/[id]/review` writes to `clinical.periodic_reviews`.
- Quarterly cadence; clinician fills out structured fields (blood pressure, weight, etc.) plus free-text summary.

---

## Critical path & dependencies

```
A1 (risk engine) ────► A2 (supplement catalog) ────► E5 (marketplace)
                                                ╲
A1 ────► B1 (PDF) ────► C2 (export bundle)       ╲──► B6 (simulator)
A1 ────► B7 (alerts)                              ╲
                                                   ╲
B4 (lab UI) ─────► B5 (daily-log charts) ──────────►
                                                    ╲
C1 (pgTAP CI) ──► D1 (CI workflow) ──► D2 (gitleaks) ──► D3 (Sentry)
                                                          ╲
                                                           ╲──► D5 (DR drill)

E1 (admin CRM) ──► E2 (corporate) ──► E3 (entitlements)
                                       │
                                       ╲──► E4 (Vercel OAuth)
                                            │
                                            ╲──► F1 (clinician role) ──► F2 (portal)
                                                                          │
                                                                          ╲──► F3, F4, F5, F6
```

**Single biggest unlock:** A1 (deterministic risk engine port). It feeds B1 (PDF can claim clinical defensibility), B6 (simulator), B7 (alerts), and the supplement catalog (A2 → E5).

**Biggest infrastructure-side unlock:** D1 (CI workflow). Once CI runs, every other workstream gets free regression coverage.

---

## Recommended execution sequence

If one engineer is on this full-time, in priority order:

1. **A1 — Port the risk engine** (3 days). Largest leverage; everything clinical sits downstream.
2. **C1 + D1 — pgTAP in CI + GitHub Actions workflow** (1.5 days). Cheap insurance going forward.
3. **B1 — Branded PDF** (2 days). Highest member-perception value; A1 unlocks the bio-age and risk numbers it'll display.
4. **A2 — Supplement catalog** (2 days). Sage's quality jumps once it's reading deterministic items.
5. **B2 + B3 — Steps/water + streak dots** (1 day). Low-hanging Epic 7 wins; today's work asks for them.
6. **C2 — Export bundle** (2 days). Trust-layer headline feature.
7. **D2 + D3 — Gitleaks + Sentry** (1.5 days). Production-readiness baseline.
8. **B4 + B5 — Lab UI + daily-log charts** (3 days). Unlocks Epic 8 from 5% to ~50%.
9. **E1 — Admin CRM** (2 days). James gets visibility into the business.
10. **C4 + C5 + C6 — Erasure + pause + deceased** (4 days). Trust posture complete.

**Total to here:** ~22 working days. Halfway between Phase 2 and Phase 3 deliverables.

After that, pick from Workstream E (corporate, marketplace) or Workstream F (clinician portal) depending on which revenue stream comes online first.

---

## Definition of done — per workstream

A workstream is "done" when:

1. Every item has shipped behind a feature flag if user-visible, or fully cut over if backend.
2. Every shipped item has at least one Vitest test or one Playwright spec.
3. Every shipped item with new database state has a migration that re-runs cleanly on a fresh database.
4. The relevant Epic in `docs/product/epic-status.md` is updated to reflect the new state.
5. A short note is added to `docs/engineering/changes/` summarising the change.
6. CI is green.

---

## What this plan does *not* cover

- **Atlas, Sage, Janet narrative quality** — that's the AI track.
- **Nova / RAG / pgvector / health_knowledge ingestion** — that's the AI track.
- **Sub-agent tool_use coordination, prompt caching, conversation memory** — AI track.
- **Embedding model selection, vector index tuning** — AI track.
- **The Anthropic console budget alert thresholds** — D4 documents the protocol but the threshold values are an AI-track decision.
- **GP-panel review of narrative quality** — A3 schedules it but the panel's verdict feeds back into the AI track's prompt work, not this plan.

---

## When this plan is finished, where are we?

- Epic 1: 95 → 100% (user review will have happened).
- Epic 2: 85 → 90% (E2E Playwright onboarding spec lands as part of Workstream B test work).
- Epic 3: 50 → **80%** via A1 alone.
- Epic 4: 50 → **75%** via A2 (Sage gets the catalog).
- Epic 5: 35 → **75%** via B1.
- Epic 7: 55 → **75%** via B2 + B3 + B7.
- Epic 8: 5 → **55%** via B4 + B5 + B6.
- Epic 9: 5 → **65%** if Workstream F lands.
- Epic 11: 55 → **90%** via C1 + C2 + C3 + C4 + C5 + C6 + C7.
- Epic 12: 5 → **60%** via E1 + E2 + E3 + E4.
- Epic 13: 0 → 30% (E5 partial; full Stripe Connect catalog stays Phase 6).
- Epic 14: 40 → **85%** via D1–D8.

Two epics still need the AI track to advance further: **Epic 6 (Coach)** and **Epic 10 (Knowledge Engine)**. Everything else is meaningfully unblocked by this plan.
