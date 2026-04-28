# Plan: B5 — Daily-log trends
**Date:** 2026-04-28
**Phase:** Epic 8 (The Living Record), pre-approved sprint-1 stretch
**Status:** Draft

## Objective

Give a signed-in member a `/trends` page that plots their last 30 days of daily check-in data as five small line charts: sleep hours, energy (1–10), mood (1–10), steps, and water (glasses). Reuses the Recharts dependency that B4 introduced. Done = a member with at least one check-in row sees their trend grid; a member with zero rows sees a friendly empty state pointing to `/check-in`.

## Scope

**In scope:**
- New page `/trends` (server component).
- New scoped CSS `trends.css`.
- Pure helpers in `lib/trends/` (`buildTrendSeries`, `summariseTrend`).
- Reusable trend-chart client component.
- `/trends` added to `PROTECTED_PREFIXES`.
- Dashboard quick-tile entry for `/trends` (replaces the existing `Coming soon · Glucose Tracker` slot — see Decision below — or adds alongside Lab Results).
- Tests for the helpers + chart-data transform.

**Out of scope:**
- Editing or deleting check-in rows from the trends page.
- Wider date ranges (60/90 day pickers) — defer.
- Aggregations beyond 30 days, weekly rollups, moving averages.
- Workout duration chart (the data is captured but not in this metric set).
- `supplements_taken` adherence chart (separate change — has UX considerations re: which supplements and when).
- Top-nav entry for `/trends` — dashboard quick-link only this round.

**Decision recorded:** Five charts, separate per metric, in a 2×2 + 1 (or 3×2) responsive grid. Mood and energy share a 1–10 scale but get their own charts for clarity.

## Data model changes

**None.** `biomarkers.daily_logs` already has every column needed (shipped in `0010_biomarkers_daily_logs.sql`). RLS owner-select policy active. Index `(user_uuid, log_date desc)` makes the 30-day query fast. No PII concerns.

## Tasks

Two tasks, sequential. Task 1 = helpers + proxy guard. Task 2 = page + chart + dashboard tile.

---

### Task 1 — `lib/trends/` helpers + proxy guard

**Files affected:**
- `lib/trends/index.ts` (new — re-exports).
- `lib/trends/build-series.ts` (new).
- `lib/trends/summarise.ts` (new).
- `lib/trends/types.ts` (new — re-exports `DailyLog` row type sourced from `database.types.ts`).
- `lib/supabase/proxy.ts` (extend `PROTECTED_PREFIXES`).
- `tests/unit/trends/build-series.test.ts` (new).
- `tests/unit/trends/summarise.test.ts` (new).

**What to build:**

#### `lib/trends/types.ts`
```ts
import type { Database } from "@/lib/supabase/database.types";
export type DailyLogRow =
  Database["biomarkers"]["Tables"]["daily_logs"]["Row"];
```
This pins the row type to schema reality so a future column rename forces a compile error (same pattern as `lib/labs/group-by-biomarker.ts`).

#### `lib/trends/build-series.ts`

```ts
export type Metric = "sleep_hours" | "energy_level" | "mood" | "steps" | "water_glasses";

export type SeriesPoint = {
  date: string;        // ISO YYYY-MM-DD (UTC)
  label: string;       // 'd MMM' for axis labels
  value: number | null; // null = no log that day → Recharts breaks the line
};

export function buildTrendSeries(
  rows: DailyLogRow[],
  metric: Metric,
  now: Date = new Date(),
  windowDays: number = 30,
): SeriesPoint[];
```

Behaviour:
- Build a 30-element array, one entry per UTC date from `now - 29 days` (oldest) to `now` (newest), inclusive — same UTC convention as `streakDots()` in the dashboard. Use the existing `shiftDate(dateStr, days)` pattern.
- For each date in the window, find the matching row (by `log_date === dateStr`); if found, return the metric value (and convert `water_ml` → glasses for the `water_glasses` metric); otherwise `value: null`.
- `label` formatting via `Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' })`. Acceptable to format inside the helper (pure, deterministic for a given UTC `now`).
- For the `water_glasses` metric: `value = water_ml != null ? Math.round(water_ml / 250) : null`.

#### `lib/trends/summarise.ts`

```ts
export type TrendSummary = {
  metric: Metric;
  daysLogged: number;       // count of non-null points in the window
  windowDays: number;
  latest: number | null;    // most recent non-null value, or null
  average: number | null;   // arithmetic mean of non-null values, or null
};

export function summariseTrend(series: SeriesPoint[], metric: Metric, windowDays: number = 30): TrendSummary;
```

