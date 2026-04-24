# Longevity Coach - Sprint handoff as of 2026-04-24

**Handoff:** Dave → Trac (AI engineer)
**Sprint contract:** [Longevity Coach - Vietnam Sprint Plan.md](./Longevity%20Coach%20-%20Vietnam%20Sprint%20Plan.md) (the 7 MVP workflows)
**Product owner (returns Sunday 2026-04-26):** James Murray
**Base44 reference repo (read-only):** `~/code-projects/longevity-coach-base44-reference/`, mirror of https://github.com/DrJLM/longevity-coach

---

## ✅ Done (P0 - Day 0)

- ✅ Next.js 16 App Router + pnpm + TypeScript scaffold ([AGENTS.md](../AGENTS.md) flags that Next 16 has breaking changes - always consult `node_modules/next/dist/docs/` before writing new code)
- ✅ Tailwind v4 (via `@tailwindcss/postcss`) - used sparingly; most styling lives in scoped CSS files
- ✅ Landing page from design bundle ([app/(public)/page.tsx](../app/(public)/page.tsx), [home.css](../app/(public)/home.css))
- ✅ Supabase wiring - client, server, proxy, admin, generated types ([lib/supabase/](../lib/supabase/))
- ✅ Initial schema + RLS for `profiles`, `health_profiles`, `risk_scores`, `subscriptions` ([0001_init.sql](../supabase/migrations/0001_init.sql))
- ✅ `on_auth_user_created` trigger auto-creates a profile row per new user
- ✅ Vercel project live + deploy-on-push from `main`; pnpm version pinned
- ✅ Brand assets committed; final logo confirmed

---

## ✅ Done today (2026-04-24)

All commits on `main`: `930bd41` → `859ce7c`.

### Auth
- ✅ `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password` pages (under `app/(auth)/`)
- ✅ Server actions for sign-in, sign-up, sign-out, password reset, password update ([app/(auth)/actions.ts](../app/(auth)/actions.ts))
- ✅ `/auth/callback` handles **both** Supabase flows:
  - `token_hash + type` (verifyOtp - email confirmation, password reset)
  - `code` (exchangeCodeForSession - PKCE / OAuth)
- ✅ Route protection in [proxy.ts](../lib/supabase/proxy.ts) - redirects unauthenticated users from `/dashboard`, `/onboarding`, `/admin`; bounces signed-in users away from auth pages
- ✅ Signed-in `(app)` layout with logo + sign-out ([app/(app)/layout.tsx](../app/(app)/layout.tsx))

### Stripe
- ✅ Stripe SDK + thin wrapper ([lib/stripe/client.ts](../lib/stripe/client.ts))
- ✅ Service-role Supabase admin client for webhook writes ([lib/supabase/admin.ts](../lib/supabase/admin.ts))
- ✅ `POST /api/stripe/checkout` - creates a subscription Checkout session for the authed user
- ✅ `POST /api/stripe/webhook` - verifies signature, upserts `subscriptions` on `checkout.session.completed` + `customer.subscription.created/updated/deleted`
- ⚠️ **No UI yet links to checkout** - route exists but isn't wired into the Get-my-bio-age flow. That decision is pricing-tier-dependent and waits on James.

### Onboarding questionnaire
- ✅ Schema-driven framework ([lib/questionnaire/schema.ts](../lib/questionnaire/schema.ts), [questions.ts](../lib/questionnaire/questions.ts))
- ✅ 6 steps ported from Base44 `src/pages/Onboarding.jsx`: **basics, medical, family, lifestyle, goals, consent**
- ✅ Multi-step UI with progress bar, validation, save-and-resume to `health_profiles.responses` JSONB ([app/(app)/onboarding/](../app/(app)/onboarding/))
- ✅ Server actions: `saveDraft` (auto-save on Continue) + `submitAssessment` (marks `completed_at`)

### Resend welcome email
- ✅ Resend SDK + client wrapper ([lib/email/client.ts](../lib/email/client.ts))
- ✅ Branded HTML + plain-text welcome template ([lib/email/welcome.ts](../lib/email/welcome.ts))
- ✅ Fires from `/auth/callback` when the user lands within 60s of `email_confirmed_at`
- ⚠️ **Idempotency is a 60s time window, not persisted.** Double-clicks within the window send two emails. Clean fix is a `welcome_email_sent_at` column on `profiles`.

### Dashboard
- ✅ Real signed-in landing page ([app/(app)/dashboard/page.tsx](../app/(app)/dashboard/page.tsx)) reading `health_profiles`, `risk_scores`, `subscriptions`
- ✅ Assessment status card (none / draft / complete) with the right CTA
- ✅ Subscription card with status badge
- ✅ Placeholder risk-domain grid that fills in when the engine runs

