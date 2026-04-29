# QA Report: B5 — Daily-log trends
Date: 2026-04-28
Reviewer: dev-loop coordinator

## Build status
- `pnpm build`: PASS. `/trends` registered as a dynamic server-rendered route. Only pre-existing Turbopack workspace-root warning remains.
- `pnpm test`: PASS — 279 tests across 45 suites, 0 failures, 0 skipped.

## Test results

| Suite | Tests | Pass | Fail | Skipped |
|---|---:|---:|---:|---:|
| `tests/unit/trends/build-series.test.ts` | 6 | 6 | 0 | 0 |
| `tests/unit/trends/summarise.test.ts` | 4 | 4 | 0 | 0 |
| (other) | 269 | 269 | 0 | 0 |
| **Total** | **279** | **279** | **0** | **0** |

Total new tests for B5: **10** (target was ≥10). Optional `chart-data.test.ts` deliberately skipped per plan because `buildTrendSeries` already produces Recharts-ready output and no extra transform helper was extracted.

## Findings

### Confirmed working
- `lib/trends/` helpers (`buildTrendSeries`, `summariseTrend`, `ML_PER_GLASS`) all pure and tested.
- `DailyLogRow` sourced from generated `Database["biomarkers"]["Tables"]["daily_logs"]["Row"]`.
- Module-level `ML_PER_GLASS = 250` constant (addendum #1).
- Top-of-file timezone caveat documents the UTC bucketing convention shared with `streakDots()`/`computeStreak()` (addendum #2).
- `/trends` added to `PROTECTED_PREFIXES`.
- `/trends` page renders five trend cards (Sleep / Energy / Mood / Steps / Water) in a responsive 3/2/1-up grid.
- Empty-state panel with "Log your first day →" CTA pointing to `/check-in` when zero rows.
- Page header strip shows `{daysLogged} of last 30 days logged`.
- Each card shows latest value with metric-appropriate formatter, unit, and average sub-text.
- Recharts `<Line>` defaults `connectNulls={false}`, so missing days produce visible breaks rather than zero-fill.
- Dashboard quick-links row gains a Trends tile linking to `/trends` (addendum #3 — no `<ComingTile>` replaced, no existing tile modified).
- 30-day query bounded at the SQL level (`gte("log_date", since)`) so power users with many months of history don't pull everything.
- Full suite 279/279 passing.

### Deferred items
- **Manual visual verification.** Recharts SVG cannot be unit-tested in JSDOM cleanly; an operator must visit `/trends` with seeded data to confirm sparklines render, line breaks at null gaps, tooltip labels match, and palette reads well at 120px height.
- **No Y-axis labels** on sparklines (per spec — sparkline aesthetic). If labels are wanted later, a one-line addition of a hidden `YAxis` with `domain={["auto","auto"]}` is enough.
- **`labelFormatter` was dropped** in the chart Tooltip due to Recharts' tight TS generics. Date label still displays because `XAxis dataKey="label"` feeds `SeriesPoint.label` directly to the tooltip header. No functional regression.
- **Shared 30-day daily_logs loader** between dashboard and `/trends` — explicitly deferred (addendum #4); dashboard keeps its existing query, `/trends` has its own.
- **No top-nav entry** for `/trends` (out of scope; dashboard quick-link only).

### Known limitations
- Soft assumption: `ML_PER_GLASS = 250`. If members report different glass sizes, this becomes a per-user preference.
- Trend window strictly UTC; users in non-UTC zones may see edge-of-day check-ins shift between buckets. Caveat shared with the streak surface, documented in `lib/trends/build-series.ts`.
- No date-range picker; window fixed at 30 days.
- No moving averages or weekly rollups.

## Verdict
APPROVED — both tasks passed reviews; build + full suite green.
