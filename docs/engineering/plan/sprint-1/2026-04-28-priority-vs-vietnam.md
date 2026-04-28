# Priority Map: Non-AI Workstreams vs Vietnam Sprint Plan

**Drafted:** 2026-04-28
**Cross-references:**
- [Vietnam Sprint Plan](./vietnam-sprint-plan.md) — the original 5-day MVP definition
- [Non-AI Workstreams Plan](./2026-04-28-plan-non-ai.md) — the full remaining-work breakdown

---

## Why this document exists

The Vietnam sprint defined the **MVP as 7 workflows** that have to work end-to-end on production. The non-AI plan I just drafted covers everything left to do — but it doesn't tell you what's still in the MVP gap and what's beyond it.

This document maps every item in the non-AI plan to one of three priorities:

- **P0** — Inside the original Vietnam MVP scope and still outstanding. **Ship before anything else.**
- **P1** — Not in the MVP, but adjacent infrastructure or polish that should land in the same phase as the P0s.
- **P2** — Beyond the MVP. Phase 3+ work, valuable but deferrable.

---

## Vietnam MVP status — workflow by workflow

| # | Workflow | Status | Outstanding (non-AI) |
|---|---|---|---|
| 1 | Discovery → Sign-up | ✅ shipped | — |
| 2 | Onboarding questionnaire | ✅ shipped | — |
| 3 | Risk scoring (5 domains + bio-age) | ⚠️ LLM-only | **A1** — port deterministic engine, unit tests verifying parity with Base44 |
| 4 | Supplement protocol + branded PDF | ⚠️ LLM-only + skeleton PDF | **A2** + **B1** — deterministic catalog + branded PDF report |
| 5 | Consumer dashboard | ✅ shipped today | — |
| 6 | Welcome email | ✅ shipped | — |
| 7 | Admin CRM | ⚠️ stub | **E1** — MRR, active members, churn, pipeline runs |

Plus the patient data architecture (Vietnam Part 2):

| Item | Status | Outstanding |
|---|---|---|
| Supabase RLS at DB level | ✅ shipped | — |
| Audit log (consent records, append-only) | ✅ shipped | — |
| AI/LLM never sees PII | ✅ shipped (PII split at write time) | — |
| **RLS regression test suite** | ⚠️ written, not in CI | **C1** — pgTAP suite into CI |
| Supabase Vault for identifier encryption | ⚠️ not shipped | Out of scope here (handled in Phase 4 hardening) |

---

## P0 — Inside the Vietnam MVP, still outstanding

These five items finish the MVP. Until they ship, the original sprint Definition of Done is not met.

### P0-1 · Port deterministic risk engine *(A1)*
- **Why P0:** Vietnam Day 2 spec — "Risk engine port from Base44: CV / Metabolic / Neuro / Onco / MSK + bio-age + unit tests verifying parity with Base44". Currently every risk score is LLM-derived with `confidence_level='moderate'`. Vietnam's risk #2 explicitly flagged this: "Risk engine port more complex than expected — port on Day 2, not Day 3."
- **Effort:** L (~3 days)
- **Files:** `lib/risk/{cardiovascular,metabolic,neurodegenerative,oncological,musculoskeletal,biological-age,scorer}.ts`
- **Tests:** ≥ 18 Vitest cases across 5 domains + bio-age, plus 5 fixture profiles + snapshot tests.
- **Acceptance:** New `risk_scores` rows show `confidence_level='high'`; coverage on `lib/risk/` ≥ 90%.

### P0-2 · Build deterministic supplement catalog *(A2)*
- **Why P0:** Vietnam Day 3 spec — "Map risk profile inputs → supplement recommendations + Port Base44 supplement logic, verify output parity". Currently Sage's items are LLM-generated free-text.
- **Effort:** M (~2 days)
- **Files:** migration `0021_supplement_catalog.sql`, seed `supabase/seeds/supplement_catalog.sql` (~40 items), helper `lib/supplements/catalog.ts::recommendFromRisk()`.
- **Acceptance:** Catalog seeded with ≥ 40 evidence-tagged items; deterministic snapshot tests pass.

### P0-3 · Branded PDF report *(B1)*
- **Why P0:** Vietnam Day 3 spec — "Branded PDF generation: User's bio-age, risk scores, supplement list, dosing instructions + Work Healthy / Longevity Coach branding + Download button on dashboard". The route exists at `/api/report/pdf` but renders an unstyled skeleton.
- **Effort:** M (~2 days)
- **Depends on:** A1 (the bio-age and risk numbers must be defensible before printing them on a clinical-looking document).
- **Files:** `lib/pdf/report-doc.tsx`.
- **Acceptance:** A4 PDF with cover, scoring grid, supplement table, narrative, footer; opens cleanly in Acrobat; one printed test against a real printer.