### Marketing pages
- ✅ Horizontal Longevity Coach logo (transparent, tight-cropped, 600×125, ~54KB) in all four placements (public nav, public footer, auth, app header)
- ✅ Logo in public nav links to `/`
- ✅ Public nav: **Science · Team · Stories** + Sign in / Get my bio-age CTAs
- ✅ `/science` combines Science + How it works + What you get sections
- ✅ `/team` - founders block
- ✅ `/stories` - member stories / testimonials
- ✅ `/sample-report` - worked example report (fictional persona "Nina Okafor") showing bio-age, 5-domain risk grid, 4 top modifiable drivers, 4-supplement protocol, methodology note. Wired from all "See a sample report" CTAs.
- ✅ Landing page still contains every section so the long-form narrative works for direct visitors; sub-pages share the same components under [app/(public)/_components/](../app/(public)/_components/)
- ✅ "How it works" step cards use flex-column + `margin-top: auto` so mini-cards sit on a consistent baseline regardless of copy length
- ✅ Em dashes removed from all authored files (kept en dashes in numeric ranges like "1–7 units/week")
- ✅ Tweaks prototype panel removed

### Current route map (16 routes)

```
/                     landing (public)
/science              Science + How + What (public)
/team                 Founders (public)
/stories              Member stories (public)
/sample-report        Worked example report (public)
/login                Auth (redirects to /dashboard if already signed in)
/signup               Auth
/verify-email         Post-signup message
/forgot-password      Password reset request
/reset-password       Set new password after reset link
/auth/callback        Supabase verifyOtp + PKCE code exchange + welcome email
/dashboard            Signed-in home (reads health_profiles + risk_scores + subscriptions)
/onboarding           6-step health questionnaire with save-and-resume
/api/stripe/checkout  Creates subscription Checkout session (POST)
/api/stripe/webhook   Stripe webhook - upserts subscriptions table (POST)
```

`pnpm build` is clean. TypeScript passes. Build green on Vercel.

---

## 🚫 Blocked on James (Sunday 2026-04-26)

| Item | Why blocked |
|---|---|
| **Risk engine port** | 1231 lines in `base44/functions/riskEngine/entry.ts`. Most branches need biomarker inputs (apoB, LDL, hsCRP, CT calcium) that come from file uploads we haven't built. James to confirm which inputs are MVP-required vs. deferred. |
| **Supplement protocol** | Depends on risk engine outputs. Logic in `base44/functions/generate30DaySupplementList/`. |
| **Branded PDF** | Needs final brand confirmation (colors/fonts beyond the logo) + supplement output to render. |
| **File uploads** | Blood, imaging, genetic, microbiome, hormonal, other. Needs Supabase Storage bucket + RLS decision + James sign-off on which are MVP. |
| **Family-history detail** | Currently simple yes/no per category. Base44 had age-of-onset and cancer-type sub-fields - defer until James confirms whether MVP needs them. |
| **Final pricing tiers** | Stripe price IDs are env-var stubs; need real values from James before going live. |
| **Landing + sub-page copy review** | Current copy is from design bundle or plausible filler (notably the `/sample-report` data, `/team` blurb, methodology text). James should sanity-check before public promotion. |
| **Admin CRM** | No data flowing yet. Low value until questionnaire and risk scores populate. |

---

## 🎯 Recommended next steps for Trac

**Ordered by impact, James-independent unless noted.**

### 1. Replace dashboard stub CTA with real next-action (~30 min)
Right now the signed-in user lands at `/dashboard`, which tells them to "Start your assessment". When an assessment is complete but no risk scores exist yet, the dashboard says "Risk scores appear here once the engine has processed your assessment" - but we have no engine invocation. Decide: run the (lifestyle-only) engine on submit, or keep the waiting state until Sunday.

### 2. Logged-in nav shape (trivial)
The `(app)/layout.tsx` header currently has just a logo and sign-out. Recommended three-link shape discussed with Dave:

```
[ logo →/ ]   Dashboard · Report · Account     [ Sign out ]
```

- **Report** → `/report` (stub today; becomes the durable read-only view of bio-age + domain scores + supplements after the engine runs)
- **Account** → `/account` (stub today; profile, billing portal, data export, delete-my-data)

