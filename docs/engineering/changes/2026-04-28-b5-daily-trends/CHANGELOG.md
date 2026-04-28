# Changelog: B5 — Daily-log trends
Date: 2026-04-28
Phase: Epic 8 (The Living Record), pre-approved sprint-1 stretch

## What was built

- **`/trends` page.** A signed-in member sees 30 days of their daily check-ins as five small line charts: Sleep, Energy, Mood, Steps, Water. Each card shows the latest value, the average over the days logged in the window, and a sparkline-style chart with gaps where days were missed.
- **Empty state.** Members with zero check-ins in the last 30 days see a friendly "No check-ins yet" panel with a "Log your first day →" CTA pointing at `/check-in`.
- **Page header strip.** "N of last 30 days logged" caption under the title for at-a-glance consistency.
- **Pure helpers** at `lib/trends/`:
  - `buildTrendSeries(rows, metric, now?, windowDays?)` — produces a 30-element series of `{ date, label, value }` with `null` for days without a row. UTC-aligned, deterministic, testable.
  - `summariseTrend(series, metric, windowDays?)` — `{ daysLogged, latest, average }` with metric-appropriate rounding.
  - `ML_PER_GLASS = 250` named constant (water_ml ↔ glasses conversion).
  - `DailyLogRow` type sourced from the generated `Database["biomarkers"]["Tables"]["daily_logs"]["Row"]` — schema drift forces a compile error.
- **Reusable client chart** `<TrendChart>` (Recharts), 120px-tall, per-metric colour, dot markers when series is short, line breaks on null gaps.
- **Auth gating.** `/trends` added to `PROTECTED_PREFIXES`.
- **Dashboard quick-link.** New `<QuickTile href="/trends" label="Trends" sub="30-day patterns" icon="📈" />` added to the existing quick-links row alongside Documents, Lab Results, Report, Check-in. No existing tile was replaced.

## What changed

- `lib/trends/index.ts` (new) — re-exports.
- `lib/trends/types.ts` (new) — `DailyLogRow` re-export from generated types.
- `lib/trends/build-series.ts` (new) — `buildTrendSeries`, `Metric`, `SeriesPoint`, `ML_PER_GLASS`, plus a private `shiftDate` UTC helper duplicated from the dashboard pattern.
- `lib/trends/summarise.ts` (new) — `summariseTrend`, `TrendSummary`.
- `lib/supabase/proxy.ts` — `/trends` added to `PROTECTED_PREFIXES`.
- `app/(app)/trends/page.tsx` (new) — server component.
- `app/(app)/trends/trends.css` (new) — scoped styles, responsive grid, card hover state, empty-state panel.
- `app/(app)/trends/_components/trend-chart.tsx` (new) — `"use client"` Recharts wrapper.
- `app/(app)/dashboard/page.tsx` — one new `<QuickTile>` added to the existing `lc-quick` row; nothing else touched.
- `tests/unit/trends/build-series.test.ts` (new) — 6 cases.
- `tests/unit/trends/summarise.test.ts` (new) — 4 cases.

## Migrations applied

None. `biomarkers.daily_logs` already has every column needed (shipped in `0010_biomarkers_daily_logs.sql`).

## Deviations from plan

- **`labelFormatter` dropped from the chart Tooltip.** Recharts' generic `NameType=""` made the `labelFormatter` payload typing fight TypeScript strictness. Removed because `XAxis dataKey="label"` already supplies the date as the tooltip header — no visible regression. Documented in the executor handoff.
- **No `chart-data.test.ts`.** Plan marked it optional; skipped because `buildTrendSeries` is already Recharts-ready and no extra transform helper was extracted.

## Known gaps / deferred items

- Manual visual smoke test of the rendered Recharts SVGs.
- Y-axis labels on sparklines (intentionally absent; one-line add if wanted).
- Shared 30-day `daily_logs` loader between dashboard and `/trends` (deferred; each surface keeps its own bounded query).
- Top-nav entry for `/trends` (not added; dashboard quick-link is the only entry point).
- Date-range picker beyond 30 days.
- Workout / supplement-adherence trends — separate change.
- Moving averages and weekly rollups — separate change.
- Per-user `ML_PER_GLASS` preference — separate change.