### P0-4 · pgTAP RLS suite into CI *(C1)*
- **Why P0:** Vietnam Part 2 explicit rule — "Test RLS policies with dedicated test suite. Never change policies without running tests." Suite is written (`supabase/tests/rls.sql`, 20 assertions) but not enforced in CI. BUG-008 currently open.
- **Effort:** S (~1 day)
- **Depends on:** D1 (need a CI workflow to run inside).
- **Files:** `.github/workflows/db-tests.yml`.
- **Acceptance:** Failing the pgTAP test blocks the PR; passing is green on every push.

### P0-5 · Admin CRM dashboard *(E1)*
- **Why P0:** Vietnam Day 4 spec — "Admin CRM panel: User list with subscription status, signup date, plan tier; Basic analytics: total users, MRR, trial conversion rate". User list + user detail pages already exist; the analytics dashboard at `/admin` is a stub.
- **Effort:** M (~2 days)
- **Files:** `app/(admin)/admin/page.tsx`.
- **Acceptance:** Single-screen view with MRR, active members, churn (last 30d), pipeline runs (last 24h); date-range filter `7d/30d/quarter/all`.

---

## P1 — Adjacent infrastructure & sprint-wave polish

Not strictly inside the MVP but should land in the same wave as the P0s. Without these, the P0s are fragile or the platform isn't production-grade.

### P1-1 · GitHub Actions CI workflow *(D1)*
- **Why P1:** Vietnam Definition of Done says "deployed to production with SSL, Vercel monitoring, Supabase backups active". Without CI, every PR is a manual smoke test. P0-4 (pgTAP) needs CI to run inside.
- **Effort:** S (~1 day)
- **Files:** `.github/workflows/ci.yml`.
- **Acceptance:** Every PR runs typecheck + lint + Vitest + Next build + pgTAP.

### P1-2 · Gitleaks secret scanning *(D2)* — ✅ **DONE 2026-04-28**
- **Why P1:** Vietnam Part 2: "No PII in logs — ensure Next.js server logs and Vercel logs are scrubbed of identifier fields." Gitleaks catches accidental secrets in code. Cheap to enable once D1 is live.
- **Effort:** S (~0.5 day)
- **Depends on:** D1.
- **Shipped:** `.github/workflows/secrets.yml` + `.gitleaks.toml`.

### P1-3 · Sentry error monitoring *(D3)*
- **Why P1:** Vietnam DoD calls for "Vercel monitoring" — Sentry is the proper layer above that. Without it we don't see production errors until a user complains.
- **Effort:** S (~1 day)

### P1-4 · Steps + water fields in check-in *(B2)* — ✅ **DONE 2026-04-28**
- **Why P1:** Today's dashboard shows step and water tiles with `—` because the form doesn't capture them yet. Half a day to close.
- **Effort:** S (~0.5 day)
- **Shipped:** `parseCheckInForm()` + form inputs + 6 unit tests; dashboard tiles populate from real data.

### P1-5 · Mon-Sun streak dot UI *(B3)* — ✅ **DONE 2026-04-28**
- **Why P1:** The streak hero is the strongest daily-return hook. The dots make the streak tangible.
- **Effort:** S (~0.5 day)
- **Shipped:** `streakDots()` helper + dashboard hero strip + 6 unit tests.

### P1-6 · Export-everything button *(C2)* — ✅ **DONE 2026-04-28**
- **Why P1:** Vietnam doesn't list this but the AHPRA / privacy posture in Part 2 strongly implies it. High trust-layer value; members increasingly expect data portability.
- **Effort:** M (~2 days)
- **Shipped:** `GET /api/export` ZIP route + `/account` page + migration `0026_export_log.sql` (numbered after the P0 supplement-catalog work) + 4 unit tests. Note: original spec said `0023`; actual was `0026` due to intervening migrations.

---

## P2 — Beyond the sprint

Valuable but deferrable. Pick up after the P0+P1 wave.

### Member surfaces (Epic 7, 8)
- B4 · Lab results UI *(M)*
- B5 · Daily-log charts *(S)*
- B6 · Risk simulator *(M)*
- B7 · Out-of-range alerts + repeat-test reminders *(S)*

