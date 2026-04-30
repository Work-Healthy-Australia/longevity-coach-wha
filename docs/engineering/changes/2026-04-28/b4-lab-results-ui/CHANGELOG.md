# Changelog: B4 — Lab results UI
Date: 2026-04-28
Phase: Epic 8 (The Living Record), pre-approved sprint-1 stretch

## What was built

- **`/labs` index page.** Signed-in members see every distinct biomarker in their data, grouped by category (Cardiovascular, Metabolic, Hormonal, Inflammatory, Haematology, Vitamins, Kidney, Liver, Thyroid, Other). Each card shows latest value + unit, status badge (Low / Optimal / Borderline / High / Critical), reference range, test date, and trend chip. Page header strip shows totals at a glance.
- **`/labs/[biomarker]` detail page.** Per-biomarker history. Header card with the latest reading and status. Recharts time-series chart with a green-tinted reference-range band. Full history table below with date, value, unit, status, panel name, and lab provider.
- **Empty state.** Members with zero uploaded panels see a centred "No lab data yet" panel with an "Upload your first panel →" CTA pointing to `/uploads`.
- **Dashboard quick-link.** Replaced the stale "Coming soon · Lab Results" placeholder with a real link tile showing live biomarker count + latest test date (or "Upload your first panel" when empty).
- **Pure `lib/labs/` helpers.** `groupByBiomarker`, `formatRange`, `statusTone`, `STATUS_LABELS`, `categoryLabel`, `CATEGORY_LABELS`, plus chart-data helper `toChartData` from the chart component. `LabRow` type sourced from the generated `Database["biomarkers"]["Tables"]["lab_results"]["Row"]` — a column rename forces a compile error.
- **Auth gating.** `/labs` added to `PROTECTED_PREFIXES` in `lib/supabase/proxy.ts`.

## What changed

- `lib/labs/index.ts` (new) — re-exports.
- `lib/labs/group-by-biomarker.ts` (new) — pure grouping helper + `BiomarkerGroup`/`LabRow` types.
- `lib/labs/format-range.ts` (new) — range string formatter (en-dash).
- `lib/labs/status-tone.ts` (new) — DB-status → UI-tone mapper + display labels.
- `lib/labs/category-labels.ts` (new) — `CATEGORY_LABELS` map + `categoryLabel()` helper.
- `lib/supabase/proxy.ts` — `/labs` added to `PROTECTED_PREFIXES`.
- `app/(app)/labs/page.tsx` (new) — index server component.
- `app/(app)/labs/labs.css` (new) — scoped styles, six status-tone classes, responsive 3/2/1-up grid.
- `app/(app)/labs/_components/status-badge.tsx` (new) — shared status pill.
- `app/(app)/labs/[biomarker]/page.tsx` (new) — detail server component using Next 16 async `params`.
- `app/(app)/labs/[biomarker]/_components/biomarker-chart.tsx` (new) — Recharts client component + pure `toChartData` helper.
- `app/(app)/dashboard/page.tsx` — added a lab summary query and replaced the Lab Results `ComingTile` with a real `QuickTile`.
- `package.json`, `pnpm-lock.yaml` — `recharts@^2.15.4` added (also unblocks B5 trends + B6 simulator).
- `tests/unit/labs/` (new directory) — 5 test files, 23 cases.

## Migrations applied

None. `biomarkers.lab_results` already has every field needed (shipped in `0009_biomarkers_schema.sql`).

## Deviations from plan

- **Dashboard query strategy** — Spec recommended `count: 'exact', head: true` + a one-row `limit(1)`. Implementation projects `(biomarker, test_date)` and counts in JS. Behaviour is correct (per-user lab data is small) but does pull all rows. Logged as a non-blocking item.
- **Test count** — Plan targeted ≥14 new tests; actual is 23 (more category-labels + status-tone coverage than the minimum).
- **No top-nav entry** for `/labs` — plan explicitly out of scope; dashboard quick-link tile is the only entry point this round.

## Known gaps / deferred items

- Manual visual smoke test of the Recharts SVG (JSDOM rendering intentionally not attempted).
- Source-upload back-link (`upload_id` is on the row but not surfaced).
- B5 daily-log charting, B6 risk simulator, B7 out-of-range alerts — all separate changes; this change unblocks them by introducing Recharts.
- Migration numbering cleanup — historical 0025/0026 cosmetic collisions remain (functional but messy); separate change.
