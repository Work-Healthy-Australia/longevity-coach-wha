# Technical Debt Log — Longevity Coach

Things that work but shouldn't ship long-term. Bugs go in [QA-bugs.md](./QA-bugs.md). Architecture decisions go in [docs/architecture/](../architecture/). This file is for everything in between: stubs left behind, silently-swallowed errors, brittle patterns, places where "it works for now" was on purpose.

Severity:
- **High** — actively masking bugs or compounding cost. Pay down this sprint.
- **Medium** — slows new work or risks future regressions. Pay down this phase.
- **Low** — annoyance only; pay down opportunistically.

Status: `OPEN`, `IN-PROGRESS`, `RESOLVED`.

---

## Open

| ID | Severity | Area | Title | First flagged | Status |
|---|---|---|---|---|---|
| TD-001 | High | observability | Pervasive swallow-then-log error pattern across pipelines + clinician actions | 2026-05-01 | OPEN |
| TD-002 | High | database | Canonical schema files exist for ≈3 tables out of 77 migrations | 2026-05-01 | OPEN |
| TD-003 | High | auth | Route protection split between proxy.ts and page-level checks | 2026-05-01 | OPEN |
| TD-004 | High | privacy | 12+ `console.log` calls in production server + client paths | 2026-05-01 | OPEN |
| TD-005 | Medium | dx | Sentry `disableLogger` deprecation warning on every dev boot | 2026-05-01 | OPEN |
| TD-006 | Medium | dx | Multiple-lockfile warning at Next dev startup | 2026-05-01 | OPEN |
| TD-007 | Medium | code-health | Dead A/B variant `<section class="hero-b">` in home page DOM | 2026-05-01 | OPEN |
| TD-008 | Medium | code-health | Pre-rebrand "longevity-coach.io" / "Longevity Coach Ltd" strings still in user-facing surfaces | 2026-05-01 | OPEN |
| TD-009 | Medium | error-handling | Care-team server actions echo raw Supabase error messages back to the client | 2026-05-01 | OPEN |
| TD-010 | Medium | error-handling | Inconsistent server-action result shapes (some `{ error }`, some `{ error, reason? }`) | 2026-05-01 | OPEN |
| TD-011 | Low | code-health | Stale `.gitkeep` files in directories that now have content | 2026-05-01 | OPEN |
| TD-012 | Low | code-health | TypeScript non-null assertions used on `user!.id` in pages that depend on proxy.ts | 2026-05-01 | OPEN |

## Resolved

| ID | Severity | Area | Title | Resolved | Notes |
|---|---|---|---|---|---|

---

## Detail

### TD-001 — Pervasive swallow-then-log error pattern

**Severity:** High. **Status:** OPEN. **Area:** observability.

**Pattern:** several pipelines and server actions catch errors and `console.error`/`warn` them, then return without surfacing the failure to the caller.

**Why this matters:** this is the same class of error that hid BUG-009 for 48 hours (every `risk_scores.narrative` was null and nobody noticed because the catch silently logged and returned). It is also the proximate cause of BUG-010 — the deterministic-scorer onConflict mismatch is "caught and logged" rather than failing loudly. Epic 14 already calls out "silent-error monitoring" as the long-term fix, but every new instance of this pattern adds new places where the same bug class can hide.

**Examples (non-exhaustive):**
- [app/clinician/actions.ts:129-131](app/clinician/actions.ts:129) — Resend email failure caught + logged, function returns success regardless. User sees "Approved and sent" even when no email was sent.
- The deterministic risk-score writer flagged in BUG-010 in epic-status.md ("the caller catches and logs `[risk-engine] risk_scores upsert failed:` and swallows").
- The proxy's `paused_at` check at [lib/supabase/proxy.ts:105](lib/supabase/proxy.ts:105) silently fails-open on any DB error. Defensible as "don't lock users out" but should at least Sentry-capture.

**Pay-down:** introduce a `assertOrCapture(err, ctx)` helper that surfaces to Sentry with a structured tag (`bug_class: silent_swallow`), and ban bare `catch { console.error(...) }` in lib/ via lint rule once Sentry DSN is wired.

---

### TD-002 — Canonical schema vs. migration drift

**Severity:** High. **Status:** OPEN. **Area:** database.

**State:** [supabase/migrations/](supabase/migrations/) has 77 files. [supabase/schema/](supabase/schema/) has 3 tables in `public/`, ~9 in `billing/`. Per [.claude/rules/database.md](.claude/rules/database.md): "These files are the source of truth for what a table looks like — not the migration history."

