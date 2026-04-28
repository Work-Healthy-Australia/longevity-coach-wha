# Security Rules

This is a health platform handling sensitive clinical data. Security is a first-class concern, not an afterthought.

---

## Authentication

- All route protection is handled in `proxy.ts`. Do not add ad-hoc auth checks inside pages or server actions — the proxy handles it.
- `/auth/callback` handles two Supabase auth flows:
  - `token_hash + type` — verifyOtp (email confirmation, password reset)
  - `code` — exchangeCodeForSession (PKCE / OAuth)
  - Never remove support for either path.
- Password is never echoed back to the client in server action responses.
- Password reset links are single-use. Do not cache or reuse them.

---

## PII handling

- Patient PII (name, date of birth, phone, postal address) lives only in `profiles`. See `.claude/rules/data-management.md` Rule 2.
- Email lives in `auth.users` — never copy it to another table.
- Never log PII in server logs, error messages, or debug output.
- Never include PII in URLs, query strings, or client-side state.

---

## Stripe webhook

- The Stripe webhook at `POST /api/stripe/webhook` reads the raw request body for signature verification.
- Never add body-parsing middleware in front of this route.
- The webhook secret (`STRIPE_WEBHOOK_SECRET`) must be the signing secret from the Stripe dashboard webhook configuration, not the API key.
- Never process a webhook event without verifying the signature first.

---

## Service-role client

- The admin Supabase client (`lib/supabase/admin.ts`) uses `SUPABASE_SECRET_KEY` which bypasses RLS.
- It must only be used in:
  - `app/api/stripe/webhook` — subscription upserts
  - Risk engine writes to `risk_scores`
  - Server-side PDF generation
  - Any future clinician-gated data access
- Never import the admin client in a page, layout, or client component.

---

## Consent records

- `consent_records` is append-only. Never update or delete rows.
- A new consent record must be written every time a patient explicitly consents to a policy change.
- The record must capture: user UUID, policy version, consent timestamp, and the channel through which consent was given.
- This is an AHPRA audit trail requirement.

---

## Environment variables

- Never hardcode API keys, Stripe price IDs, or Supabase URLs in source code.
- Never commit `.env` or `.env.local` files to git.
- Never log environment variable values in application code.
- If a required key is absent, the feature it gates must silently no-op — never expose error detail that reveals infrastructure to the browser.

---

## Input validation

- Validate all user input at the server action level using Zod schemas.
- Never trust client-submitted data for anything that affects billing, subscription status, or risk scores.
- File uploads must be validated for MIME type and file size before being passed to Janet for parsing.
