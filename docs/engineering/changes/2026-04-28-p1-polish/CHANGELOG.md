# Changelog: P1 Polish — Gitleaks, check-in fields, streak dots, export-everything
Date: 2026-04-28
Phase: 2 (Intelligence) polish + slice of 1 (Foundation hardening)

## What was built

- **B2 — Steps and water in daily check-in.** The `/check-in` form now captures steps and water (in glasses, stored as ml). Dashboard "Steps" and "Water" tiles populate from real data instead of falling back to `—`.
- **B3 — Mon-Sun streak dot UI.** The dashboard hero now shows a horizontal strip of seven dots, oldest → newest, indicating which of the last seven UTC days have a check-in logged. Today's dot is visually distinct.
- **D2 — Gitleaks secret scanning.** GitHub Actions workflow `Secret scan` runs `gitleaks/gitleaks-action@v2` on every pull request and every push to `main`. Failing scan blocks the PR. `.gitleaks.toml` extends the default ruleset and ships a commented `[[allowlists]]` template for future doc/test false positives.
- **C2 — Export-everything.** A signed-in member can hit `/account` and click "Download my data" to receive a ZIP archive of every patient-facing record we hold, plus the latest PDF report. Per-table soft cap of 10,000 rows; truncation flags surface in `manifest.json`. Each export inserts an audit row into the new `public.export_log` table.

## What changed

- `app/(app)/check-in/validation.ts` — new pure helper `parseCheckInForm` (extracted earlier; now under test).
- `app/(app)/check-in/actions.ts` — writes `steps` + `water_ml` to `biomarkers.daily_logs`.
- `app/(app)/check-in/_components/check-in-form.tsx` — adds steps and water-glasses inputs.
- `app/(app)/check-in/page.tsx` — recent-log row formatting includes steps + water.
- `app/(app)/dashboard/page.tsx` — exports `streakDots()` helper; renders the dot strip in the hero.
- `app/(app)/dashboard/dashboard.css` — dot-strip styling.
- `app/(app)/layout.tsx` — `Account` nav entry between `Documents` and `Sign out`.
- `app/(app)/account/page.tsx` (new) — minimal identity card + download button + info paragraph.
- `app/(app)/account/account.css` (new) — sage-palette styling.
- `app/api/export/route.tsx` (new) — `GET` handler with `runtime="nodejs"` and `dynamic="force-dynamic"`. Pure helpers `buildExportPayload` and `buildManifest` extracted for testability.
- `tests/unit/check-in/validation.test.ts` (new) — 6 cases covering steps/water/mood validation and glasses → ml conversion.
- `tests/unit/dashboard/streak-dots.test.ts` — added Sun→Mon week-boundary case (6 cases total).
- `tests/unit/export/route.test.ts` (new) — 4 cases: payload shape, UUID truncation, cap-truncation flag, manifest version/timestamp.
- `.github/workflows/secrets.yml` (new) — Gitleaks workflow.
- `.gitleaks.toml` (new) — extends default ruleset; commented allowlist template.
- `package.json`, `pnpm-lock.yaml` — added `archiver` and `@types/archiver`.

## Migrations applied

- `0026_export_log.sql` — `public.export_log` append-only audit table. Columns: `id` (uuid PK), `user_uuid` (FK → `auth.users`, on-delete cascade), `exported_at` (timestamptz), `format` (check `('json','zip','pdf')`), `byte_size` (int), `request_ip` (text), `created_at` (timestamptz). RLS enabled with owner-select policy. No insert policy — service-role-only insert by design (admin client from `/api/export`). Index on `user_uuid`. Idempotent (`if not exists`, `drop policy if exists`).

**Operator follow-ups:**

1. Apply `0026_export_log.sql` to the remote Supabase instance.
2. Regenerate `lib/supabase/database.types.ts`:
   ```
   supabase gen types typescript --local > lib/supabase/database.types.ts
   ```
   After this, drop the two `as never` casts on the `export_log` insert in `app/api/export/route.tsx`.
3. Run a manual smoke test of `/api/export` while signed in: download the ZIP, inspect the contents, confirm `manifest.json` and `report.pdf` round-trip cleanly.

## Deviations from plan

- **B2/B3/D2 were partially or fully shipped** before the dev-loop run started, so the original "four tasks parallel from scratch" structure became "C2 greenfield + a small test-backfill bundle." The original PLAN.md was retained as the per-task spec; a "Status delta" section was appended to record the actual dispatch shape.
- Spec said `app/api/export/route.ts`; implementation is `route.tsx` because the route renders the PDF via JSX (`<ReportDocument />`). Justified deviation, noted in review.
- `.gitleaks.toml` uses `[[allowlists]]` (modern v8 syntax) rather than the spec's stale `[allowlist]`. Modern syntax is correct.

## Known gaps / deferred items

- Operator migration apply + types regen + casts cleanup, per "Operator follow-ups" above.
- `request_ip` from `x-forwarded-for` is stored as the raw header value; if behind multiple proxies, future cleanup should split on `,` and take the first hop.
- Archiver buffers the entire ZIP in memory before responding (`Buffer.concat`). Adequate for current data volumes; revisit when a power user with > 10k rows in a single table appears or when total archive size exceeds ~50 MB.
- Soft per-table cap of 10,000 rows. Members exceeding this for any table will see `truncated: true` in `manifest.json`. No pagination yet.
- Right-to-erasure (C4) is a separate change.
- `/check-in` is still missing from the layout nav (pre-existing gap, not introduced here).

## D2 — How to verify locally

Run a one-shot scan over the working tree (no git history needed):

    gitleaks detect --source=. --no-git --redact

In CI, look for a green check on the **Secret scan** workflow on every PR and on pushes to `main`; a failing scan blocks the PR. Extend `.gitleaks.toml` with a `[[allowlists]]` block to silence documented false positives.
