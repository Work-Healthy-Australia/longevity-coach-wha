# QA Report: P1 Polish — Gitleaks, check-in fields, streak dots, export-everything
Date: 2026-04-28
Reviewer: QA subagent

## Build status
pnpm build: PASS (TypeScript clean, 25 routes generated; one non-fatal Turbopack warning about workspace root inferring `/Users/jlm/package-lock.json` due to a parent lockfile — environmental, not introduced by this change).
pnpm test: PASS (172 tests across 28 suites, 0 failures, 0 skipped, 4.12s).

## Test results
| Suite | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| tests/unit/check-in/validation.test.ts | 6 | 6 | 0 | 0 |
| tests/unit/dashboard/streak-dots.test.ts | 6 | 6 | 0 | 0 |
| tests/unit/export/route.test.ts | 4 | 4 | 0 | 0 |
| Other suites (25 files) | 156 | 156 | 0 | 0 |
| **Total** | **172** | **172** | **0** | **0** |

New-test count for this change: 16 (≥ 10 DoD requirement satisfied; B2 = 6, B3 = 6, C2 = 4).

## Findings

### Confirmed working

**File presence (all required deliverables exist):**
- `supabase/migrations/0026_export_log.sql` — present, idempotent (`create table if not exists`, `drop policy if exists`/`create policy`, RLS enabled, owner-select only).
- `app/api/export/route.tsx` — present, `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
- `app/(app)/account/page.tsx`, `app/(app)/account/account.css` — both present.
- `app/(app)/layout.tsx` — Account link present at line 45 (`{ href: "/account", label: "Account" }`).
- `tests/unit/check-in/validation.test.ts` — 6 cases (≥ 4 required): negative steps, steps > 60000, water_glasses > 20, valid happy-path with glasses→ml conversion, mood out of range, NaN steps.
- `tests/unit/dashboard/streak-dots.test.ts` — 6 cases (≥ 3 required): empty log set, today filled, today+yesterday filled, UTC consistency past noon, ordering oldest→newest, Sunday→Monday week boundary.
- `tests/unit/export/route.test.ts` — 4 cases (≥ 3 recommended): payload top-level keys, UUID truncated to 8 chars, truncated flag at row cap, manifest archive_version + ISO timestamp.
- `.github/workflows/secrets.yml` and `.gitleaks.toml` — both present.
- `archiver ^7.0.1` and `@types/archiver ^7.0.0` — both in `package.json`.

**Data integrity claims spot-checked in `app/api/export/route.tsx`:**
- Manifest truncates `user_uuid` to first 8 chars only (`user_uuid_prefix: userId.slice(0, 8)`, line 160). Field name explicitly labelled non-PII in the type. Confirmed by test `truncates user UUID to first 8 chars`.
- No `console.log`/`console.error`/`console.warn` calls anywhere in the export route or `/account` page. The only `user_uuid` reference outside DB queries is the audit-log insert payload — nothing logged to stdout/stderr.
- `export_log` insert wrapped in `try { … } catch { /* swallow */ }` (lines 295–308) with explicit comment "audit failure must not break the export". Best-effort, non-blocking.
- Reads use the user-context Supabase client (RLS-enforced); admin client used only for the `export_log` insert with a documented top-of-file justification (no insert policy on the table by design).
- Soft per-table cap of 10000 rows applied to all queries; manifest emits `truncated: true` per table when reached.
- Stable JSON.stringify with sorted keys for deterministic byte output.
- ZIP contains all required artefacts: `profile.json`, `health_profiles.json`, `risk_scores.json`, `supplement_plans.json`, `lab_results.json`, `daily_logs.json`, `consent_records.json`, `manifest.json`, `report.pdf`.

**Migration 0026 schema review:** matches plan — UUID PK, FK to `auth.users(id) on delete cascade`, `format` check constraint (`json|zip|pdf`), RLS enabled, owner-select policy, index on `user_uuid`. No insert policy (service-role only by design — matches plan addendum).

### Deferred items
- **Operator must apply migration 0026** to remote Supabase. Not applied automatically by this change.
- **TypeScript types regen** required after migration applies — `export_log` row is currently cast to `never` in the route insert (line 299–305). Run `supabase gen types typescript` post-deploy and remove the casts.
- **Manual smoke test** of `/api/export` end-to-end against a real signed-in fixture user (open ZIP, validate contents) — not run as part of this QA pass.
- **D2 manual-verify note** for gitleaks (`gitleaks detect --source=. --no-git`) — to be picked up by Phase 8 CHANGELOG author per plan handoff.

### Known limitations
- `archiver` buffers the full ZIP payload to memory before responding (`Buffer.concat(chunks)` at line 272 → returned as a single `Response` body). Acceptable for typical members; could OOM for power users with extreme row counts. Mitigated by the 10000-row soft cap per table.
- `request_ip` audit field uses `x-forwarded-for` header only — fine on Vercel/standard proxies, may be `null` in other environments.
- No rate-limiting on `/api/export`. A signed-in user can trigger repeated exports; each writes one `export_log` row. Acceptable for current scale.
- Dashboard "today's tile" UTC-date convention documented in plan — members in UTC+11 just past midnight local will see the new UTC date; this is intentional and matches the existing `computeStreak` writer convention.

## Verdict
APPROVED.

Build is clean, all 172 tests pass including the 16 new tests for this change, every deliverable file is in place, dependencies are declared, and the C2 data-integrity guarantees (UUID truncation, no PII logging, non-blocking audit) hold up under inspection. Ship it after the operator applies migration 0026 and regenerates Supabase types.
