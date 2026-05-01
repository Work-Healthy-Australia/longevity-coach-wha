# Auth email deliverability — SMTP and DNS

## Problem

A new signup at `james@softtissuecentre.com.au` (2026-04-29 10:26 UTC) never received the activation email. Investigation showed `auth.users.confirmation_sent_at` was `null` — Supabase had not dispatched the email at all.

Cause: the project was using Supabase's default email service. Its rate limit (≈2/hour) had been hit, so GoTrue accepted the signup but skipped the email step. Subsequent password-reset attempts also tripped `email rate limit exceeded`.

## Fix

### 1. Custom SMTP via Resend

Configured at `Auth → SMTP Settings` in the Supabase dashboard:

```
Host:     smtp.resend.com
Port:     465
Username: resend
Password: <RESEND_API_KEY>
Sender:   <RESEND_FROM_EMAIL>
```

This routes Supabase auth emails (signup confirmation, password reset, magic link, email change) through the same Resend account already used by `lib/email/` for product emails.

### 2. Auth-level email rate limit

`Auth → Rate Limits → Rate limit for sending emails` raised from 2/hour to 300/hour. Supabase imposes this independently of the SMTP provider; raising it is required even with custom SMTP.

### 3. DNS authentication for `janet.care`

Resend DKIM was already present. SPF and DMARC were missing — Gmail was spam-filtering on that basis.

Records added to the `janet.care` DNS zone:

| Type | Host | Value |
|---|---|---|
| TXT | `@` | `v=spf1 include:_spf.resend.com ~all` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@janet.care` |

Verify in https://resend.com/domains.

## Verification

Direct probe against `https://<project>.supabase.co/auth/v1/recover` returned HTTP 200 and `auth.users.recovery_sent_at` was populated immediately after. Email delivered to `james@softtissuecentre.com.au` (initially in Gmail spam — expected for first send from a new sender domain).

## Notes for future deliverability

- Gmail builds sender reputation over the first 24–48 h. Marking the early emails as "Not spam" accelerates this.
- Supabase rate-limit responses fire *before* the email is dispatched, so `recovery_sent_at` / `confirmation_sent_at` stay `null` when blocked. That field is the cleanest signal that an email actually went out.
- Welcome email (sent by `app/auth/callback/route.ts` via `lib/email/welcome.ts`) goes through Resend's HTTP API directly and does not depend on the Supabase SMTP path.
