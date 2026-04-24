# Longevity Coach — Friday 2026-04-24 Sprint Plan

**Context:** James out until Sunday 2026-04-26. Engineering working alone, pulling content + logic from the Base44 reference repo at `~/code-projects/longevity-coach-base44-reference/` (cloned from https://github.com/DrJLM/longevity-coach).

Sprint contract: see [Longevity Coach - Vietnam Sprint Plan.md](./Longevity%20Coach%20-%20Vietnam%20Sprint%20Plan.md) (the 7 MVP workflows).

---

## ✅ Done before today (Day 0 + partial Day 1)

- ✅ Next.js 16 App Router scaffold with route groups `(public)` `(auth)` `(app)` `(admin)`
- ✅ Landing page from design bundle ([app/(public)/page.tsx](../app/(public)/page.tsx))
- ✅ Supabase wired — client, server, proxy, generated types ([lib/supabase/](../lib/supabase/))
- ✅ Initial schema + RLS — `profiles`, `health_profiles`, `risk_scores`, `subscriptions` ([supabase/migrations/0001_init.sql](../supabase/migrations/0001_init.sql))
- ✅ Vercel deploy pipeline live (pnpm pinned, GitHub email verified)
- ✅ Brand assets in repo (final WHA logo confirmed)

---

## ✅ Done today

### Auth
- ✅ `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password` pages
- ✅ Server actions for sign-in, sign-up, sign-out, password reset, password update
- ✅ `/auth/callback` route handles email-confirmation links
- ✅ Route protection in `proxy.ts` — protects `/dashboard`, `/onboarding`, `/admin`; bounces signed-in users away from auth pages
- ✅ Signed-in layout for `(app)` group with sign-out in header
- ✅ Stub `/dashboard` page so signed-in users land somewhere

### Stripe
- ✅ Stripe SDK installed + thin client wrapper ([lib/stripe/client.ts](../lib/stripe/client.ts))
- ✅ Service-role Supabase admin client for webhook writes ([lib/supabase/admin.ts](../lib/supabase/admin.ts))
- ✅ `POST /api/stripe/checkout` — creates a subscription Checkout session for the authed user
- ✅ `POST /api/stripe/webhook` — verifies signature, upserts `subscriptions` on `checkout.session.completed` + `customer.subscription.created/updated/deleted`
- ✅ `.env.example` updated with `STRIPE_*` and `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL`
- ℹ️ `subscriptions` table already existed in `0001_init.sql` (used as-is)

### Onboarding questionnaire
- ✅ Schema-driven framework ([lib/questionnaire/schema.ts](../lib/questionnaire/schema.ts), [lib/questionnaire/questions.ts](../lib/questionnaire/questions.ts))
- ✅ 6 steps ported from Base44 `src/pages/Onboarding.jsx`: **basics, medical, family, lifestyle, goals, consent**
- ✅ Multi-step UI with progress bar, validation, save-and-resume to `health_profiles.responses` JSONB
- ✅ Server actions: `saveDraft` (auto-save on Continue) + `submitAssessment` (marks `completed_at`)
- ✅ Resume on revisit — page loads any in-progress draft

### Build status
- ✅ `pnpm build` clean — 13 routes, TypeScript passes

---

## 🚧 Remaining today (priority order)

1. **Resend welcome email** (~1 hr) — install SDK, generic welcome template, fire on first sign-in or email-confirmation callback. James-independent.
2. **Dashboard wiring** (~1 hr) — replace stub with reads from `health_profiles` (assessment status) and `subscriptions` (plan status). Empty states until the risk engine populates `risk_scores`.
3. **Commit checkpoint** — push everything to a branch + open PR for review.

---

## 🚫 Blocked on James (Sunday 2026-04-26)

| Item | Why blocked |
|---|---|
| **Risk engine port** | 1231 lines in `base44/functions/riskEngine/entry.ts`. Most branches need biomarker inputs (apoB, LDL, hsCRP, CT calcium, etc.) that come from file uploads we haven't built. James to confirm which inputs are MVP-required vs. deferred. |
| **Supplement protocol** | Depends on risk engine outputs. Logic in `base44/functions/generate30DaySupplementList/`. |
| **Branded PDF** | Needs final brand confirmation (colors/fonts beyond the logo) + supplement output to render. |
| **File uploads** | Blood, imaging, genetic, microbiome, hormonal, other. Needs Supabase Storage bucket + RLS decision + James sign-off on which are MVP. |
| **Family-history detail** | Currently simple yes/no per category. Base44 had age-of-onset and cancer-type sub-fields — defer until James confirms whether MVP needs them. |
| **Final pricing tiers** | Stripe price IDs are env-var stubs; need real values from James before going live. |
| **Landing copy revisions** | Current copy is from design bundle — James to review on a preview URL. |
| **Admin CRM** | No data yet — low value until questionnaire and risk scores are flowing. |
| **Horizontal logo** | Dave producing a horizontal lockup of the WHA logo for the header. |

---

## 📍 Reference: Base44 source-of-truth map

| What we'll port | Where it lives in Base44 |
|---|---|
| Questionnaire fields | `src/pages/Onboarding.jsx` (✅ pulled into `lib/questionnaire/questions.ts`) |
| Risk engine (5 domains + bio-age) | `base44/functions/riskEngine/entry.ts` |
| Risk narrative | `base44/functions/analyzePersonalizedRisks/` |
| Supplement mapping | `base44/functions/generate30DaySupplementList/` |
| PDF export pattern | `base44/functions/exportSupplementProtocol/` |
| Stripe checkout + webhook | `base44/functions/createCheckoutSession/` + `stripeWebhook/` (✅ ported) |
| Welcome email + drip | `base44/functions/sendOnboardingEmail/` + `triggerEmailSequence/` |
| LLM agent prompts | `base44/agents/*.jsonc` |
| UX reference | `src/pages/Onboarding.jsx`, `Dashboard.jsx`, `Supplements.jsx`, `BiologicalAge.jsx` |

---

## Definition of done for the sprint (unchanged)

1. Stranger visits site → understands offer → pays via Stripe
2. Completes health questionnaire → gets bio-age + risk scores
3. Receives personalised supplement protocol + branded PDF
4. Has a dashboard showing scores, supplements, next actions
5. James can log in to admin CRM and see users + subscription status + analytics
6. Welcome email fires automatically on sign-up
7. Live on production with SSL, monitoring, backups
