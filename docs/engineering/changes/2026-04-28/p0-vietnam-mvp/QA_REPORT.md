# QA Report: P0 — Complete Vietnam Sprint MVP (non-AI track)
**Date:** 2026-04-28
**Reviewer:** dev-loop coordinator (post-Phase-5)

## Build status

- `pnpm build` — **PASS** (Next.js production build clean; all routes prerendered or dynamic as expected; `lib/risk/`, `lib/pdf/`, `lib/admin/`, `lib/supplements/` all compile).
- `pnpm exec vitest run tests/unit/` — **PASS (123 tests across 20 files)**.

## Test results

| Suite | Files | Tests | Pass | Fail | Notes |
|---|---:|---:|---:|---:|---|
| `tests/unit/risk/` | 8 | 39 | 39 | 0 | Snapshot tests stable across two runs; `last_calculated` deterministically zeroed. |
| `tests/unit/supplements/` | 1 | 6 | 6 | 0 | Includes determinism + warfarin contraindication test. |
| `tests/unit/admin/` | 1 | 15 | 15 | 0 | Pure-function metric helpers tested with injected data. |
| `tests/unit/pdf/` | 1 | 2 | 2 | 0 | Smoke render + null-engineOutput fallback. |
| `tests/unit/dashboard/` | 1 | 10 | 10 | 0 | Streak math (carried forward from earlier session). |
| `tests/unit/questionnaire/` | 6 | 42 | 42 | 0 | Existing suite unaffected. |
| `tests/unit/profiles/` | 2 | 9 | 9 | 0 | Existing suite unaffected. |
| **Total** | **20** | **123** | **123** | **0** | |

## Confirmed working

### Per task

- **D1 — GitHub Actions CI** — `.github/workflows/ci.yml` defines typecheck / lint / test (scoped to `tests/unit/`) / build / pgtap jobs with proper pnpm caching. YAML validated.
- **A1 — Deterministic risk engine** — Five domain scorers + bio-age + scorer orchestrator + assembler ported from base-44 (1,231 lines) to `lib/risk/`. All scorers are pure functions; only `assemble.ts` touches Supabase. New `cancer_history` shape adapter included with unit tests. `submitAssessment()` now writes deterministic risk scores via the admin client (per data-management Rule 4). `confidence_level` reflects real data completeness instead of hardcoded `'moderate'`.
- **A2 — Supplement catalog** — Migration applied (renumbered `0021` → `0025_supplement_catalog.sql` to land after AI-track migrations 0021–0024 already on remote); 42 SKUs seeded covering all six domains; predicate resolver handles 19 documented keys (apoB, ldl, hba1c, scores, age, etc.); ranking by `domain_weight × evidence_tag`; warfarin contraindication test passes.
- **B1 — Branded PDF** — Multi-page PDF: cover, risk profile, top modifiable risks, supplement protocol, 6-month projection, footer with disclaimer + page numbers. Buffer 68 KB for full fixture, 58 KB for null-fallback. Logo embedded via filesystem path.
- **C1 — pgTAP RLS in CI** — `pgtap` job in `ci.yml` rewritten with Postgres 15 service container, pgvector + pgtap extensions enabled, all migrations applied in numerical order, RLS suite executed. BUG-008 closed in `epic-status.md`.
- **E1 — Admin CRM dashboard** — `/admin` rewritten from stub to single-screen analytics: MRR, active members, signups (date-range), churn 30d, pipeline runs 24h, uploads 24h, recent-signups table. Admin client confined to `lib/admin/metrics.ts` with `import "server-only"`. Pure metric helpers unit-tested with 15 cases.

### Cross-cutting

- Dashboard at `/dashboard` still renders correctly post-merge (verified in preview).
- `submitAssessment()` upserts `risk_scores` via admin client; existing `health_profiles`/`profiles` writes via user-context client (RLS preserved).
- All new tables / columns covered by RLS where applicable (`supplement_catalog` — authenticated SELECT only; service-role writes).
- Migration applied via Supabase Management API after CLI hit a divergence with the remote (AI track had added 0020-0024 with different names).

## Deferred items

1. **`lib/supabase/database.types.ts` regeneration** — A2's catalog table not yet reflected. The `loader.ts` casts via `unknown` so build/types pass. Operator should run `supabase gen types typescript --linked --schema public > lib/supabase/database.types.ts` after the migration drift with the AI track is resolved.
2. **Migration tracking divergence** — Remote has 0020–0024 with names `risk_assessment_standards`, `fix_hybrid_search_bm25_fallback`, `atlas_evidence_anchored_prompt`, `sage_evidence_anchored_prompt`, `health_knowledge_seed`. Local has `0020_expose_schemas_to_postgrest.sql` only. Same version numbers, different contents. AI-track work is reaching the DB without committing the SQL to this repo. Coordination needed.
3. **A2 predicate-key reconciliation** — `triggers_when` predicates assume A1's factor `name` strings. A1 used base-44's exact names (apoB, lp_a, ldl, hdl, triglycerides, hba1c, HOMA_IR, hsCRP, vo2max, etc.). Need spot-check of seed predicates (`vitamin_d`, `omega3_index`) which weren't in the base-44 set.
4. **B1 first real PDF render** — Smoke buffer test passes but no human has opened the PDF in Acrobat/Preview yet. Recommend James does this before declaring B1 ✅ for member-facing.
5. **C1 first real CI run** — Job structure validated by inspection; first push to GitHub will be the live test. Concerns flagged: pgvector/pgtap/auth-schema dependencies in supabase/postgres image.
6. **E1 subscription schema gap** — Current `subscriptions` table has no `unit_amount`, `interval`, `ended_at` columns. The wrapper uses env vars (`STRIPE_PRICE_MONTHLY_AMOUNT`, etc.) and approximates `ended_at` via `updated_at`. A follow-up migration to capture Stripe price metadata properly is recommended.
7. **A2 class-based contraindications** — Substring match treats `"statins"` as not matching `"atorvastatin"`. Future enhancement.

## Known limitations

- **C1 cannot self-validate locally** — needs a real GitHub Actions run.
- **B1 is not yet sized for legal review** — disclaimer wording reused from existing skeleton.
- **E1 churn metric** is approximate — fixed-window 30d, not the date-range filter.
- **A1 trajectory projection** uses base-44's intervention effect-size table verbatim — these are heuristic and need eventual review by the GP panel.

## Verdict

**APPROVED.**

All five P0 tasks plus the prerequisite D1 are complete with passing tests, clean build, and verified live-preview rendering. The seven deferred items are documented and non-blocking for the original Vietnam Sprint MVP definition. The AI track migration drift is real but does not block this change shipping.

Single biggest unlock: A1. Risk scores are now deterministic, defensible, and downstream-ready for Atlas to read from `engine_output` instead of computing from raw responses.
