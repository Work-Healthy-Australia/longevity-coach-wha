# Sentry — operational setup

Code is fully wired. The only thing standing between us and live error monitoring is setting `NEXT_PUBLIC_SENTRY_DSN` in Vercel.

## Current state

- `@sentry/nextjs` installed.
- Three init files: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`.
- All three guard with `enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN` — Sentry stays dark until the DSN is set, no hard error in preview environments (matches the "missing optional keys silently no-op" rule in `.claude/rules/security.md`).
- `app/global-error.tsx` calls `Sentry.captureException(error)` for unhandled client errors.
- `instrumentation.ts` registers the server/edge configs.
- Source-map upload handled by `@sentry/nextjs` build plugin via `SENTRY_AUTH_TOKEN` (build-time only).

## One-time activation

1. Create a Sentry project at <https://sentry.io> for the `longevity-coach` org (or use the existing one). Pick the **Next.js** platform.
2. Copy the project DSN (looks like `https://abc123@o123456.ingest.sentry.io/789`).
3. Generate a Sentry auth token with `project:releases` and `org:read` scopes.
4. In the Vercel dashboard for `longevity-coach-wha`, add three environment variables to **Production** and **Preview**:

   | Variable | Value | Visibility |
   |---|---|---|
   | `NEXT_PUBLIC_SENTRY_DSN` | the DSN from step 2 | Plain |
   | `SENTRY_AUTH_TOKEN` | the auth token from step 3 | Encrypted |
   | `SENTRY_ORG` / `SENTRY_PROJECT` | only if multi-project | Plain |

5. Trigger a redeploy (`vercel --prod` or merge to `main`) so the new env vars are baked in.
6. From the deployed site, hit `/api/__sentry-test` (or any client-side error trigger) and confirm the exception lands in the Sentry issues view.

## Sample rate guidance

`tracesSampleRate: 0.1` and `replaysOnErrorSampleRate: 1.0` are the defaults today. Tune downward if quota becomes an issue — never above `0.5` without a monthly cost check.

## What we do NOT capture

- PII in breadcrumbs — strip `Authorization` headers, `email`, `full_name`, `date_of_birth` before sending. The default Sentry SDK already redacts cookies; verify with the first real exception.
- Anthropic prompt bodies — never include questionnaire responses or chat transcripts in a captured exception. If a Claude API call fails, log only the model + status code + error class.

## Verifying it's off in preview

Run `pnpm dev` without `NEXT_PUBLIC_SENTRY_DSN` set and trigger a deliberate error. The console should show no `[Sentry]` init logs and no network requests to `ingest.sentry.io`. Confirmed by the `enabled` flag in each init file.
