# Plan: B4 — Lab results UI
**Date:** 2026-04-28
**Phase:** Epic 8 (The Living Record), pre-approved as a sprint-1 stretch in `docs/engineering/plan/sprint-1/2026-04-28-plan-non-ai.md`
**Status:** Draft

## Objective

Give a signed-in member a member-facing UI to view their lab results: an index page (`/labs`) grouped by biomarker with the latest value, status badge, and reference range; and a per-biomarker detail page (`/labs/[biomarker]`) with the full historical time-series rendered as a Recharts line chart with reference-range bands. Done = a member with at least one Janet-parsed upload can navigate from the dashboard quick-link tile into `/labs`, see every biomarker in their data, click into one, and see its history.

This change also unblocks B5 (daily-log charting) and B6 (risk simulator) by introducing Recharts to the dependency surface.

## Scope

**In scope:**
- New page `/labs` (index, grouped by biomarker).
- New page `/labs/[biomarker]` (per-biomarker detail with time-series chart).
- New scoped CSS `labs.css`.
- Pure helpers in `lib/labs/` (`groupByBiomarker`, `categorizeStatus`, `formatRange`).
- Status-badge component shared between index and detail pages.
- `/labs` added to `PROTECTED_PREFIXES` in `lib/supabase/proxy.ts`.
- Dashboard "Coming soon · Lab Results" tile replaced with a real link tile.
- Recharts dependency (`pnpm add recharts`).
- Tests for `lib/labs/` helpers.
- Empty-state messaging for members with zero rows.

**Out of scope:**
- B5 daily-log charting (separate change; reuses Recharts).
- B6 risk simulator (separate change).
- B7 out-of-range alerts + repeat-test reminders (separate change; needs new migration).
- Manual metric entry (deferred Epic 8 item).
- Wearable OAuth integrations (deferred).
- Edit / delete lab rows (Janet writes are append-only by design).
- Linking a biomarker back to its source `patient_uploads` row (nice-to-have, deferred).
- Top-nav entry for `/labs` — dashboard quick-link tile is the only entry point this round.

## Data model changes

**None.** `biomarkers.lab_results` already has every field needed (`biomarker`, `value`, `unit`, `reference_min/max`, `optimal_min/max`, `status`, `category`, `trend`, `test_date`, `panel_name`, `lab_provider`). No new columns. No new tables. No JSONB. Migration `0009_biomarkers_schema.sql` shipped this. RLS owner-select policy already in place.

**Migration numbering note (informational):** the migration chain has cosmetic collisions (`0025_supplement_catalog` + `0025_agents_schema`, `0026_export_log` + `0026_health_knowledge_embeddings`) caused by parallel branches landing at the same time. Both pairs are applied to production; Supabase tracks by filename so functionally fine. No B4 migration to add. A future cleanup change can renumber locally.

## Tasks

Two tasks, executed sequentially. Task 1 introduces the dep + helpers + protected route; Task 2 builds the pages on top.

---

### Task 1 — Recharts dep + lib/labs helpers + proxy guard

**Files affected:**
- `package.json`, `pnpm-lock.yaml` (add `recharts` as runtime dep; no `@types/recharts` — recharts ships its own types in v2+).
- `lib/labs/index.ts` (new — re-exports).
- `lib/labs/group-by-biomarker.ts` (new).
- `lib/labs/format-range.ts` (new).
- `lib/labs/status-tone.ts` (new).
- `lib/supabase/proxy.ts` (extend `PROTECTED_PREFIXES`).
- `tests/unit/labs/group-by-biomarker.test.ts` (new).
- `tests/unit/labs/format-range.test.ts` (new).
- `tests/unit/labs/status-tone.test.ts` (new).

**What to build:**

#### `pnpm add recharts`
- Runtime dependency. Verify `pnpm build` clean before moving on.

#### `lib/labs/group-by-biomarker.ts`
Pure helper:
```ts
type LabRow = {
  biomarker: string;
  category: string | null;
  test_date: string;
  value: number;
  unit: string;
  reference_min: number | null;
  reference_max: number | null;
  optimal_min: number | null;
  optimal_max: number | null;
  status: string | null;
  trend: string | null;
  panel_name: string | null;
  lab_provider: string | null;
};

export type BiomarkerGroup = {
  biomarker: string;
  category: string | null;          // taken from latest row
  unit: string;                     // taken from latest row
  latest: LabRow;                   // most recent by test_date
  rowCount: number;                 // how many history rows
  firstTestDate: string;            // earliest test_date in this biomarker
};

export function groupByBiomarker(rows: LabRow[]): BiomarkerGroup[];
```