**Why this matters:** PR review, RLS audits, and right-to-erasure planning all depend on knowing the current shape of every table without replaying 77 migrations in your head. Tables added by migrations like `agent_definitions`, `health_updates`, `conversation_summaries`, `admin_invites`, `deceased_log`, `notification_prefs`, `care_team_access`, etc. have no canonical files. Drift compounds with every PR.

**Pay-down:** one focused PR that walks the live schema (`information_schema.tables` in the `longevity-coach-test` project) and emits a canonical .sql file per table. Make the build fail if a migration adds a `CREATE TABLE` and no canonical file is added in the same PR.

---

### TD-003 — Route protection split between proxy and pages

**Severity:** High. **Status:** OPEN. **Area:** auth.

**State:** [lib/supabase/proxy.ts:4](lib/supabase/proxy.ts:4) `PROTECTED_PREFIXES` covers `/dashboard /onboarding /admin /uploads /check-in /report /account /labs /trends /simulator /clinician /coach /org`. Missing: `/insights /journal /care-team /alerts /routines`. Those routes have their own page-level `if (!user) redirect("/login")` checks. Some don't even have that — [app/(app)/insights/page.tsx:30](app/(app)/insights/page.tsx:30) reads `user!.id` with no null-guard, relying entirely on the proxy.

**Why this matters:** [.claude/rules/security.md](.claude/rules/security.md) explicitly says "Do not add ad-hoc auth checks inside pages or server actions — the proxy handles it." We have both styles in the same codebase. Same problem for `/admin` role-gating — the proxy only requires login, the role check lives in [app/(admin)/layout.tsx:25](app/(admin)/layout.tsx:25). Defense-in-depth in this case but inconsistent with the documented pattern.

