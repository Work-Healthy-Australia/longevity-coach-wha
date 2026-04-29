# Changelog: P0 — Complete Vietnam Sprint MVP (non-AI track)
**Date:** 2026-04-28
**Phase:** 2 (Intelligence) + slice of 1 (Foundation hardening)

## What was built

### Deterministic risk engine *(Epic 3)*
- `lib/risk/` module: types, five domain scorers (cardiovascular, metabolic, neurodegenerative, oncological, musculoskeletal), biological-age estimator, scorer orchestrator, intervention-effect-size table, trajectory projection, dynamic weight adjustment, score-confidence helper.
- `lib/risk/assemble.ts` — pulls patient input from `profiles` + `health_profiles.responses` + `biomarkers.lab_results` + `biomarkers.daily_logs`. Includes `cancer_history` adapter from the new structured questionnaire shape to base-44's `family_history.cancer` shape.
- `lib/risk/index.ts` — barrel export. Hand-off contract for the AI track (Atlas pipeline).
- `submitAssessment()` server action now calls the deterministic scorer and writes via the admin client. `risk_scores.confidence_level` reflects real data completeness instead of the hardcoded `'moderate'`.

### Supplement catalog *(Epic 4)*
- New table `public.supplement_catalog` (migration `0025_supplement_catalog.sql`) — 42 evidence-tagged items seeded, six domains covered.
- `lib/supplements/catalog.ts` — pure `recommendFromRisk()` with documented predicate-key resolver (19 keys). Filtering by contraindications, ranking by `domain_weight × evidence_tag`.
- `lib/supplements/loader.ts` — Supabase fetch helper.

### Branded PDF report *(Epic 5)*
- `lib/pdf/report-doc.tsx` rewrite — six-page A4 document: cover, risk profile, top modifiable risks, supplement protocol, six-month projection, footer with disclaimer + page numbers.
- `lib/pdf/styles.ts` — shared palette and styles.
- `app/api/report/pdf/route.tsx` — reads full `engine_output` JSON, profile, supplement plan; renders via `renderToBuffer`.
- Logo embedded from `docs/brand/longevity-coach-horizontal-logo.png`.

### Admin CRM dashboard *(Epic 12)*
- `app/(admin)/admin/page.tsx` — server component with six metric tiles (MRR, active members, new signups, churn 30d, pipeline runs 24h, uploads 24h) plus recent-signups table.
- `lib/admin/metrics.ts` — `import "server-only"`. Pure helpers + `getDashboardMetrics(range)` wrapper. Admin-client usage confined here.
- Date-range filter via URL search param (`?range=7d|30d|quarter|all`).

### Trust regression coverage *(Epic 11)*
- `.github/workflows/ci.yml` `pgtap` job: Postgres 15 service container, pgvector + pgtap enabled, migrations applied in numerical order, `supabase/tests/rls.sql` executed.
- BUG-008 closed in `docs/product/epic-status.md`.

### Platform foundation *(Epic 14)*
- `.github/workflows/ci.yml` (new) — typecheck, lint, unit tests (scoped to `tests/unit/`), build, pgtap. Triggers on every PR and push to main.

## What changed

### New files
- `.github/workflows/ci.yml`
- `lib/risk/` — 11 files (types, 5 domain scorers, bio-age, scorer, scorer-utils, assemble, index)
- `lib/supplements/catalog.ts`, `lib/supplements/loader.ts`
- `lib/admin/metrics.ts`
- `lib/pdf/styles.ts`
- `tests/fixtures/risk-profiles.ts`
- `tests/unit/risk/` — 8 test files (39 tests)
- `tests/unit/supplements/catalog.test.ts` (6 tests)
- `tests/unit/admin/metrics.test.ts` (15 tests)
- `tests/unit/pdf/report-doc.test.tsx` (2 tests)
- `tests/stubs/server-only.ts`
- `supabase/migrations/0025_supplement_catalog.sql`
- `supabase/seeds/supplement_catalog.sql`

### Modified files
- `app/(app)/onboarding/actions.ts` — `submitAssessment()` calls deterministic scorer + admin-client `risk_scores` upsert
- `app/(admin)/admin/page.tsx` — full rewrite from stub to analytics dashboard
- `app/(admin)/admin.css` — new `admin-overview-*` and `admin-metric-*` classes
- `lib/pdf/report-doc.tsx` — full rewrite from skeleton
- `app/api/report/pdf/route.tsx` — pass full engine_output instead of cherry-picked columns
- `tests/setup.ts` — `vi.mock("server-only")`
- `vitest.config.ts` — alias `server-only` → stub
- `docs/product/epic-status.md` — BUG-008 closed; Epic 11 row updated
- `app/(public)/home.css` — landing-page logo size 64px → 26px (separate change in same session)

## Migrations applied

- `0025_supplement_catalog.sql` — applied via Supabase Management API (CLI hit a tracking divergence with AI track's 0020-0024). 42 catalog rows seeded.

## Deviations from plan

- **Migration number** — planned as `0021`, renumbered to `0025` after discovering remote already had AI-track migrations 0020-0024 with different names. Functionally identical; reflects coordination gap with AI track rather than scope change.
- **Type regen** — deferred. AI-track migration drift made `supabase gen types typescript` unreliable; `loader.ts` casts via `unknown` to maintain type safety until drift is resolved.
- **Subscription schema** — `lib/admin/metrics.ts` discovered that `subscriptions` table lacks `unit_amount`, `interval`, `ended_at`. Wrapper now reads from env vars (Stripe price IDs) and uses `updated_at` as a proxy for `ended_at`. Follow-up migration recommended to capture Stripe price metadata in-DB.

## Known gaps / deferred items

1. **AI-track migration coordination** — remote DB has migrations 0020-0024 not present locally. Needs a sync session with the AI-track owner to commit those SQL files into this repo.
2. **`database.types.ts` regen** — pending migration drift resolution.
3. **A2 predicate-key sanity check** — `vitamin_d`, `omega3_index` predicates assume factor names that weren't in base-44's stock set; some seed items may silently not fire until A1 emits those factors.
4. **B1 manual PDF review** — automated buffer-size assertion passed; no human has opened the rendered PDF yet.
5. **C1 first live CI run** — workflow valid by inspection; first GitHub-Actions run will be the live test. Risk areas: pgvector availability in `supabase/postgres:15.6.1.146`, auth-schema seed differences from Supabase Cloud.
6. **E1 churn window** — 30d fixed; doesn't follow the date-range filter. Acceptable for v1.
7. **A2 contraindication matching** — substring only; class names like `"statins"` won't match `"atorvastatin"`.
