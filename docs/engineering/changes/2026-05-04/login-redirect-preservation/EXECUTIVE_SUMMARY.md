# Executive Summary: Login redirect preservation

Date: 2026-05-04
Audience: Product owner

## What was delivered

If a member tries to open a page that requires sign-in (for example, the Insights page, the Journal, or their Care Team booking), they will now be sent to the sign-in screen, sign in, and land back on the page they originally wanted — instead of being dumped on the dashboard and having to find their way back.

This was the most-cited friction point in the protected-route flow. The fix also closes a small security gap: any link of the form `/login?redirect=https://malicious-site.example/...` is now ignored, so an attacker can't use the sign-in page to bounce a member to an external site.

## What phase this advances

This closes two open Phase 1 bugs (BUG-018 and BUG-024) on the v1.1 backlog from the Monday 2026-05-04 ship plan. Phase 1 — Foundation — moves another step closer to fully done.

## What comes next

Two natural next steps:

1. **Verify on Vercel preview** — open `/insights` while signed out, sign in, confirm you land on Insights (not the dashboard). Then try `/login?redirect=//evil.com` and confirm you land on the dashboard (open-redirect blocked).
2. **Pick the next item from the v1.1 backlog or move into Phase 2 work** — the remaining Phase 1 items are RLS rewrites, super-admin assignment UI, seeding billing.plans, and re-enabling full CI. The next big product lever is the Atlas (risk narrative) and Sage (supplement protocol) pipeline workers — those unlock the `/report` screen, the PDF download, and the dashboard bio-age comparison.

## Risks or open items

- The `signUp()` email-verification callback still always sends new members to `/dashboard` after verifying their email — they don't return to the page they originally tried to open. A separate small follow-up can close that, but it requires carrying the destination across the verification email round-trip.
- This change ships behind no feature flag — it changes auth-flow behaviour for every member. Risk is low (extensive unit tests, code review approved, additive scope), but worth a short watch on Sentry for the first hour after deploy.