### Trust + compliance (Epic 11)
- C3 · "We never train on your data" ToS clause *(S)*
- C4 · Right-to-erasure flow *(M)*
- C5 · Pause / freeze account *(S)*
- C6 · Deceased flow *(S)*
- C7 · Quarterly trust audit cadence *(operational)*

### Platform foundation (Epic 14)
- D4 · Cost-control dashboards *(S)*
- D5 · Disaster-recovery drill *(M)*
- D6 · Production-readiness checklist *(S)*
- D7 · AHPRA breach-notification protocol *(S, doc only)*
- D8 · Dependency hygiene *(S)*

### Distribution (Epic 12)
- E2 · Corporate account management *(L)*
- E3 · Pricing tiers wired to entitlements *(M)*
- E4 · Sign-in-with-Vercel for clinicians *(S)*
- E5 · Supplement marketplace *(L)* — depends on A2

### Care Network (Epic 9)
- F1–F6 · Clinician role + portal + invitations + notes + appointments + reviews *(L total ~14 days)*

---

## Critical path through P0 + P1

```
A1 (risk engine port) ───────────────────┐
                                         │
                                         ▼
                                   B1 (branded PDF)
                                         │
A2 (supplement catalog) ────────────────►┤
                                         │
                                         ▼
                                  P0 wave complete
                                         │
D1 (CI workflow) ───► C1 (pgTAP CI)      │
       │                                 │
       ▼                                 │
   D2 (gitleaks)                         │
       │                                 │
       ▼                                 │
   D3 (Sentry)                           │
                                         │
                                         ▼
                              P0 + P1 infra complete
                                         │
                                         ▼
       B2 (steps/water) + B3 (streak dots) + C2 (export) + E1 (admin CRM)
```

**A1 is the single most upstream P0.** Everything clinical (B1, B6, B7, supplement quality via A2) sits behind it.

**D1 is the single most upstream P1.** It enables C1 (P0) and protects everything else from regression.

---

## Recommended execution sequence (next 5 working days)

A roughly Vietnam-shaped one-engineer sequence. Each day produces something demoable.

| Day | Item(s) | Effort | Output |
|---|---|---|---|
| 1 | **A1 — Risk engine port (start)** + D1 (CI workflow) | full day | New `lib/risk/` skeleton + cardiovascular module + 1st CI run green |
| 2 | **A1 — Risk engine port (finish)** + per-domain unit tests | full day | All five domains + bio-age + ≥18 unit tests passing |
| 3 | **A2 — Supplement catalog** + seed | full day | Migration applied, 40 items seeded, `recommendFromRisk()` deterministic |
| 4 | **B1 — Branded PDF** | full day | Cover, score grid, supplement table, narrative, footer |
| 5 | **C1 — pgTAP in CI** + **E1 — Admin CRM** + **D3 — Sentry** | full day | RLS regression coverage, MRR/active/churn dashboard, prod errors visible |

End of day 5: Vietnam MVP is **fully met** for the non-AI track. P0 wave done.

Working days 6–10 then pick up the P1 polish (B2, B3, C2, D2) and start P2 selectively based on what James prioritises (likely Epic 8 lab UI for clinical depth or Epic 12 admin/corporate for revenue).

---

## What this changes about today's status

Updating Epic 7 (Daily Return) to 55% was correct, but the *bigger* number is: **P0-1 (A1) is the single largest blocker on the project's MVP definition**. It's been slowly buried under Atlas/Sage shipping (which are agent work) and the dashboard rebuild (which is UI).

Until A1 ships:
- Every Vietnam-MVP definition-of-done item involving a risk number is technically incomplete.
- The branded PDF in P0-3 will print LLM-derived numbers, which weakens the clinical story.
- BUG-003 stays open.
- GP-panel review is blocked.

If only one thing happens next week, it should be **A1**.

---

## Definition of done — for the P0 wave

The P0 wave is done when:

1. A new member completes onboarding and receives risk scores marked `confidence_level='high'` (A1).
2. Their supplement protocol items match deterministic catalog rules, not just LLM output (A2).
3. They can download a branded PDF that prints cleanly and looks like a clinical document (B1).
4. James can log in to `/admin` and see today's MRR, active member count, churn over the last 30 days, and pipeline runs in the last 24 hours (E1).
5. Every PR merging into `main` runs the pgTAP RLS suite in CI; a failing assertion blocks the merge (C1).

When all five are true, the original Vietnam Definition of Done is met for the non-AI track.