Explicitly **not** in the nav: Onboarding (it's the dashboard CTA), Supplements/Coaching/Library (fold into Report or defer to Tier 2), search, notifications.

### 3. Welcome-email idempotency (~30 min)
Add `welcome_email_sent_at timestamptz` to `profiles` via a new migration, regenerate types, update `/auth/callback` to check+set this column. Closes the "double-click verification link = two emails" gap.

### 4. Risk engine port (~4-6 hr, needs James Sunday)
`base44/functions/riskEngine/entry.ts` → `lib/risk/engine.ts` with:
- Adapter from our `health_profiles.responses` shape to Base44's expected `patient` object
- Parity fixture tests using Base44 expected outputs
- Server action that runs on `submitAssessment` and writes `risk_scores`

Most branches fire only with biomarker inputs we don't collect yet. Expect the engine to return mostly "insufficient data, defaulting to 50" until file uploads exist. That's OK - ship the plumbing and James fills in data sources Sunday.

### 5. Supplement protocol + branded PDF (Sunday+)
- Port `base44/functions/generate30DaySupplementList/entry.ts`
- PDF generation via `@react-pdf/renderer` or Puppeteer (Base44 used the latter). Template keyed off the risk scores + supplement list; brand per James's spec.

### 6. Footer legal pages (wait on James)
`Privacy`, `Terms`, `Clinical governance`, `Contact` all point to `#`. These need real copy from legal, not a placeholder - keep as `#` until content arrives, don't stub.

---

## 🔧 Environment variables (Vercel + local `.env.local`)

Required for a fully working preview:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=                  # server only - webhook writes
NEXT_PUBLIC_SITE_URL=                 # http://localhost:3000 locally; https://longevity-coach.io in prod

ANTHROPIC_API_KEY=                    # future: risk narratives + supplement gen
RESEND_API_KEY=                       # welcome email (route no-ops if missing)
RESEND_FROM_EMAIL=

STRIPE_SECRET_KEY=                    # test keys locally; live in prod
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_MONTHLY=                 # price IDs from Stripe dashboard
STRIPE_PRICE_ANNUAL=
```

See [.env.example](../.env.example) for annotations.

---

## 📍 Base44 reference map

| What to port | Where it lives |
|---|---|
| Questionnaire fields | `src/pages/Onboarding.jsx` (✅ pulled into `lib/questionnaire/questions.ts`) |
| Risk engine (5 domains + bio-age) | `base44/functions/riskEngine/entry.ts` |
| Risk narrative | `base44/functions/analyzePersonalizedRisks/` |
| Supplement mapping | `base44/functions/generate30DaySupplementList/` |
| PDF export pattern | `base44/functions/exportSupplementProtocol/` |
| Stripe checkout + webhook | `base44/functions/createCheckoutSession/` + `stripeWebhook/` (✅ ported) |
| Welcome email + drip | `base44/functions/sendOnboardingEmail/` + `triggerEmailSequence/` (welcome ✅; drip not yet) |
| LLM agent prompts | `base44/agents/*.jsonc` (risk_analyzer, supplement_advisor, onboarding_coach, janet, chef, health_researcher) |
| UX reference | `src/pages/Onboarding.jsx`, `Dashboard.jsx`, `Supplements.jsx`, `BiologicalAge.jsx` |

---

## ⚠️ Gotchas

- **Next 16 uses `proxy.ts`, not `middleware.ts`.** Same concept, renamed.
- **`useActionState` from `react`**, not `useFormState` from `react-dom`. React 19 rename.
- **Supabase email links use `token_hash + type`**, not `code`. Our `/auth/callback` handles both; don't regress.
- **Welcome email silently no-ops without `RESEND_API_KEY`.** This is intentional so preview deploys keep working; do not change to a hard error.
- **Stripe webhook reads raw body for signature verification.** Do not add body parsing middleware in front of that route.
- **Supabase uses new key naming** (`sb_publishable_*`, `sb_secret_*`) - legacy `anon` / `service_role` JWTs are being deprecated. Env var is `SUPABASE_SECRET_KEY`, not `SUPABASE_SERVICE_ROLE_KEY`.
- **Route groups `(auth)`, `(app)`, `(public)`, `(admin)` do not add URL segments.** Pages inside `(app)/dashboard/` are served at `/dashboard`.
- **`app/(public)/_components/`** - underscore prefix keeps Next from treating it as a route. Shared marketing sections live here.

---

## Definition of done (unchanged)

1. Stranger visits site → understands offer → pays via Stripe
2. Completes health questionnaire → gets bio-age + risk scores
3. Receives personalised supplement protocol + branded PDF
4. Has a dashboard showing scores, supplements, next actions
5. James can log in to admin CRM and see users + subscription status + analytics
6. Welcome email fires automatically on sign-up ✅
7. Live on production with SSL, monitoring, backups