Used in the page header strip and per-card sub-text. Round average to one decimal for sleep / energy / mood, integer for steps and water.

#### `lib/trends/index.ts`
Re-exports types + both helpers.

#### Proxy
Add `"/trends"` to `PROTECTED_PREFIXES`.

#### Tests

`build-series.test.ts` (≥6 cases):
1. Empty rows → 30 entries, all `value: null`, last entry's `date === now-as-UTC-string`.
2. One row matching today → last entry has the value, others null.
3. One row matching `now - 5d` → entry at index 24 (since 0-indexed, oldest first) has value.
4. `water_glasses` metric: row with `water_ml: 1000` → value 4 (1000/250).
5. Row outside the window (e.g. `now - 35d`) → ignored, all null.
6. `windowDays: 7` override → 7 entries returned.

`summarise.test.ts` (≥4 cases):
1. All-null series → `daysLogged: 0, latest: null, average: null`.
2. Three values [6, 7, 8] (rest null) → `daysLogged: 3, average: 7.0, latest: 8`.
3. Steps [5000, 8000, null, 10000] → `daysLogged: 3, average: 7667, latest: 10000` (integer rounding).
4. Empty array → `daysLogged: 0`.

**Acceptance criteria:**
- `pnpm build` clean.
- `pnpm test` green; ≥10 new test cases under `tests/unit/trends/`.
- `/trends` redirects to `/login` for unauth users.
- Helpers exported from `lib/trends/index.ts`.
- `DailyLogRow` type sourced from generated DB types.

**Rules to apply:**
- `.claude/rules/nextjs-conventions.md` — pure helpers in `lib/`.
- `.claude/rules/data-management.md` — no PII; `daily_logs` is biomarkers schema.

---

### Task 2 — `/trends` page + chart component + dashboard tile

**Files affected:**
- `app/(app)/trends/page.tsx` (new — server component).
- `app/(app)/trends/trends.css` (new — scoped styles).
- `app/(app)/trends/_components/trend-chart.tsx` (new — client component, Recharts).
- `app/(app)/dashboard/page.tsx` (modify — replace one of the `<ComingTile>` placeholders, e.g. the Glucose Tracker tile, with a real `<QuickTile href="/trends">`, OR add `/trends` to the existing `quick-links` row alongside Documents/Report/Check-in).
- `tests/unit/trends/chart-data.test.ts` (new — pure helper test).

**What to build:**

#### `/trends/page.tsx` (server component)

1. `createClient()` from `lib/supabase/server`. Get user. Defensive `if (!user) return null` (proxy already redirects).
2. Query — only the columns we plot, last 30 UTC days:
   ```ts
   const since = shiftDate(new Date().toISOString().slice(0, 10), -29);
   const { data: rawRows } = await supabase
     .schema("biomarkers" as never)
     .from("daily_logs")
     .select("log_date, sleep_hours, energy_level, mood, steps, water_ml")
     .eq("user_uuid", user.id)
     .gte("log_date", since)
     .order("log_date", { ascending: true });
   const rows = (rawRows ?? []) as unknown as DailyLogRow[];
   ```
3. **Empty state** when `rows.length === 0`:
   - "No check-ins yet" panel
   - "Log your first day →" CTA → `/check-in`
4. **Populated state**:
   - Page header: title `Trends`, subtitle `Last 30 days of your daily check-ins.`, plus a small caption `N of last 30 days logged` from `summariseTrend(...).daysLogged` (use any one metric — they share `daysLogged`).
   - Five trend cards in a responsive grid (3-up >900px, 2-up tablet, 1-up mobile, with the 5th wrapping to a half-width row alone — or simpler: use 5-up grid that collapses gracefully, your call):
     - Sleep (hours)
     - Energy (1–10)
     - Mood (1–10)
     - Steps
     - Water (glasses)
   - Each card renders:
     - Metric label
     - Latest value + unit (e.g. `7.5 hrs` or `8000`)
     - Average sub-text (e.g. `Avg 7.2 over 22 days`)
     - `<TrendChart series={series} metric={...} />` (height ~120px, no axes for sparkline density, or with x-axis dates only — your call)

#### `/trends/_components/trend-chart.tsx` (client component)

```tsx
"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
```

