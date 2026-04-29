# QA Report: B4 — Lab results UI
Date: 2026-04-28
Reviewer: dev-loop coordinator

## Build status
- `pnpm build`: PASS (only pre-existing Turbopack workspace-root warning, unrelated to this change). `/labs` and `/labs/[biomarker]` registered as dynamic server-rendered routes.
- `pnpm test`: PASS — 269 tests across 43 suites, 0 failures, 0 skipped.

## Test results

| Suite | Tests | Pass | Fail | Skipped |
|---|---:|---:|---:|---:|
| `tests/unit/labs/group-by-biomarker.test.ts` | 4 | 4 | 0 | 0 |
| `tests/unit/labs/format-range.test.ts` | 4 | 4 | 0 | 0 |
| `tests/unit/labs/status-tone.test.ts` | 8 | 8 | 0 | 0 |
| `tests/unit/labs/category-labels.test.ts` | 4 | 4 | 0 | 0 |
| `tests/unit/labs/biomarker-chart.test.ts` | 3 | 3 | 0 | 0 |
| (other) | 246 | 246 | 0 | 0 |
| **Total** | **269** | **269** | **0** | **0** |

Total new tests for B4: **23** (target was ≥14).

## Findings

### Confirmed working
- `lib/labs/` helpers (`groupByBiomarker`, `formatRange`, `statusTone`, `categoryLabel`) all pure and tested.
- `LabRow` sourced from generated `Database["biomarkers"]["Tables"]["lab_results"]["Row"]`, so a future column rename forces a compile error.
- `recharts@^2.15.4` pinned; React 19 + Next 16 compatible.
- `/labs` added to `PROTECTED_PREFIXES` — auth-gated.
- `/labs` index renders categories with cards (biomarker / value+unit / status badge / range / trend / date) linking via `encodeURIComponent`.
- `/labs` empty state with "Upload your first panel →" CTA pointing to `/uploads`.
- `/labs/[biomarker]` uses Next 16 async `params`; `notFound()` for zero-row biomarker.
- Detail page header card + Recharts time-series chart + history table.
- Chart is the only client component; reference band rendered when both `reference_min` and `reference_max` are present; tooltip shows date + value + unit.
- `<StatusBadge>` shared between index and detail pages.
- Six status tone classes in `labs.css` (low / optimal / borderline / high / critical / unknown).
- Dashboard tile "Coming soon · Lab Results" replaced with real `<QuickTile>` showing biomarker count + latest test date, or "Upload your first panel" if empty.
- 23 new unit tests passing; full suite 269/269.

### Deferred items
- Manual visual verification of the rendered Recharts SVG remains operator-side (per plan — JSDOM is not used to render the chart).
- Dashboard query for the lab tile fetches the projected `(biomarker, test_date)` columns rather than using `count: 'exact', head: true` + a one-row `limit(1)`. Current path is correct but pulls all rows for the user; non-blocking, can be tightened later.
- Dashboard queries remain serial `await`s rather than batched `Promise.all` — pre-existing pattern, not introduced by this change.
- `formatDate` locale on the dashboard tile is default while labs pages use `en-AU` — minor display drift.
- `/labs` is not in the top nav (out of scope per plan; dashboard quick-link tile is the only entry point this round).

### Known limitations
- Source-upload back-link (`upload_id`) not surfaced to UI; deferred.
- Edit / delete lab rows is intentionally not supported (Janet writes are append-only).
- Recharts SVG behaviour cannot be unit-tested in JSDOM cleanly; manual smoke required for visual correctness.
- Status enum is the DB-stored value precomputed by Janet; no client-side recomputation against ranges.

## Verdict
APPROVED — both tasks passed spec + code-quality reviews; build and full test suite green.
