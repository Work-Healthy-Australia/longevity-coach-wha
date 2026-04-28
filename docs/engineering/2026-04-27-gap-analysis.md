# Longevity Coach - Functionality Gap Analysis
# 2026-04-27

**Reference:** Base44 repo at `/Applications/E8/client/base-44-longevity-coach/`
**Target:** New build at `longevity-coach-wha/`
**Analyst:** Claude Code

---

## Status summary

| Area | Status | Notes |
|---|---|---|
| Auth (login / signup / verify / reset) | ✅ Complete | All flows, server actions, route protection via `proxy.ts` |
| Onboarding questionnaire — 6 steps | ✅ Complete | Schema-driven; fields match Base44 |
| Stripe checkout + webhook | ✅ Complete | Both API routes live; UI not wired; price IDs are env stubs |
| Welcome email (fire on confirm) | ⚠️ Partial | Sends correctly; idempotency is a 60 s time window, not a DB flag — double-click = two emails |
| Marketing pages (/, /science, /team, /stories, /sample-report) | ✅ Complete | All live |
| Logged-in nav | ❌ Missing | Header has only logo + sign-out; no Dashboard / Report / Account links |
| `/report` page | ❌ Missing | Route does not exist |
| `/account` page | ❌ Missing | Route does not exist |
| Risk engine (5 domains + bio-age) | ❌ Not started | `base44/functions/riskEngine/entry.ts` (1231 lines) not ported; `lib/risk/` is `.gitkeep` |
| Risk engine invocation on submit | ❌ Not started | `submitAssessment` saves the questionnaire but never calls the engine |
| Supplement protocol generator | ❌ Not started | `lib/supplements/` does not exist |
| Branded PDF export | ❌ Not started | `lib/pdf/` is `.gitkeep`; no route |
| Admin CRM | ❌ Not started | `app/(admin)/` is `.gitkeep` |
| Drip email sequence | ❌ Not started | `base44/functions/triggerEmailSequence/` not ported |
| File uploads (blood / imaging / genetic) | ❌ Blocked | Needs Supabase Storage bucket + RLS + James sign-off on MVP scope |

---

## Database gap

Existing tables: `profiles`, `health_profiles`, `risk_scores`, `subscriptions`.

Missing / insufficient columns:

| Table | Missing column | Reason needed |
|---|---|---|
| `profiles` | `welcome_email_sent_at timestamptz` | Idempotent welcome-email gate |
| `risk_scores` | `engine_output jsonb` | Store full engine result (top_risks, trajectory, completeness) for report page |
| `risk_scores` | `supplements_json jsonb` | Store generated supplement protocol alongside its risk assessment |

---

## API / route gap

Existing: `POST /api/stripe/checkout`, `POST /api/stripe/webhook`, `GET /auth/callback`

Missing:

| Route | Purpose |
|---|---|
| `GET /api/report/pdf` | Stream branded PDF for authenticated user |

---

## James-blocked items (unchanged from sprint plan)

- File uploads (blood, imaging, genetic, microbiome, hormonal)
- Stripe price IDs (real values from Stripe dashboard)
- Family-history sub-fields (age of onset, cancer types)
- Branded PDF final spec (colors / fonts beyond logo)
- Landing + sub-page copy review
- Admin CRM (low value until data flows)

---

## Risk engine note

The Base44 `riskEngine/entry.ts` contains 1231 lines of pure arithmetic (no external library dependencies beyond the Deno/Base44 wrapper). All five scoring functions (`scoreCardiovascular`, `scoreMetabolic`, `scoreNeurodegenerative`, `scoreOncological`, `scoreMusculoskeletal`) plus the bio-age estimator are self-contained. They can be ported by:

1. Stripping the `npm:@base44/sdk` import and the `Deno.serve()` wrapper
2. Adding TypeScript interfaces for `PatientData` and `EngineResult`
3. Writing an adapter that maps our `health_profiles.responses` JSONB shape to the `PatientData` object

The lifestyle-only path (no biomarkers) will run immediately. It will return mostly 50 scores for biomarker-dependent factors — that's expected and documented. The plumbing is what matters for MVP.

The Base44 `analyzePersonalizedRisks/entry.ts` (LLM narrative via an agent conversation) is a **separate concern** from the deterministic engine. For MVP, the deterministic engine alone is sufficient for the report page.

---

## Supplement protocol note

Base44 `generate30DaySupplementList/entry.ts` reads from a `Supplement` entity in the Base44 database — a dynamic list presumably populated by the `supplement_advisor` LLM agent. In the new build there is no equivalent entity store.

Recommended MVP approach: a deterministic rules-based generator (`lib/supplements/protocol.ts`) that maps domain risk scores to a curated catalog of ~15 evidence-backed supplements. No LLM required. Covers the MVP "personalised supplement protocol" requirement. LLM-enhanced generation can be added later via `lib/ai/` once the Anthropic API key is wired.