- Accepts `series: SeriesPoint[]`, `metric: Metric`, and optional `unit` for the tooltip.
- Renders a 120px-tall responsive line chart.
- X axis: dates from `series[i].label`. Show ~5 ticks (every 6th label).
- Y axis: numeric, auto-fit domain with 10% padding.
- Line: project palette token per metric (sleep = navy, energy = amber, mood = sage green, steps = teal, water = blue). Dot markers off (sparkline aesthetic) but enabled when series length < 7 so single points are visible.
- Tooltip: `{label} · {value} {unit}` for non-null points; tooltip suppressed for null gaps.
- Recharts naturally breaks the line on `value: null` — desirable.

#### `trends.css`

Scoped styling: card grid, header strip, empty-state panel. Reuse colour tokens from `dashboard.css` and `labs.css` (no new ones invented). Card hover state matches labs.

#### Dashboard tile

In `app/(app)/dashboard/page.tsx`, add `/trends` to the existing quick-links row. Keep it short: `<QuickTile href="/trends" label="Trends" sub="30-day patterns" icon="📈" />`. Don't replace any `<ComingTile>` this round — the trends tile sits alongside the existing Documents / Report / Check-in row. (Decision: keep dashboard surgery minimal — labs tile work showed dashboard query refactor risk.)

#### Tests

`chart-data.test.ts`: a thin test if you extract a `toChartData` helper from `trend-chart.tsx`. If `buildTrendSeries` already produces Recharts-ready output (it does), no extra helper is needed and this file is **optional**. If skipped, document in the handoff.

**Acceptance criteria:**
- `/trends` renders five charts when data is present.
- Empty state renders when zero rows; CTA goes to `/check-in`.
- Each chart breaks the line on null gaps (verify by manually visiting in dev).
- Average sub-text shows reasonable values; `0 of last 30 days` is fine when applicable but should not appear inside cards (top-of-page caption only).
- Dashboard quick-tile row gains a Trends entry linking to `/trends`.
- `pnpm build` clean.
- `pnpm test` green.
- `/trends` is auth-gated.
- No PII anywhere.

**Rules to apply:**
- `.claude/rules/nextjs-conventions.md` — server components by default, only chart is `"use client"`; `_components/` underscore-prefixed; scoped CSS.
- `.claude/rules/security.md` — user-context client only.
- `.claude/rules/data-management.md` — no PII, no derived data stored.

---

## Build order

Sequential. Task 1 must complete before Task 2 (Task 2 imports the helpers).

## Per-task review gate

Spec compliance + code-quality reviews per task. Both must pass before marking complete. Manual visual check of the rendered charts is operator-side, same as B4.

## Definition of done (whole change)

1. Both tasks ✅ on both reviews.
2. `pnpm build` clean.
3. `pnpm test` green with ≥10 new tests under `tests/unit/trends/`.
4. Manual: visit `/trends` with seeded data → 5 charts; visit with zero rows → empty-state CTA.
5. Dashboard quick-tile row links to `/trends`.
6. CHANGELOG, EXECUTIVE_SUMMARY, QA_REPORT present.

## Plan-review addenda (post Phase 4)

The plan reviewer cleared APPROVED WITH NOTES. The following are mandatory for the executor:

1. **Name the constant.** Define `ML_PER_GLASS = 250` as a named module-level constant in `lib/trends/build-series.ts` rather than hard-coding `250`. Future tuning (or moving to user preferences) becomes a one-line change.
2. **Document the timezone caveat.** Add a short comment block at the top of `build-series.ts` noting that `daily_logs.log_date` is captured in the user's local day at write time, but the trend window aligns to UTC dates to match the dashboard `streakDots()` and `computeStreak()` convention. Users in non-UTC zones may see edge-of-day check-ins land in the adjacent UTC bucket — known caveat shared with the streak surface, not a regression.
3. **Tighten the Scope intro.** The Scope section's "Dashboard quick-tile entry … (replaces … OR adds alongside)" wording contradicts the executor instruction in Task 2. The decision is **add alongside** in the existing quick-links row; do not replace any `<ComingTile>`. Treat the Task 2 wording as authoritative.
4. **Defer the DRY refactor.** The dashboard already runs its own 30-day `daily_logs` query for streak math. Sharing that loader between the dashboard and `/trends` is out of scope this round. Add to the Out-of-scope list explicitly.

## Out of scope (carried forward + deferrals from Phase 4 review)

- Date-range picker beyond 30 days.
- Workout / supplements adherence charts.
- Top-nav entry for `/trends`.
- Trends embedded inside `/check-in`.
- Moving averages and weekly rollups.
- Migration renumbering cleanup (historical 0025/0026 cosmetic collisions).
- Shared 30-day `daily_logs` loader between dashboard and `/trends` (DRY refactor deferred per addendum #4).