Behaviour:
- Group rows by `biomarker` (exact case match — Janet normalises casing on insert).
- Sort each group by `test_date` desc; pick `[0]` as `latest`.
- Output array sorted by category then biomarker name (case-insensitive).
- Empty input → empty array.

#### `lib/labs/format-range.ts`
```ts
export function formatRange(min: number | null, max: number | null, unit: string): string;
```
- `(null, null, _)` → `"—"`
- `(70, null, "mg/dL")` → `"≥ 70 mg/dL"`
- `(null, 100, "mg/dL")` → `"≤ 100 mg/dL"`
- `(70, 100, "mg/dL")` → `"70–100 mg/dL"` (en-dash, NOT hyphen)

#### `lib/labs/status-tone.ts`
```ts
export type StatusTone = "low" | "optimal" | "borderline" | "high" | "critical" | "unknown";

export function statusTone(status: string | null): StatusTone;
```
- Maps the DB `status` column to one of six tones (passing through the five known values; null/unknown/anything-else → `"unknown"`).
- Companion `STATUS_LABELS: Record<StatusTone, string>` for display copy (`"Low"`, `"Optimal"`, etc.).

#### `lib/labs/index.ts`
Re-exports all three helpers for clean import paths.

#### `lib/supabase/proxy.ts`
Add `"/labs"` to `PROTECTED_PREFIXES`. Single-line change.

#### Tests

`group-by-biomarker.test.ts`:
1. Empty input → `[]`.
2. Single biomarker, three dates → one group, `latest.test_date` is the most recent, `rowCount === 3`.
3. Two biomarkers across two categories → grouped + sorted by category then name.
4. Mixed-case sort is case-insensitive.

`format-range.test.ts`:
1. `(null, null, "x")` → `"—"`.
2. `(70, null, "mg/dL")` → `"≥ 70 mg/dL"`.
3. `(null, 100, "mg/dL")` → `"≤ 100 mg/dL"`.
4. `(70, 100, "mg/dL")` → `"70–100 mg/dL"` (verify the en-dash exactly).

`status-tone.test.ts`:
1. Each known status maps correctly (5 cases).
2. `null` → `"unknown"`.
3. Garbage string → `"unknown"`.

**Acceptance criteria:**
- `recharts` in `dependencies` of `package.json`.
- `pnpm build` clean.
- `pnpm test` green; ≥ 11 new test cases under `tests/unit/labs/`.
- `/labs` redirects to `/login` for unauthenticated users (verify by visiting `/labs` while signed out — proxy already enforces, just need `/labs` in the list).
- All four helpers exported from `lib/labs/index.ts`.

**Rules to apply:**
- `.claude/rules/nextjs-conventions.md` — proxy guard centralised; helpers are pure functions in `lib/`.

---

### Task 2 — `/labs` index page, `/labs/[biomarker]` detail page, dashboard tile rewrite

