@AGENTS.md
@.claude/rules/data-management.md
@.claude/rules/nextjs-conventions.md
@.claude/rules/database.md
@.claude/rules/security.md
@.claude/rules/ai-agents.md

# Longevity Coach — Project Guide for AI Agents

## What this project is

A personal health optimisation platform that calculates a patient's biological age, produces a five-domain health risk breakdown, and delivers a personalised supplement protocol and daily coaching. Three audiences: individual members, corporate wellness buyers, and clinical practitioners.

Live at: https://longevity-coach.io  
Stack: Next.js 16 App Router · TypeScript · Supabase · Stripe · Resend · Anthropic Claude API

---

## Codebase map

| Path | What lives here |
|---|---|
| `app/(public)/` | Marketing site — no auth required |
| `app/(auth)/` | Login, signup, password reset, email callback |
| `app/(app)/` | Signed-in member area — dashboard, onboarding, report, account, uploads |
| `app/(admin)/` | Admin CRM — currently a stub |
| `app/api/stripe/` | Stripe checkout and webhook API routes |
| `app/auth/callback/` | Supabase OTP and PKCE code exchange + welcome email |
| `lib/questionnaire/` | Schema-driven questionnaire: questions, schema, validation, hydration |
| `lib/profiles/` | PII helpers: name splitting, PII/questionnaire split at write time |
| `lib/supabase/` | Supabase clients: browser, server, admin (service-role), proxy (route guard) |
| `lib/risk/` | Risk engine — stub, Phase 2 work |
| `lib/supplements/` | Supplement protocol generator — stub, Phase 2 work |
| `lib/pdf/` | PDF report generation — stub, Phase 2 work |
| `lib/ai/` | AI agent layer — stub, Phase 3 work |
| `lib/email/` | Resend email client and templates |
| `lib/stripe/` | Stripe SDK wrapper |
| `lib/uploads/` | Janet document parser |
| `lib/consent/` | Consent policy definitions and record helpers |
| `supabase/migrations/` | Sequential numbered SQL migrations |
| `docs/` | All project documentation — see docs/README.md |

---

## Route guard

Route protection lives in `proxy.ts` (the Next.js 16 equivalent of `middleware.ts`). It redirects:
- Unauthenticated users away from `/dashboard`, `/onboarding`, `/admin`, `/report`, `/account`
- Signed-in users away from `/login`, `/signup`

Do not add auth checks inside pages — use the proxy.

---

## Environment variables

All env vars are documented in `.env.example`. Required keys:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY                    # service-role, server only
NEXT_PUBLIC_SITE_URL
ANTHROPIC_API_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_PRICE_MONTHLY
STRIPE_PRICE_ANNUAL
```

If a key is absent, the feature it gates should silently no-op — never hard-error on missing optional keys in preview environments.

---

## Development workflow

1. **Before writing any Next.js code** — read `node_modules/next/dist/docs/` for the feature you are touching. Next.js 16 has breaking changes from what model training data knows.
2. **Before adding a database column** — read `.claude/rules/data-management.md` and decide PII vs questionnaire vs typed column before writing any SQL.
3. **Before adding a new migration** — run `supabase db diff` locally to verify your SQL matches intent, number it sequentially, make it idempotent with `IF NOT EXISTS`.
4. **Before shipping a feature** — run `pnpm build` and `pnpm test` locally. Build must be clean; no TypeScript errors.
5. **New agent or pipeline worker** — read `.claude/rules/ai-agents.md` and `docs/architecture/agent-system.md` before writing any AI code.

---

## Superpowers skill output — migration rule

Never leave superpowers skill output (plans, specs, brainstorms) in a `docs/superpowers/` folder. This project does not use that directory.

After any superpowers skill produces a plan or spec, immediately migrate it to the project convention:

```
docs/engineering/changes/YYYY-MM-DD-slug/PLAN.md
```

Name the slug after the feature, not the skill. Delete the superpowers source file once migrated. The `docs/superpowers/` directory must never exist in this repo.

---

## Product roadmap

See `docs/product/` for the full phased roadmap. Current phase: **Phase 2 — Intelligence** (risk engine, supplement protocol, branded PDF report).

Never build ahead of the current phase without explicit sign-off from the product owner (James Murray).

---

## Key gotchas

- `proxy.ts` is the route guard, not `middleware.ts` — Next.js 16 rename.
- `useActionState` comes from `react`, not `react-dom` — React 19 rename.
- Supabase uses new key naming: `sb_publishable_*` / `sb_secret_*`. Env var is `SUPABASE_SECRET_KEY`, not `SUPABASE_SERVICE_ROLE_KEY`.
- Stripe webhook reads raw body for signature verification. Never add body-parsing middleware in front of that route.
- Welcome email silently no-ops without `RESEND_API_KEY`. This is intentional — do not change it to a hard error.
- Route groups `(auth)`, `(app)`, `(public)`, `(admin)` do not add URL segments.
- `app/(public)/_components/` — underscore keeps Next from treating it as a route segment.
