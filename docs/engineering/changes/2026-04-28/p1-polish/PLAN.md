# Plan: P1 Polish — Gitleaks, check-in fields, streak dots, export-everything
**Date:** 2026-04-28
**Phase:** 2 (Intelligence) polish + slice of 1 (Foundation hardening)
**Status:** Amended — see "Status delta (2026-04-28 PM)" at bottom

## Objective

Ship the four remaining P1 items from the priority map (skipping D3 / Sentry per user). Each item is small and independent; this is the post-MVP polish wave that completes the Vietnam-adjacent surface area.

After this change:
- Gitleaks scans every PR for committed secrets.
- The daily check-in form captures **steps and water** (today's dashboard tiles fall back to `—` because the form doesn't ask for these yet).
- The dashboard hero shows a **Mon-Sun dot strip** so the streak feels tangible.
- A signed-in member can hit `/account` and download a **complete export** of everything we hold about them (JSON + PDF bundle), satisfying the Privacy Act access principle.

Done = all four items shipped, build clean, ≥10 new tests passing, the export bundle round-trips for at least one fixture user.

## Scope

**In scope:**
- D2 — Gitleaks workflow (`.github/workflows/secrets.yml`).
- B2 — Steps + water inputs on the check-in form, server action validation, dashboard tiles populated.
- B3 — Mon-Sun dot UI on the dashboard hero.
- C2 — `/account` page (minimal — identity card + export button only), `/api/export` route, audit log table.

**Out of scope:**
- D3 — Sentry (deferred per user).
- Full `/account` self-service page (profile edit, password change, subscription cancel, deceased flag, pause). Just the export button this round.
- Right-to-erasure (C4 in priority doc — separate change).
- Steps/water visualisation in long-term trend charts (B5 — separate change).

## Data model changes

| Object | Type | Decision | Writer |
|---|---|---|---|
| `public.export_log` (new) | typed table | append-only audit row per export | server-only via export route |
| `biomarkers.daily_logs.steps` | existing int column | already shipped in 0010 | check-in server action |
| `biomarkers.daily_logs.water_ml` | existing int column | already shipped in 0010 | check-in server action |

**No PII in `export_log`** — references `user_uuid` only, plus timestamp, format, byte-size, and request IP (for security audit, not PII).

**Migration numbering:** next is `0026_export_log.sql` (after `0025_supplement_catalog.sql` shipped earlier today).

```sql
-- 0026_export_log.sql
create table if not exists public.export_log (
  id           uuid primary key default gen_random_uuid(),
  user_uuid    uuid not null references auth.users(id) on delete cascade,
  exported_at  timestamptz not null default now(),
  format       text not null check (format in ('json','zip','pdf')),
  byte_size    integer,
  request_ip   text,
  created_at   timestamptz not null default now()
);
alter table public.export_log enable row level security;
drop policy if exists "export_log_owner_select" on public.export_log;
create policy "export_log_owner_select" on public.export_log
  for select to authenticated using (auth.uid() = user_uuid);
-- Service-role only for inserts (admin client from /api/export).
create index if not exists export_log_user_uuid_idx on public.export_log(user_uuid);
```

## Tasks

D2, B2, B3, C2 are file-disjoint; **all four can run in parallel**.

---

### Task D2 — Gitleaks secret scanning

**Files affected:**
- `.github/workflows/secrets.yml` (new)
- `.gitleaks.toml` (new — minimal allowlist for documentation false positives)

**What to build:**

A standalone GitHub Actions workflow that runs `gitleaks/gitleaks-action@v2` on every pull request and every push to `main`. Failing scan blocks the PR.

The action's default ruleset is sufficient. Use a `.gitleaks.toml` in repo root with:
- An empty `[allowlist]` block ready to extend.
- One sample regex allow for `AKIA[0-9A-Z]{16}` inside `docs/` (just to demonstrate the override path; commented out by default).

Workflow:
```yaml
name: Secret scan
on:
  pull_request:
  push:
    branches: [main]
jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # gitleaks needs full history
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # GITLEAKS_LICENSE: omit for public repos / personal use
```