This is also the root cause of [BUG-024](./QA-bugs.md#open) — page-level redirects don't preserve the post-login destination.

**Pay-down:** add the missing routes to `PROTECTED_PREFIXES`, delete the page-level `redirect("/login")` calls, replace `user!.id` with non-null guards, and lift the `/admin` role gate up into the proxy.

---

### TD-004 — `console.log` in production paths

**Severity:** High (privacy). **Status:** OPEN. **Area:** privacy.

**State:** 12+ instances. Some are structured telemetry (fine), some carry payloads.

**Notable:**
- [app/(app)/report/_components/janet-chat.tsx:135](app/(app)/report/_components/janet-chat.tsx:135) — logs full realtime payload (message rows from `agent_conversations`) in the browser console. Conversations may contain health questions, supplement names, the patient's own words. Anyone with DevTools open or a page-watching extension reads them.
- [app/(app)/report/_components/janet-chat.tsx:140](app/(app)/report/_components/janet-chat.tsx:140) — subscribe-status log including `err`.
- [app/api/cron/drip-emails/route.ts:102](app/api/cron/drip-emails/route.ts:102) — should review whether the logged payload includes member emails or names.
- Various `[supplement-protocol route] Pipeline completed for user ${userId}` and `[meal-plan route] starting pipeline for user ${userId}` lines log user UUIDs to stdout. Less critical than chat content but still PII-adjacent and persists wherever stdout goes.

**Pay-down:** replace with the existing telemetry layer (Sentry breadcrumbs / structured event emit), wrap in `process.env.NODE_ENV !== "production"` for any developer-debug logs, and add an ESLint rule to ban `console.log` in `lib/` and `app/(app)/`.

---

### TD-005 — Sentry `disableLogger` deprecation

**Severity:** Medium. **Status:** OPEN. **Area:** dx.

**State:** every dev boot prints `[@sentry/nextjs] DEPRECATION WARNING: disableLogger is deprecated and will be removed in a future version. Use webpack.treeshake.removeDebugLogging instead. (Not supported with Turbopack.)`.

Setting lives in [next.config.ts:19](next.config.ts:19). The recommended replacement isn't supported under Turbopack, so this needs investigation rather than a blind swap.

**Why it matters:** future Sentry upgrade hard-removes the option; `pnpm build` will fail when it does. Dev-log noise also conditions developers to ignore boot warnings, which is how BUG-009 hid for 48 hours.

---

### TD-006 — Multi-lockfile workspace warning

**Severity:** Medium. **Status:** OPEN. **Area:** dx.

**State:** Next dev prints "We detected multiple lockfiles and selected the directory of `/Users/davepro/package-lock.json` as the root directory." A user-level `package-lock.json` competes with the project's `pnpm-workspace.yaml`. Turbopack picks the wrong one.

**Pay-down:** set `turbopack.root` in [next.config.ts](next.config.ts) to pin the workspace root, or remove the stray `~/package-lock.json` if it's a leftover.

---

### TD-007 — Dead A/B variant `<section class="hero-b">` in home DOM

**Severity:** Medium. **Status:** OPEN. **Area:** code-health.

**State:** [app/(public)/page.tsx:109](app/(public)/page.tsx:109) renders an entire alternative hero (`hero-b` + `hero-b-visual`) that is hidden via `[data-hero="a"] .hero-b { display: none }` in [home.css:768](app/(public)/home.css:768). The hidden text reads "5,400+ members enrolled across the UK, UAE & Vietnam" and "−2.8 yrs median bio-age reduction after 90 days on protocol".

**Why it matters:**
1. It's a payload tax — every home-page request ships markup nobody sees.
2. The hidden text mentions wrong markets (UK / UAE / Vietnam — not Australia) and unverified claims ("5,400+ members", "−2.8 yrs median"). If the variant flag flips, those go live unreviewed.
3. Any future a11y or scrape will still see the text and treat it as canonical.

**Pay-down:** delete the variant, or move it behind a server-side flag so only the active variant is rendered.

---

### TD-008 — Pre-rebrand strings still in user-facing surfaces

**Severity:** Medium. **Status:** OPEN. **Area:** code-health.

**Examples found:**
- [app/(public)/_components/footer.tsx:24](app/(public)/_components/footer.tsx:24) — "© 2026 · LONGEVITY COACH LTD" (also tracked as [BUG-015](./QA-bugs.md))
- [app/api/export/route.tsx:310](app/api/export/route.tsx:310) — `longevity-coach-export-${date}.zip` ([BUG-020](./QA-bugs.md))

This appears to be the long tail of the [#74](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/74) `janet.care` consolidation. Worth a follow-up grep across `app/`, `lib/`, and `emails/` for any remaining "Longevity Coach" / "longevity-coach.io" strings the rename didn't catch.

---

### TD-009 — Care-team actions echo raw Supabase error messages

**Severity:** Medium. **Status:** OPEN. **Area:** error-handling.

**State:** [app/(app)/care-team/actions.ts:82,119,150](app/(app)/care-team/actions.ts:82) returns `{ error: insertErr?.message }`. Supabase error strings can include column names, constraint names, and occasionally row IDs. None of that should reach the user.

**Pay-down:** map known constraint codes to user-facing strings; everything else returns a generic `"Something went wrong. Please try again."` and Sentry-captures the raw error.

---

### TD-010 — Inconsistent server-action result shapes

**Severity:** Medium. **Status:** OPEN. **Area:** error-handling.

**State:** `cancelBooking` returns `{ error, reason? }`. `requestBooking` and most others return `{ error }`. Auth actions return `{ error?, success?, values? }`. There is no shared `ActionResult<T>` type.

**Why it matters:** every form component branches on the response shape; a typo in one consumer becomes a silent UX bug. Also blocks a clean `useActionState` migration.

**Pay-down:** define `ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string; field?: string }` in `lib/actions.ts` and migrate over the next 2-3 PRs.

---

### TD-011 — Stale `.gitkeep` files

**Severity:** Low. **Status:** OPEN. **Area:** code-health.

**State:** `lib/ai/.gitkeep` and `lib/pdf/.gitkeep` still exist even though both directories are populated. Per [CLAUDE.md](CLAUDE.md): "`.gitkeep` files mark placeholder directories for planned features — do not delete them." Once the dir has content, the marker is misleading.

**Pay-down:** delete .gitkeep when a directory ships its first real file.

---

### TD-012 — `user!.id` non-null assertion in pages

**Severity:** Low. **Status:** OPEN. **Area:** code-health.

**State:** [app/(app)/insights/page.tsx:40](app/(app)/insights/page.tsx:40) and [app/(app)/journal/page.tsx](app/(app)/journal/page.tsx) read `user!.id` without a null-check. This works only because proxy.ts redirects unauthenticated users — but only for routes in `PROTECTED_PREFIXES` (see TD-003). Both files are in the gap.

**Pay-down:** TD-003 fixes the root cause; this becomes a follow-up to swap the assertion for a defensive `if (!user) redirect("/login")` once the routes are properly proxy-gated.

