# QA Bug Log — Longevity Coach

The canonical bug list for the project. One row per bug. Append-only — closed bugs stay in the table for posterity, marked CLOSED.

Severity:
- **P0** — production broken or PII at risk; everything stops.
- **P1** — critical path broken or wrong; ship-blocker.
- **P2** — feature works but visibly degraded; ship if forced, fix this sprint.
- **P3** — polish, paper cut, copy nit; backlog.

Status: `OPEN`, `IN-PROGRESS`, `CLOSED`, `WONTFIX`.

Bug IDs are sequential across the whole project — never re-use.

---

## Open

| ID | Severity | Epic | Title | Surface | First seen | Status | Notes |
|---|---|---|---|---|---|---|---|
| BUG-012 | P1 | 1 | UK clinical credentials shown on AHPRA-regulated AU product | / | 2026-05-01 | OPEN | Hero + science pages cite GMC, Royal College of GPs, Imperial Longevity Lab, UK Biobank. AU regulator is AHPRA. Trust + regulatory mismatch on the front door. See [§BUG-012](#bug-012). |
| BUG-013 | P1 | 12 | `/pricing` page nav layout completely broken | /pricing | 2026-05-01 | OPEN | `PublicNav` uses `.nav` classes scoped to `.lc-home` in home.css; pricing wraps in `.lc-pricing` so styles don't apply. Logo renders at full 880×203, nav links collapse to plain text. See [§BUG-013](#bug-013). |
| BUG-015 | P1 | 1 | Footer copyright says "LONGEVITY COACH LTD" — pre-rebrand stale | site-wide | 2026-05-01 | OPEN | [app/(public)/_components/footer.tsx:24](app/(public)/_components/footer.tsx:24). Legal entity per `/legal/collection-notice` is "Work Healthy Australia Pty Ltd". Footer should match, not cite a UK Ltd. |
| BUG-016 | P2 | 1 | Footer has dead `href="#"` links (Privacy, Terms, Clinical governance, Contact) | site-wide | 2026-05-01 | OPEN | [app/(public)/_components/footer.tsx](app/(public)/_components/footer.tsx). Only Stories and Data handling work. Privacy & Terms are mandatory under Privacy Act 1988 — these can't ship as `#`. |
| BUG-017 | P2 | 1 | All auth pages (and many app pages) render duplicated brand in `<title>` | /login, /signup, etc. | 2026-05-01 | OPEN | Root layout sets `template: "%s · Janet Cares"`, but pages explicitly include "Janet Cares" in their title metadata, producing "Sign in · Janet Cares · Janet Cares". Affects /login, /signup, /forgot-password, /verify-email, /reset-password, plus /journal, /labs, /labs/[biomarker], /insights, and all `(public)` page metadata that uses "Title — Janet Cares" form. See [§BUG-017](#bug-017). |
| BUG-019 | P1 | 11 | Stripe checkout falls back to `http://localhost:3000` when env var missing | /api/stripe/checkout | 2026-05-01 | OPEN | [app/api/stripe/checkout/route.ts:35](app/api/stripe/checkout/route.ts:35). If `NEXT_PUBLIC_SITE_URL` is unset in any environment, Stripe success/cancel redirects go to localhost. Should hard-fail in production rather than silently route to localhost. |
| BUG-020 | P2 | 1 | User-data export ZIP is named `longevity-coach-export-YYYY-MM-DD.zip` | /api/export | 2026-05-01 | OPEN | [app/api/export/route.tsx:310](app/api/export/route.tsx:310). Stale pre-rebrand filename. Should be `janet-cares-export-…` to match brand and avoid user confusion ("did this come from the right service?"). |
| BUG-021 | P2 | 1 | `/team` and `/stories` pages have no `<h1>` (a11y) | /team, /stories | 2026-05-01 | OPEN | Snapshot showed only `<h2>` on both pages. Screen readers and SEO crawlers expect a single h1 for the main heading. |
| BUG-022 | P3 | 1 | `/team` portrait card is just a placeholder striped panel | /team | 2026-05-01 | OPEN | Renders a diagonal-stripe pattern with caption "PORTRAIT · DR. A. MENDES" but no actual photo. Either ship the photo or mark this section as illustrative. |
| BUG-023 | P3 | 1 | `/sample-report` sample patient is "NINA OKAFOR · ARCHITECT, LONDON, 38" | /sample-report | 2026-05-01 | OPEN | London persona on AU-targeted product. Use a realistic Sydney/Melbourne/Brisbane persona for the sample. |
| BUG-025 | P2 | 6 | `janet-chat` realtime client logs full payload to console | /report (chat) | 2026-05-01 | OPEN | [app/(app)/report/_components/janet-chat.tsx:135](app/(app)/report/_components/janet-chat.tsx:135). Realtime subscription handler does `console.log('[janet-chat realtime] payload', payload);` — payload includes message rows from `agent_conversations`. PII / conversation-content leak to browser DevTools and any extension that reads console output. Strip in production builds or remove. |

## Closed

| ID | Severity | Epic | Title | Closed | Notes |
|---|---|---|---|---|---|
| BUG-001 | P2 | 1 | Signup form clears all fields after server-side validation error | 2026-04-27 | Server actions now echo `{ email, full_name }` via `state.values`; form passes to `defaultValue`. |
| BUG-002 | P2 | 1 | Welcome email idempotency was a 60s window, not a DB flag | 2026-04-28 | Now keyed on `profiles.welcome_email_sent_at`. |
| BUG-003 | P1 | 3 | risk_analyzer wrote `confidence_level = 'moderate'` for every patient | 2026-04-28 | Deterministic engine ported; scores evidence-grounded. |
| BUG-005 | P1 | 5 | Branded PDF route returned an unstyled skeleton | 2026-04-29 | Now logo, cover page, big-number summary, swatches, supplement table, footer. |
| BUG-006 | P3 | 1 | No Account link in logged-in nav | 2026-04-28 | Page now exists and is linked. |
| BUG-009 | P0 | 3 | risk_analyzer pipeline silently failing for ~48h (`narrative=null`) | 2026-04-30 | AI SDK structured-output rejected `min`/`max` on number types; fixed in PR #78. |
| BUG-010 | P1 | 3 | Onboarding silently fails to write `risk_scores` row (onConflict mismatch) | 2026-05-02 | Fixed in PR [#88](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/88). |
| BUG-011 | P2 | 1 | `/account` Identity + Security forms hide uncaught throws behind global-error.tsx | 2026-05-02 | Fix split out of PR [#93](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/93) and shipped as PR [#112](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/112). |
| BUG-018 | P1 | 1 | `signIn()` discards `?redirect=` query param after successful login | 2026-05-04 | Fixed in PR [#131](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/131). Hidden form field carries `?redirect=` to `signIn()`, which honours it via `safeRedirect()` (open-redirect blocked). |
| BUG-024 | P2 | 1 | Inconsistent post-login redirect preservation across guarded routes | 2026-05-04 | Fixed in PR [#131](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/131). 5 missing prefixes added to `PROTECTED_PREFIXES`; `(app)/layout.tsx` now also preserves path via `x-pathname` header as defence-in-depth. |
| BUG-014 | P1 | 12, 13 | `/pricing` shows "$0.00/mo" with no plan cards | 2026-05-04 | Fixed in PR [#135](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/135). Migration 0070 added 3 annual rows; tier model unified codebase-wide on core/clinical/elite. Stripe price IDs are placeholders — admin must populate real IDs via /admin/plans before checkout works end-to-end. |

---

## Repro and triage notes

### BUG-012 — UK clinical credentials on AHPRA-regulated AU product

**Severity:** P1 (regulatory + trust). **Status:** OPEN. **Epic:** 1.

**Repro:**
1. Open `/` cold.
2. Read trust line under hero: "GMC-registered clinicians" — GMC = UK General Medical Council.
3. Scroll to the "BUILT WITH AND REVIEWED BY" trust strip: "ROYAL COLLEGE OF GPS · IMPERIAL LONGEVITY LAB · UK BIOBANK DATA · GMC-REGISTERED CLINICIANS · ISO 27001".

**Surfaces affected:**
- [app/(public)/page.tsx:64](app/(public)/page.tsx:64) — hero trust line
- [app/(public)/page.tsx:256-259](app/(public)/page.tsx:256) — trust strip
- [app/opengraph-image.tsx:109](app/opengraph-image.tsx:109) — OG image (every share preview shows "GMC-registered clinicians")

**Why this is P1:**
- Janet Cares is operated by Work Healthy Australia Pty Ltd (per `/legal/collection-notice`) under AHPRA + Privacy Act 1988.
- Marketing AU members under UK regulator credentials is at minimum misleading copy and at worst a regulatory misrepresentation.
- The OG image is shared every time someone posts a janet.care link to social — every preview broadcasts the wrong regulator.

**Fix sketch:** Replace with AU-equivalents: "AHPRA-registered clinicians", "Royal Australian College of General Practitioners (RACGP)", an AU dataset (e.g. 45 and Up Study or AusDiab), and update the OG image template to match.

---

### BUG-013 — `/pricing` nav layout broken

**Severity:** P1. **Status:** OPEN. **Epic:** 12.

**Repro:**
1. Open `/pricing`.
2. Observe: huge unstyled Janet Cares logo at top, nav links rendered as plain text "ScienceTeamSign inBegin", no horizontal layout, no spacing, no background bar.

**Root cause:**
- [app/(public)/_components/nav.tsx](app/(public)/_components/nav.tsx) renders `<nav class="nav">` with `.nav-inner`, `.nav-links`, `.nav-cta`, `.btn-primary`, etc.
- These class names are styled in `home.css` under selectors like `.lc-home .nav { … }`.
- `/pricing` wraps its tree in `<div class="lc-pricing">` — so none of the `.lc-home` selectors apply.

**Fix sketch:** Promote nav and footer styles out of `.lc-home` scope into a shared selector (e.g. `.lc-shell` or unscoped at the `.nav` level), or wrap shared chrome in a `.lc-shell` ancestor used by both home and pricing.

---

### BUG-014 — `/pricing` shows "$0.00/mo" with no plan cards

**Severity:** P1. **Status:** OPEN. **Epics:** 12, 13.

**Repro:**
1. Open `/pricing`.
2. Observe: "Choose your plan" header with Monthly/Annual toggle. No tier cards. Footer of the page reads "Estimated total: **$0.00**/mo" with the "Continue to checkout" button enabled.

**Root cause:**
- [app/(public)/pricing/page.tsx:35-52](app/(public)/pricing/page.tsx) reads `billing.plans` and `billing.plan_addons`. Both come back empty in this env, so `PricingClient` has zero cards to render but still renders the "Estimated total" row.

**Why P1:** Pricing is the conversion funnel. A $0 estimate with an enabled checkout button is broken on its face. Even if the env happens to seed plans before launch, the no-plans fallback should not render the totals strip with $0.

**Fix sketch:**
1. Seed `billing.plans` and `billing.plan_addons` in this env (or check why this env has empty billing).
2. Defensive: if `plans.length === 0`, render an empty-state ("Pricing details coming soon") and hide the totals row + checkout button. Treating the empty-billing case as a hard error is also reasonable in production.

---

### BUG-017 — Duplicated "Janet Cares" in `<title>` across most routes

**Severity:** P2 (cosmetic but visible everywhere). **Status:** OPEN. **Epic:** 1.

**Repro:**
1. Open `/login`.
2. Observe browser tab title: "Sign in · Janet Cares · Janet Cares".

**Root cause:**
- [app/layout.tsx:31-34](app/layout.tsx:31) sets `title: { default, template: "%s · ${SITE.name}" }`.
- Many pages set `metadata.title` to a string already containing the brand. Examples found via grep:
  - `app/(auth)/login/page.tsx:4` — `"Sign in · Janet Cares"`
  - `app/(auth)/signup/page.tsx:3` — `"Create account · Janet Cares"`
  - `app/(auth)/verify-email/page.tsx:1`
  - `app/(auth)/reset-password/page.tsx:3`
  - `app/(auth)/forgot-password/page.tsx:3`
  - `app/(public)/sample-report/page.tsx:14,20` — `"Sample report — Janet Cares"`
  - `app/(public)/page.tsx:22,28`
  - `app/(public)/science/page.tsx:15,21`
  - `app/(public)/team/page.tsx:15,21`
  - `app/(public)/stories/page.tsx:15,21`
  - `app/(public)/legal/collection-notice/page.tsx:14,20`
  - `app/(public)/legal/data-handling/page.tsx:15,21`
  - `app/(public)/pricing/page.tsx:18,24`
  - `app/(app)/journal/page.tsx:6` — `'Journal · Janet Cares'`
  - `app/(app)/labs/page.tsx:14`
  - `app/(app)/labs/[biomarker]/page.tsx:9`
  - `app/(app)/insights/page.tsx:7`

**Fix:** strip the `· Janet Cares` / `— Janet Cares` suffix from each page's `metadata.title` and `openGraph.title` / `twitter.title` (they need separate handling since the template only applies to `<title>`). Lean on the root template.

---

### Verified clean

The following surfaces were checked and had no findings during this pass:
- `/` boot, console, and network: no errors.
- `/science`: clean, h1 + h2 structure correct, no failed network.
- `/legal/collection-notice` and `/legal/data-handling`: AU-compliant, no dead links, no PII.
- `/login`, `/signup`, `/forgot-password`, `/verify-email` form rendering and structure: clean (apart from BUG-017).
- Route guard 307s correctly for `/onboarding`, `/report`, `/account`, `/uploads`, `/labs`, `/check-in`, `/simulator`, `/trends`, `/admin`, `/clinician`.
- `/admin` enforces `is_admin` in [app/(admin)/layout.tsx:25](app/(admin)/layout.tsx:25) — defense-in-depth above the proxy.

---

## What was NOT exercised this pass

The signed-in app surface beyond route-guard verification was reviewed by code only, not by browser walk-through, because no test account was available in this environment. Open follow-ups:
- `/dashboard`, `/onboarding` (questionnaire all 6 steps), `/report`, `/account`, `/uploads`, `/labs`, `/check-in`, `/simulator`, `/insights`, `/journal`, `/care-team`, `/alerts`, `/routines`, `/trends`.
- Janet chat first-token latency, streaming, sub-agent tool calls.
- Stripe checkout end-to-end with a real test card.
- File upload with a fixture pathology PDF and Janet analyser pipeline.
- PDF report download flow.

A seeded test-user fixture is the single highest-value next investment to close this gap (per `qa-plan.md` §1 Tier 3).

