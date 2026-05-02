# CI investigation — 2026-05-02

Why CI was disabled, what's actually broken, and the minimum-viable fix shipped today.

**Status before this work:** PR-triggered CI disabled via [#102](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/102) — `workflow_dispatch:` only because every job failed at boot. Vercel preview was the sole auto-gate. Per Epic 14 in [epic-status.md](docs/product/epic-status.md), this was P0.

**Status after this PR:** Lint, Typecheck, Unit tests, Build, and Gitleaks all run automatically on every PR. pgTAP, Playwright, and Lighthouse remain on `workflow_dispatch:` only with documented unblock work in the new `extended-ci.yml`.

---

## Root causes — one per failing job

### 1. Lint / Typecheck / Unit tests / Build — pnpm version conflict

Every Node.js job was failing at boot in 4–8 seconds with:

```
Error: Multiple versions of pnpm specified:
  - version 10 in the GitHub Action config with the key "version"
  - version pnpm@10.33.0 in the package.json with the key "packageManager"
Remove one of these versions to avoid version mismatch errors like ERR_PNPM_BAD_PM_VERSION
```

**Why:** [`pnpm/action-setup@v4`](https://github.com/pnpm/action-setup) refuses to accept a `version:` parameter when `package.json` already declares `packageManager`. The conflict was introduced when someone added a `packageManager` field to `package.json` (probably for Corepack support) without removing the `version: 10` from the workflows.

**Fix:** removed `version: 10` from all four `pnpm/action-setup@v4` steps in `ci.yml`. The action now reads the version from `package.json` — single source of truth, no conflict.

This single change unblocks Lint, Typecheck, Unit tests, and Build (the latter two were `skipping` because they `needs: typecheck`).

### 2. Gitleaks — paid-licence requirement for organisations

Gitleaks was failing in 8 seconds with:

```
[Work-Healthy-Australia] is an organization. License key is required.
🛑 missing gitleaks license. Go grab one at gitleaks.io and store it as a
   GitHub Secret named GITLEAKS_LICENSE.
```

**Why:** [`gitleaks/gitleaks-action@v2`](https://github.com/gitleaks/gitleaks-action) is a paid wrapper for organisation accounts. The wrapper exists for telemetry / support; the underlying [gitleaks binary](https://github.com/gitleaks/gitleaks) is MIT-licensed and free for any use.

**Fix:** rewrote `secrets.yml` to install the standalone `gitleaks` binary directly (curl + tar) and run `gitleaks detect`. Same scan, no licence cost, no telemetry.

### 3. pgTAP RLS regression — auth.jwt() not defined in bare Postgres

pgTAP was failing in 1m27s — most of which was Docker pulling the Supabase Postgres image. The actual failure:

```
psql:supabase/migrations/0001_init.sql:44: ERROR: function auth.jwt() does not exist
```

**Why:** the migration uses `auth.jwt() ->> 'role'` in an RLS policy. `auth.jwt()` is a Supabase-specific function that lives in the `auth` schema. The Supabase Postgres image we're running in CI provides the `auth` schema (you can see migrations like `grant_auth_roles_to_postgres.sql` running in the boot logs) but does NOT include the `auth.jwt()` function — that's exposed by the GoTrue process which only runs when the full Supabase stack is up via `supabase start`.

**Fix options (chose: defer):**
- (a) Run the full Supabase CLI stack in CI: `supabase start --workdir .` — heaviest but most accurate
- (b) Define a CI-only stub: `create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;` before applying migrations
- (c) Switch from the postgres-services container to spinning up Supabase from CLI inline

(b) is the fastest unblock. (a) is the right long-term answer. **Decision:** defer to v1.1 — pgTAP moves to `extended-ci.yml` (workflow_dispatch only) with the unblock options documented in the file header. Tracking under Epic 14.

### 4. Playwright E2E — no test environment

The job would fail (or pass vacuously) because `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL` are referenced from `${{ secrets.* }}` but those secrets aren't set in the repo.

**Why:** the project never provisioned a `longevity-coach-test` Supabase project + test fixture user. This is called out as the single highest-value QA investment in [qa-plan.md §1 Tier 3](docs/qa/qa-plan.md).

**Fix options (chose: defer):**
- (a) Create the test Supabase project + seed user, store credentials as repo secrets, re-enable on PR
- (b) Run E2E only against Vercel preview deploys, using the `vercel/preview-deploy` job output to find the URL

**Decision:** defer to v1.1 — Playwright moves to `extended-ci.yml`. Provision is non-trivial (~half a day of work).

### 5. Lighthouse — nothing to audit

The job runs `pnpm exec lhci autorun` but there's no Next.js server to point at — no `pnpm build && pnpm start &` precedes it, and no Vercel preview URL is wired through.

**Decision:** defer to v1.1 — Lighthouse moves to `extended-ci.yml`. Easiest fix is to point lhci at the Vercel preview URL once that comment-bot machinery exists.

---

## What changed in this PR

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | Re-enabled `pull_request:` + `push: branches: [main]`. Removed `version: 10` from all four `pnpm/action-setup@v4` steps. Removed pgtap/playwright/lighthouse jobs (moved to extended-ci.yml). |
| `.github/workflows/secrets.yml` | Re-enabled triggers. Replaced `gitleaks/gitleaks-action@v2` with direct `gitleaks` binary install + `gitleaks detect`. |
| `.github/workflows/extended-ci.yml` | NEW — contains pgtap, playwright, lighthouse on `workflow_dispatch:` only. File header documents what blocks each from going back on PR triggers. |
| `docs/qa/ci-investigation-2026-05-02.md` | NEW — this file. |

---

## What you get on Monday

After this PR merges, every PR opened from then on will run:

- ✅ Typecheck (~1 min)
- ✅ Lint (~1 min)
- ✅ Unit tests (~1–2 min, gated on Typecheck)
- ✅ Build (~3 min, gated on Typecheck)
- ✅ Gitleaks (~30 s)

Total CI time per PR: ~5 minutes. Failure modes: real bugs, not infra.

The five jobs above are the actual ship-gate checks — typecheck and build catch most regressions, lint catches code-quality issues, unit tests catch logic regressions, and gitleaks catches accidental secret commits. That's enough to ship Monday with confidence; the deferred jobs (pgTAP, E2E, Lighthouse) are nice-to-have but not load-bearing.

---

## What remains broken (the v1.1 backlog)

Each of the three deferred jobs has its unblock work documented in the header of `extended-ci.yml`. Summary:

| Job | Owner | Estimated unblock work | Dependency |
|---|---|---|---|
| pgTAP RLS regression | TBD | ~1 hour (option b stub) or ~2 hours (option a full stack) | Decide approach |
| Playwright E2E | TBD | ~half a day (provision test Supabase + seed user) | Test Supabase project |
| Lighthouse audit | TBD | ~1 hour (point at Vercel preview URL) | Vercel-comment integration |

All three should land before v1.2. Until then, run them manually via the Actions tab → "Extended CI (manual)" → Run workflow.