**Acceptance criteria:**
- File at `.github/workflows/secrets.yml`.
- File at `.gitleaks.toml` (valid TOML, reads cleanly).
- A test commit containing a fake `STRIPE_SECRET_KEY=sk_live_abcdef…` would fail the scan (verify locally with `gitleaks detect --no-git --source=/tmp/test-fixture` if `gitleaks` is installable; otherwise document the manual verification step).
- YAML parses cleanly.

**Rules to apply:**
- `.claude/rules/security.md` — never commit secrets; this is the gate that enforces it.

---

### Task B2 — Steps + water in check-in form

**Files affected:**
- `app/(app)/check-in/_components/check-in-form.tsx` (extend)
- `app/(app)/check-in/actions.ts` (extend)
- `app/(app)/check-in/page.tsx` (extend `LogEntry` type + recent-logs row format)
- `app/(app)/check-in/check-in.css` (no change needed if the existing `.checkin-field` styles cover it)
- `tests/unit/check-in/` (new test file — currently no test coverage on the action)

**What to build:**

Add two number inputs to the check-in form, between Sleep and Notes:

1. **Steps today** — `<input type="number" name="steps">`. Range 0–60000, step 100. Default empty (treat as 0 in the action).
2. **Water (glasses)** — `<input type="number" name="water_glasses">`. Range 0–20, step 1. Default empty. Server action multiplies by 250 to store as `water_ml`.

Server action additions (in `actions.ts`):
- Read `steps` and `water_glasses` from FormData.
- Validate: steps in [0, 60000], water_glasses in [0, 20]; reject otherwise.
- Map water_glasses → `water_ml = water_glasses * 250` for storage.
- Write to existing `biomarkers.daily_logs` columns `steps` (int) and `water_ml` (int) via the existing `.upsert(...)` call.

Page changes (in `page.tsx`):
- Extend `LogEntry` to include `steps` and `water_ml`.
- Recent-logs row gains "· {steps} steps · {Math.round(water_ml/250)} glasses" suffix when present.

Form-level changes:
- Pre-fill values from `todayEntry?.steps` and `Math.round((todayEntry?.water_ml ?? 0) / 250)`.

**Tests required:**

`tests/unit/check-in/validation.test.ts` — pure validation function extracted from the server action (refactor to unit-testable). Cases:
1. `steps = -5` → error.
2. `steps = 200000` → error.
3. `water_glasses = 99` → error.
4. Valid: `steps = 8000, water_glasses = 6` → returns clean record.

If the action isn't easily testable as-is, extract a `parseCheckInForm(formData) → { ok, data | error }` helper and test that.

**Acceptance criteria:**
- Form renders the two new inputs.
- `pnpm test` passes including the new test file.
- Submitting the form on `/check-in` writes `steps` and `water_ml` to `biomarkers.daily_logs`.
- Dashboard `/dashboard` Steps and Water tiles now show the saved values (instead of `—`) — verify via preview.

**Rules to apply:**
- `.claude/rules/data-management.md` — `daily_logs` is biomarkers schema; member-write only via server action; no PII.

---

### Task B3 — Mon-Sun streak dots

**Files affected:**
- `app/(app)/dashboard/page.tsx` (extend)
- `app/(app)/dashboard/dashboard.css` (extend)

**What to build:**

A horizontal strip of seven dots in the dashboard hero, **above** the existing summary line. Each dot represents a calendar day from 6 days ago through today, in chronological order (left → right).

Dot states:
- **Filled** (`palette.primary`) = a `daily_logs` row exists for that UTC date.
- **Empty** (border only, transparent fill) = no log that day.
- **Today** (the rightmost dot) = same as above but with a sage outline ring + "·" label.

Below each dot: a tiny one-letter day label (M T W T F S S, Monday-first).

