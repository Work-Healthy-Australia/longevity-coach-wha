# Plan: Re-enable Lighthouse on PR triggers

Date: 2026-05-04
Phase: Phase 1 — Foundation (v1.1 backlog, CI re-enable PR-A of 2)
Status: Draft

## Objective

Move the Lighthouse audit job from `extended-ci.yml` (workflow_dispatch only) to `ci.yml` (PR + push to main), so every PR runs an a11y/perf/best-practices audit on the public surfaces (home, dashboard, report).

Done = a PR triggers the Lighthouse job alongside Lint/Typecheck/Build/Tests/Gitleaks; the job builds the app, starts it, runs lhci against 3 URLs, and fails the PR if asserted thresholds are missed.

## Scope

**In scope:**
- `.github/workflows/ci.yml` — add a `lighthouse` job that runs `pnpm build && pnpm exec lhci autorun`
- `.github/workflows/extended-ci.yml` — remove the `lighthouse` job (it lives in ci.yml now)
- First run will surface real audit results; if a threshold fails, decide per-finding (fix code vs lower threshold vs flag for separate PR)

**Out of scope:**
- Adjusting `.lighthouserc.json` thresholds preemptively — only adjust if the first run forces it
- pgTAP and Playwright re-enables — separate PRs (PR-B and deferred-C)
- Authenticated routes (/dashboard, /report) — already in `lighthouserc.json` URL list but they'll bounce to /login since lhci has no session. Lhci treats the redirect as a normal load and audits the redirected page. Acceptable noise for now; may need to drop them from the URL list if they pollute results.

## Data model changes

None.

## Waves

### Wave 1 — Add Lighthouse job to ci.yml + remove from extended-ci.yml (single wave)

**What James can see after this wave merges:** Every PR run shows a "Lighthouse audit" job in the checks list. First few runs may surface real audit failures — these become follow-up PRs.

#### Task 1.1 — Move lighthouse job

Files affected:
- `.github/workflows/ci.yml`
- `.github/workflows/extended-ci.yml`

What to build:

In `ci.yml`, add a new `lighthouse` job after the `build` job:
```yaml
  lighthouse:
    name: Lighthouse audit
    runs-on: ubuntu-latest
    needs: typecheck
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm exec lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

The `pnpm build` step is required because `.lighthouserc.json` declares `startServerCommand: "pnpm start"` which needs the production build to exist.

In `extended-ci.yml`:
- Remove the entire `lighthouse:` job (lines 115-129)
- Remove the lighthouse-block from the documentation comment at the top of the file (lines 27-32)

Acceptance criteria:
- `ci.yml` has a `lighthouse` job
- `extended-ci.yml` no longer has a `lighthouse` job
- Doc comment in `extended-ci.yml` updated to reflect that only pgtap and playwright remain
- A push to main / a PR triggers the job
- The job either passes (cleanly), or fails with actionable output

Rules to apply:
- None — pure CI workflow change

#### Task 1.2 — First-run validation + decision point

After PR-A is merged, the first PR (or push to main) will trigger Lighthouse against the home page on Vercel-equivalent build. Two outcomes:

**(a) PASS** — done, move on to PR-B (pgTAP).

**(b) FAIL** — capture which assertion failed (perf <0.8, a11y <0.9, or best-practices <0.9). Three options:
- Fix the underlying issue (preferred for a11y/best-practices)
- Lower the threshold in `.lighthouserc.json` (acceptable for perf if rooted in third-party scripts we can't control)
- Drop the failing URL from the audit list (acceptable for /dashboard and /report which redirect to /login when unauthenticated)

This task is a placeholder — it'll be addressed via a follow-up PR if needed, not as part of PR-A itself.
