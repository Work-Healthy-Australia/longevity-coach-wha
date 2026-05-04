# Executive Summary: Signup + email-verify redirect preservation

Date: 2026-05-04
Audience: Product owner

## What was delivered

A new member who tries to open a page that requires sign-in (Insights, Journal, Care Team, etc.), then chooses "Create account" instead of signing in, verifies their email, and clicks Continue — now lands on the page they originally wanted, not on the dashboard.

This closes the second half of the redirect-preservation work. The first half (PR [#131](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/131), shipped earlier today) handled the existing-member path. Together, the entire "I clicked a link, got bounced because I'm not signed in, came back" experience now does the right thing — whether the member already had an account or had to make one.

A small security improvement comes with it: every step of the signup flow now refuses to redirect to anywhere outside the site, blocking a class of phishing-via-redirect attacks. The password-reset flow was carefully preserved so reset emails still land on the reset screen, not somewhere else.

## What phase this advances

Phase 1 — Foundation. Closes the redirect-preservation gap explicitly noted as "out of scope" in PR #131. Reduces the v1.1 backlog by one item.

## What comes next

Per your plan, the next three Phase 1 items in order:
1. **Seed `billing.plans`** — fixes `/pricing` showing `$0.00/mo` with no plan cards
2. **Super Admin assignment UI at `/admin/users`** — currently you grant roles via SQL
3. **Re-enable full CI suite** (Gitleaks, pgTAP RLS regression, E2E, Lighthouse)

Then the larger Phase 1 thrust: **RLS rewrites (migration 0070)** to route all patient-data tables through the new role helpers from PR #113.

## Risks or open items

- The change is auth-flow behavioural and ships to every member without a feature flag. Risk is low (extensive unit + integration tests, code review approved, additive scope), but a brief Sentry watch after deploy is sensible.
- Local verification couldn't exercise the full email-verify bounce (requires Supabase env vars). The callback handler is covered by 12 unit tests and the cross-form link forwarding was verified in the browser on all three relevant pages.
- The `/email-confirmed` allowlist is now open (any safe internal path) instead of restricted to 4 routes. This is intentional and necessary for the new feature, but worth noting as a behavioural change in case we ever want to whitelist again.