**Files affected:**
- `app/(app)/labs/page.tsx` (new — index).
- `app/(app)/labs/labs.css` (new — shared styling for index + detail).
- `app/(app)/labs/_components/status-badge.tsx` (new — server component, used on both pages).
- `app/(app)/labs/[biomarker]/page.tsx` (new — detail).
- `app/(app)/labs/[biomarker]/_components/biomarker-chart.tsx` (new — **client** component because Recharts uses Canvas/SVG hooks).
- `app/(app)/dashboard/page.tsx` (modify — replace the `<ComingTile icon="🔬" title="Lab Results" …>` block with a real `<QuickTile>` linking to `/labs`, and ideally surface latest-panel-date in the sub).
- `tests/unit/labs/biomarker-chart.test.tsx` (new — unit-level test of the chart's data-shape transform helper, NOT the rendered chart; Recharts in JSDOM is brittle).

**What to build:**

#### `/labs/page.tsx` (server component)

1. `createClient()` from `lib/supabase/server`. Get user. (Proxy already redirects on missing user; no need to re-check, but a defensive `if (!user) return null` is fine.)
2. Query:
   ```ts
   await supabase
     .schema("biomarkers" as never)
     .from("lab_results")
     .select("biomarker, category, test_date, value, unit, reference_min, reference_max, optimal_min, optimal_max, status, trend, panel_name, lab_provider")
     .eq("user_uuid", user.id)
     .order("test_date", { ascending: false });
   ```
   *(Use `as never` cast on `.schema("biomarkers")` if the typed client doesn't accept it cleanly — pattern already used in dashboard/check-in.)*
3. Pass rows through `groupByBiomarker()`.
4. **Empty state**: when zero rows, render a centred panel:
   - Title: "No lab data yet"
   - Body: "Upload a recent blood panel or DEXA and Janet will extract your biomarkers here."
   - CTA button: "Upload your first panel →" linking to `/uploads`.
5. **Populated state**: render groups by category. For each category section:
   - Section heading (`Cardiovascular`, `Metabolic`, etc. — capitalise the DB enum value).
   - Grid of cards. Each card shows:
     - Biomarker name (`{group.biomarker}`)
     - Latest value + unit (`{value} {unit}`)
     - Status badge (`<StatusBadge tone={statusTone(group.latest.status)} />`)
     - Reference range (`Range {formatRange(reference_min, reference_max, unit)}`)
     - Test date (`{format date as 'd MMM yyyy'}`)
     - Trend chip if not null (↑ improving / → stable / ↓ declining)
     - Card is a `<Link>` to `/labs/${encodeURIComponent(group.biomarker)}`.
6. Page-level meta: count of unique biomarkers, count of total rows, latest test date (small grey row at top).

#### `/labs/[biomarker]/page.tsx` (server component)

1. `params.biomarker` is URL-encoded; `decodeURIComponent()` it.
2. Auth check + same query but filtered: `.eq("biomarker", decoded).order("test_date", { ascending: true })` (asc for chart axis).
3. If zero rows for that biomarker: 404 via `notFound()` from `next/navigation`.
4. Render:
   - Breadcrumb: `Labs › {biomarker}` with link back to `/labs`.
   - Header card: latest value + unit, status badge, reference range, trend.
   - Time-series chart (`<BiomarkerChart rows={rows} />`).
   - History table below the chart (date · value · unit · status badge · panel_name · lab_provider).
   - Side note copy: "All values shown are exactly as Janet extracted them from your uploaded documents. Janet's interpretation of status uses the reference range provided by the lab when available."

#### `/labs/[biomarker]/_components/biomarker-chart.tsx` (client component)

```tsx
"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ResponsiveContainer } from "recharts";
```
- Accepts `rows: { test_date: string; value: number; unit: string; reference_min: number | null; reference_max: number | null }[]`.
- Renders a 320px-tall responsive line chart.
- X axis: dates (formatted `d MMM`).
- Y axis: numeric values; auto-fit domain with 10% padding.
- Y-axis label: the unit.
- Reference range rendered as a green-tinted `<ReferenceArea>` band when both min and max are present (use the latest row's range — assume range stable across panels).
- Line: dark navy, dot markers at each point.
- Tooltip: `{date} · {value} {unit}`.

Extract a pure helper `toChartData(rows)` that maps the DB rows to `{ date: ISO, value, label: 'd MMM' }`. Test that helper.

#### `_components/status-badge.tsx` (server component, shared)

Pure presentational. Six tones (low/optimal/borderline/high/critical/unknown) → six CSS classes (`lc-status-low`, etc.). Renders a small pill: `<span class="lc-status lc-status-{tone}">{label}</span>`.

#### `labs.css`

Tokens for the five status states (semantic colors — green for optimal, amber for borderline, red for high/critical, blue for low, grey for unknown). Reuse Tailwind tokens already in `globals.css` if available, else hex literals matching project palette. Index grid: 3-up on desktop (>900px), 2-up tablet, 1-up mobile.

#### Dashboard tile rewrite

Replace the current "Coming soon · Lab Results" block in `app/(app)/dashboard/page.tsx`:

```tsx
<ComingTile
  icon="🔬"
  title="Lab Results"
  stat="Latest panel · 8 weeks ago"
  sub="ApoB 92 mg/dL · LDL 118 · HbA1c 5.3%"
/>
```

with a real `<QuickTile>` like the others, plus a parallel query in the page for `count + latest test_date`:

```tsx
<QuickTile
  href="/labs"
  label="Lab Results"
  sub={
    labCount === 0
      ? "Upload your first panel"
      : `${biomarkerCount} biomarkers · latest ${formatDate(latestLabDate)}`
  }
  icon="🔬"
/>
```

Add a small `head/count` query alongside the existing dashboard `Promise.all`. Don't fetch full rows — just `count: 'exact', head: true` plus a one-row `select(test_date).order(...).limit(1)`.

#### Tests

`biomarker-chart.test.tsx` (or `.ts`): unit-test the `toChartData` helper. **Do not** try to render Recharts in JSDOM — flaky and adds no value. Three cases:
1. Empty input → `[]`.
2. One row → one entry, `label` formatted correctly.
3. Three rows in random order → output sorted ascending by `date`.

**Acceptance criteria:**
- `/labs` lists every distinct biomarker, grouped by category, with latest value + status + range + trend.
- `/labs/{biomarker}` renders for any biomarker the user has data for; 404 otherwise.
- The chart renders an SVG with data points + reference band (verify by manually visiting in dev — or, if testable, screenshot).
- Empty state on `/labs` for users with zero rows shows the upload CTA.
- Dashboard tile now links to `/labs` and shows real biomarker/date info.
- `pnpm build` clean.
- `pnpm test` green; the `toChartData` test added (≥ 3 cases).
- `/labs` is auth-gated (redirects unauth to `/login`).
- No PII in any URL or query string (biomarker name is fine — that's not patient identifier).
- Status badge color tones are visually distinguishable (manual review).

**Rules to apply:**
- `.claude/rules/nextjs-conventions.md` — server components by default; the chart only is `"use client"`; `_components/` underscore-prefixed.
- `.claude/rules/security.md` — user-context Supabase client only (RLS does the work); no admin client.
- `.claude/rules/data-management.md` — no PII written, no derived data stored.

---

## Build order

Sequential. Task 1 must complete before Task 2 (Task 2 imports the helpers Task 1 creates).

## Per-task review gate

Spec compliance + code-quality reviews per task. Both must pass before marking complete. Task 2 review must include a manual-visit verification step (or a screenshot in the handoff) since Recharts behaviour can't be unit-tested cleanly.

## Definition of done (whole change)

1. Both tasks ✅ on both reviews.
2. `pnpm build` clean.
3. `pnpm test` green with ≥ 14 new tests under `tests/unit/labs/` (group-by, format-range, status-tone, toChartData).
4. Manual verification: visit `/labs` while signed in with seeded data, see biomarkers, click into one, see its chart.
5. Manual verification: visit `/labs` with a zero-row user, see the empty-state CTA pointing to `/uploads`.
6. Dashboard tile links live.
7. CHANGELOG, EXECUTIVE_SUMMARY, QA_REPORT present.

## Plan-review addenda (post Phase 4)

The plan reviewer cleared APPROVED WITH NOTES. The following are mandatory for the executor:

1. **Next 16 async params.** In `app/(app)/labs/[biomarker]/page.tsx`, `params` is a Promise. Use `const { biomarker } = await params;` — do not destructure synchronously. Read `node_modules/next/dist/docs/` if unsure.
2. **Pin Recharts version.** Use `pnpm add recharts@^2.15` (React 19 + Next 16 compatible). Verify `pnpm build` clean immediately after install.
3. **Source `statusTone` input type from generated DB types.** Import the row type from `lib/supabase/database.types.ts` so a future schema change forces a compile error rather than silent drift. Don't redeclare `LabRow` from scratch.
4. **Biomarker URL encoding.** The route param is single-segment. If any biomarker name in the data could contain `/`, that breaks. Janet's normalisation should already strip slashes, but the executor must verify by grepping recent `lab_results.biomarker` values OR by adding a defensive `slugify` step that maps slashes to a sentinel (e.g. `__`) and reverses it. Document the choice in the handoff. Simpler path: just confirm the data has no slashes and add a one-line check in the page that 404s if `decoded` doesn't match a real row anyway (which the existing zero-row 404 already does).
5. **`CATEGORY_LABELS` map.** Don't runtime-capitalise the DB enum. Define a `Record<string, string>` mapping the 10 known categories to display strings (`cardiovascular` → `Cardiovascular`, `haematology` → `Haematology`, etc.). Place in `lib/labs/category-labels.ts` and unit-test that all 10 known DB values map to a non-empty label.

These are non-blocking in the sense that the plan is approved; the executor must read this section before starting Task 2.

## Out of scope (carried forward, plus deferrals from research)

- B5, B6, B7 (separate changes).
- Top-nav entry for `/labs` — dashboard quick-link only.
- Source-upload back-link (`upload_id` is on the row but not rendered yet).
- Migration renumbering cleanup for the cosmetic 0025/0026 collisions.