Computation: pure function `streakDots(logDates: Set<string>, now: Date): Array<{ date: string; dayLetter: string; filled: boolean; isToday: boolean }>` — testable in isolation. **All date math runs in UTC** (matches `computeStreak`'s convention, which matches the writer in check-in actions). Acceptance criterion: a member in UTC+11 just past midnight local sees today's dot at the rightmost position based on the UTC date — document this rather than try to time-travel. Add a unit test simulating `now` at `2026-04-28T13:30:00Z` and confirm the rightmost dot represents `2026-04-28`.

UI: a small flex row, gap 6px, dot diameter ~14px. Use the same UTC-based date math as `computeStreak`.

**Tests required:**

`tests/unit/dashboard/streak-dots.test.ts` — pure function:
1. Empty log set → 7 entries, all unfilled, last is `isToday`.
2. Logs for today + yesterday → last two filled.
3. Spans week boundary correctly (no off-by-one).

**Acceptance criteria:**
- Dots render in the dashboard hero.
- Filled count matches the actual logs in the last 7 UTC days.
- "Today" dot is visually distinct.
- ≥ 3 unit tests for `streakDots()` passing.

**Rules to apply:**
- None new — UI on existing data.

---

### Task C2 — Export-everything button

**Files affected:**
- `supabase/migrations/0026_export_log.sql` (new — see SQL above)
- `app/api/export/route.ts` (new)
- `app/(app)/account/page.tsx` (new — minimal page)
- `app/(app)/account/account.css` (new)
- `app/(app)/layout.tsx` (extend nav to include Account link)
- `tests/unit/export/route.test.ts` (new)
- `package.json` — add `archiver` dep if not present (`pnpm add archiver` + `pnpm add -D @types/archiver`)

**What to build:**

#### Migration `0026_export_log.sql`

Per the schema in the Data model section above. Idempotent.

#### `/api/export` route

`GET /api/export` — returns a ZIP archive of the member's data. Stream response.

Steps:
1. Get user from server-side **user-context** Supabase client (`createClient()` from `lib/supabase/server`). If not signed in, 401.
2. **Use that user-context client first** for all reads. RLS on every relevant table allows the member to read their own rows (owner-select policies on `profiles`, `health_profiles`, `risk_scores`, `supplement_plans`, `biomarkers.*`, `consent_records`). Only fall back to the admin client if a specific table cannot be read in this context — and if you do, every query MUST be explicitly filtered by `.eq('user_uuid', user.id)` (or `.eq('id', user.id)` for `profiles`). Document any admin-client query in a top-of-file comment.
3. Fetch in parallel:
   - `profiles` row (full)
   - All `health_profiles` versions for the user
   - All `risk_scores` rows
   - All `supplement_plans` rows
   - All `biomarkers.lab_results`
   - All `biomarkers.daily_logs`
   - All `consent_records`
4. Serialize to JSON with stable key order. One file per table inside the archive (`profile.json`, `health_profiles.json`, etc.).
5. Render the latest PDF report via `lib/pdf/report-doc.tsx::ReportDocument` and add as `report.pdf`.
6. Stream as `application/zip`, filename `longevity-coach-export-YYYY-MM-DD.zip`.
7. Insert a row into `public.export_log` with `format='zip'`, `byte_size = …`, `request_ip = req.headers.get('x-forwarded-for') ?? null`. Wrap the insert in try/catch so an audit-log failure never blocks the export response.

Use `archiver` for ZIP streaming. Pattern:
```ts
import archiver from "archiver";
import { Readable } from "node:stream";
const archive = archiver("zip", { zlib: { level: 9 } });
// pipe to response …
```

If `archiver` doesn't fit Next.js runtime cleanly, fall back to a single concatenated JSON document with a base64-encoded PDF attachment field. Document whichever is chosen.

`export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"` at the top of the route.

#### `/account` page (minimal)

```tsx
// app/(app)/account/page.tsx
export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Identity card with member name + email + DOB.
  // "Download my data" button → href="/api/export" download
  // Single info paragraph: "Includes everything we hold: profile, assessments,
  // risk scores, supplement plans, lab results, daily logs, consent history,
  // and your latest PDF report. ZIP format."
}
```

Add to nav in `app/(app)/layout.tsx` between Documents and Sign out:
```tsx
{ href: "/account", label: "Account" },
```

Add `/account` to `PROTECTED_PREFIXES` if not already there. (Confirm via grep — earlier check-in change added `/check-in`, `/report`, `/account` so this is already in place.)

#### Tests

`tests/unit/export/route.test.ts`:
1. Builds a mock Supabase admin client returning canned data.
2. Calls a `buildExportPayload(userId)` helper extracted from the route.
3. Asserts the returned object has all expected keys.

Pure-function tests only — don't try to mock `archiver` streaming. The actual zip-streaming is integration territory; document a manual smoke test.

**Acceptance criteria:**
- Migration `0026` applied (operator step, may need Management API again per AI-track drift).
- `/account` page renders, button links to `/api/export`.
- `/api/export` returns a ZIP for a signed-in user; 401 otherwise.
- ZIP contains: `profile.json`, `health_profiles.json`, `risk_scores.json`, `supplement_plans.json`, `lab_results.json`, `daily_logs.json`, `consent_records.json`, `report.pdf`, `manifest.json` (one-line metadata: user UUID truncated to first 8 chars, export timestamp, archive version 1).
- One `export_log` row per export (best-effort).
- Account link visible in app nav.
- No PII in logs (confirm via search).

**Rules to apply:**
- `.claude/rules/security.md` — admin client justified for cross-table aggregate; route must verify auth before any DB call; no PII in logs.
- `.claude/rules/data-management.md` — `export_log` is non-PII (UUID + timestamps + size); no derived data; PII still in `profiles` only.
- `.claude/rules/database.md` — RLS on new table.

---

## Build order

All four tasks are file-disjoint. Dispatch in parallel.

## Per-task review gate

Spec compliance + code quality reviews per task. Both must pass before marking complete.

## Definition of done (whole change)

1. All four tasks ✅ on both reviews.
2. `pnpm build` clean.
3. `pnpm test` green with ≥ 10 new tests across export + check-in + streak dots.
4. Migration `0026` applied to remote.
5. Manual: hit `/api/export` while signed in, get a ZIP file, open it, confirm contents.
6. Manual: submit a check-in with steps + water, return to dashboard, see those tiles populated.
7. Manual: see Mon-Sun dot strip in the dashboard hero.
8. CHANGELOG.md, EXECUTIVE_SUMMARY.md, QA_REPORT.md present.

---

## Status delta (2026-04-28 PM)

A Phase 2 research pass found that B2, B3, and D2 had already been partially or fully implemented before this dev-loop run started. The original task descriptions above remain authoritative as the **specification** each subagent reviews against — but the **work remaining** is much smaller than "all four tasks parallel from scratch." This section is the source of truth for what subagents are dispatched to do.

### Implementation state per item

| Item | Code | Tests | Docs | Remaining work |
|---|---|---|---|---|
| **B2** Steps + water | ✅ Done — `validation.ts` (pure helper), `actions.ts`, `_components/check-in-form.tsx`, `page.tsx` recent-log row all updated. `daily_logs.steps`/`water_ml` columns shipped in `0010`. | ❌ `tests/unit/check-in/` exists but is empty | n/a | Write `tests/unit/check-in/validation.test.ts` — minimum 4 cases per spec |
| **B3** Streak dots | ✅ Done — `streakDots()` exported from `dashboard/page.tsx`, hero renders `lc-streak-dot` strip, `dashboard.css` styled | ⚠️ `tests/unit/dashboard/streak-dots.test.ts` exists — needs spec audit | n/a | Audit existing test against spec's 3 required cases; add any missing case; verify `pnpm test` green |
| **D2** Gitleaks | ✅ Done — `.github/workflows/secrets.yml` valid, `.gitleaks.toml` extends default with commented allowlist sample (note: file uses modern `[[allowlists]]` syntax, not the `[allowlist]` shown in the original spec — modern syntax is correct, spec was stale) | n/a | ❌ Manual verification step not documented | Add a 3–5 line "How to verify locally" block to `docs/engineering/changes/2026-04-28-p1-polish/CHANGELOG.md` (written in Phase 8) |
| **C2** Export | ❌ Nothing built | ❌ No tests | ❌ No docs | Full greenfield: migration `0026`, `/api/export` route, `/account` page, layout nav update, tests, dep install |

### Revised dispatch plan

**Task C2** is the only greenfield subagent dispatch. Run it first (longest-running) per the original spec above.

**Tasks B2-tests, B3-test-audit, D2-doc** are small enough that they can run as a **single bundle subagent** ("P1 polish test backfill") rather than three separate dispatches. Bundle scope:

1. Write `tests/unit/check-in/validation.test.ts` covering the four cases in B2's "Tests required" block (`steps = -5` rejected, `steps = 200000` rejected, `water_glasses = 99` rejected, valid record returned for `steps=8000, water_glasses=6`). Import `parseCheckInForm` from `app/(app)/check-in/validation.ts`. Use the existing test harness (vitest based on `tests/setup.ts`).
2. Read `tests/unit/dashboard/streak-dots.test.ts` and verify it covers (a) empty-set returns 7 unfilled with `isToday` last, (b) today + yesterday filled, (c) week-boundary correctness. Add any missing case. Do not duplicate cases.
3. No code-side changes required for D2; subagent confirms `.github/workflows/secrets.yml` and `.gitleaks.toml` exist and parse, then writes a 3-line "Verify locally with `gitleaks detect --source=. --no-git`" note that will be picked up by the Phase 8 CHANGELOG author. Capture this note in the subagent's HANDOFF.

### Build order (revised)

1. **C2** (subagent dispatch — full greenfield): migration → route → page → layout nav → tests → dep. Per-task spec + quality reviews per skill rules.
2. **P1-polish-test-backfill** (subagent dispatch — bundle): B2 tests + B3 audit + D2 doc note. Single spec review (against the three sub-acceptance criteria), single quality review.

These two dispatches are file-disjoint (C2 touches `app/api/`, `app/(app)/account/`, `supabase/migrations/`, `app/(app)/layout.tsx`; backfill bundle touches `tests/unit/check-in/`, `tests/unit/dashboard/`, no app code) and can run in parallel.

### Acceptance criteria for the change as a whole (unchanged from original DoD, restated)

1. ✅ B2/B3/D2 implementations match spec (already true per research).
2. C2 implementation matches spec — migration applied, ZIP returns for signed-in user, `/account` renders, nav has Account link.
3. `tests/unit/check-in/validation.test.ts` ≥ 4 passing cases.
4. `tests/unit/dashboard/streak-dots.test.ts` ≥ 3 passing cases.
5. `tests/unit/export/route.test.ts` ≥ 1 passing case (per C2 plan).
6. `pnpm build` clean, `pnpm test` green.
7. CHANGELOG, EXECUTIVE_SUMMARY, QA_REPORT written including D2 manual-verify note.

### Plan-review addenda (2026-04-28 PM, post Phase 4)

The plan reviewer cleared the plan APPROVED WITH NOTES. The following are mandatory for the C2 subagent and recommended for QA:

**Required (C2 subagent must follow):**
- `export_log` inserts use the **admin client** with a one-line justification comment in the route (no insert policy exists on the table; service-role-only insert is by design).
- Before relying on the user-context client, **verify owner-select RLS policies exist** on `biomarkers.lab_results`, `biomarkers.daily_logs`, `public.supplement_plans`, `public.risk_scores`, `public.consent_records`, `public.health_profiles`. For any table missing an owner-select policy, fall back to the admin client with an explicit `.eq('user_uuid', user.id)` (or `.eq('id', user.id)` for `profiles`) and a top-of-file comment listing each admin-client query.

**Recommended (C2 subagent should follow unless cost outweighs benefit):**
- Soft per-table row cap of 10000 with a `truncated: true` flag emitted into `manifest.json` for any table that hit the cap. Keeps response size bounded for power users.
- Aim for ≥ 3 cases in `tests/unit/export/route.test.ts` (payload shape, expected table set, manifest shape) so the change clears the ≥ 10-test DoD comfortably.
- Document archiver-vs-JSON-fallback choice explicitly in the HANDOFF so QA knows which path was taken.

### Out of scope (carried forward from original plan, plus deferrals from research)

- D3 (Sentry) — deferred per user.
- Right-to-erasure (C4).
- Steps/water trend charts (B5).
- Adding `/check-in` to layout nav (pre-existing gap, not introduced by this change).
- Backfilling migration numbers 0021–0024 (intentionally never reused; gap is historical).
