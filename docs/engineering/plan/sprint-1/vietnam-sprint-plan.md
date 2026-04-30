# Longevity Coach — Vietnam Sprint Plan
**Sprint:** Late April 2026 · 5 working days  
**Stack:** Next.js · Supabase · Vercel · GitHub · Claude Code  
**Owner:** James Murray (product) · Dave Hajdu / Edge8 (engineering)

---

## Part 1: MVP Definition

Before writing a single line of code, agree on what the MVP actually is. The sprint succeeds if one thing is true:

> **A stranger can visit the site, pay, answer a health questionnaire, and walk away with their biological age, risk scores, and a personalised supplement protocol — all in under 10 minutes.**

Everything else is optimisation. The B2B portal, clinician dashboard, WhatsApp integration, wearables, gamification — none of it matters until this core loop works and is generating revenue.

### The 7 MVP Workflows

These are the only workflows that need to work on Day 5:

1. **Discovery → Sign-up** — User lands on the site, understands the offer, picks a plan, pays with Stripe
2. **Onboarding questionnaire** — User answers health intake questions; data is stored securely
3. **Risk scoring** — System runs multi-domain risk calculations (CV, metabolic, neuro, onco, MSK) and produces a biological age
4. **Supplement protocol** — System generates personalised supplement recommendations and exports a branded PDF
5. **Consumer dashboard** — User sees their bio-age, risk scores, supplement plan, and next actions in one place
6. **Welcome email** — Automated onboarding email fires on sign-up
7. **Admin CRM** — James can log in, see all users, subscription status, and basic analytics

If all 7 work end-to-end on production, Longevity Coach is launchable.

---

## Part 2: Patient Data Architecture (Do This First)

This is the most critical architectural decision of the sprint. Get it wrong and the whole platform is either insecure or unscalable. Get it right upfront and everything else is just features on top.

### The Core Problem

Health data becomes "patient data" only when it can be linked to an identifiable person. The identifying fields are:
- Full name
- Email address
- Phone number
- Date of birth
- Home address
- Government ID (if collected)
- Payment details (handled by Stripe — never touches the database)

Strip those out and what remains is just metadata: *"38-year-old female, moderate cardiovascular risk, low metabolic risk."*

### The Architecture

```
USER LOGS IN
     │
     ▼
2-Factor Authentication (Supabase Auth)
     │
     ▼
Auth token issued → unlocks encrypted identifier record for that user only
     │
     ├──► Identifier store (encrypted at rest, Supabase Vault)
     │    Name, email, phone, DOB → only readable by the authenticated user
     │
     └──► Health data store (de-identified)
          Risk scores, bio-age, questionnaire responses, supplement protocols
          Linked by UUID only — no PII in this table
```

### Implementation Rules

1. **Supabase Vault** for encrypting the identifier fields — never stored in plaintext
2. **Row Level Security (RLS) enforced at the database level** — not in application code. Supabase handles this natively with policies. This solves the Base44 problem entirely.
3. **UUID-based linking** — health data tables reference a `user_uuid` only, never name or email
4. **AI/LLM never sees identifiers** — when Claude Code or the Claude API touches health data, it operates on the de-identified records. The system resolves names for display purposes only, in the frontend, after auth
5. **Audit log** — every access to identifier records is logged (Supabase provides this)
6. **No PII in logs** — ensure Next.js server logs and Vercel logs are scrubbed of identifier fields

### Supabase RLS Policy Pattern (to implement Day 1)

```sql
-- Health data: users can only see their own records
CREATE POLICY "Users see own health data"
  ON health_profiles
  FOR ALL
  USING (auth.uid() = user_uuid);

-- Admin role can see all (for CRM)
CREATE POLICY "Admins see all health data"
  ON health_profiles
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');
```

Claude Code should write and verify these policies before any health data schema is built on top of them.

---

## Part 3: Tech Stack & Repo Setup

### Stack

| Layer | Tool | Why |
|-------|------|-----|
| Frontend | Next.js 14 (App Router) | SSR, fast, works great with Vercel |
| Database | Supabase (PostgreSQL) | RLS built-in, Auth, Vault, Realtime |
| Auth | Supabase Auth | Email/password + social, session mgmt, MFA |
| Payments | Stripe | Subscriptions, webhooks, customer portal |
| Email | Resend | Simple, modern, good deliverability |
| Deployment | Vercel | CI/CD from GitHub, preview deployments |
| AI | Claude API (Sonnet) | Supplement generation, risk narratives |
| PDF | React-PDF or Puppeteer | Branded supplement protocol export |
| Version Control | GitHub | Single repo, Edge8 + James both have access |

### Repo Structure

```
longevity-coach/
├── app/                    # Next.js App Router pages
│   ├── (public)/           # Landing page, pricing
│   ├── (auth)/             # Sign-up, login, 2FA
│   ├── (app)/              # Dashboard, questionnaire, profile
│   └── (admin)/            # CRM, admin panel
├── components/
├── lib/
│   ├── supabase/           # Client, server, middleware
│   ├── stripe/             # Stripe client, webhook handlers
│   ├── ai/                 # Claude API calls (risk engine, supplements)
│   └── pdf/                # PDF generation
├── supabase/
│   ├── migrations/         # All schema changes as SQL files
│   └── seed.sql
└── .env.local              # Never committed
```

### Day 0 Environment Checklist (before sprint starts)

- [ ] GitHub repo created, Edge8 team added
- [ ] Supabase project provisioned (production + staging)
- [ ] Vercel project connected to GitHub repo
- [ ] Custom domain (janet.care) pointed at Vercel, SSL active
- [ ] Stripe account live, test mode configured, product/price IDs created
- [ ] Resend account + sending domain verified
- [ ] `.env` variables shared securely with team (not in repo)
- [ ] Base44 codebase exported and shared with Edge8 for reference
- [ ] Claude API key provisioned for production use
- [ ] WhatsApp Business verification submitted (Tier 2 dependency — start now)

---

## Part 4: Day-by-Day Sprint Plan

### Day 1 — Foundation (Security + Payments + Landing)

**Goal:** The skeleton is live. A user can visit the site and see the pricing page. Auth and billing are wired up correctly. Patient data architecture is locked in and cannot be changed later.

**Morning (with James)**
- Walk through the MVP scope — confirm the 7 workflows above are the only goal
- Review and sign off on the patient data architecture (Part 2)
- Confirm all pre-sprint inputs are ready (pricing, copy, brand assets, questionnaire)

**Claude Code tasks**
- [ ] Scaffold Next.js project with App Router, TypeScript, Tailwind
- [ ] Supabase integration: client, server client, middleware for session
- [ ] **RLS policies written and tested first** — before any other schema
- [ ] Database schema: `users`, `health_profiles`, `subscriptions`, `risk_scores`
- [ ] Supabase Auth: email/password sign-up, email verification, session management
- [ ] Stripe: product + price objects, subscription checkout, webhook endpoint (`/api/stripe/webhook`)
- [ ] Landing page: hero, value prop, pricing tiers, email capture (design from brand assets)
- [ ] Vercel preview deployment live by end of day

**James**
- Review and approve landing page copy on preview URL
- Confirm pricing tier structure is correct in Stripe

---

### Day 2 — Core Engine (Risk Scoring + Onboarding Flow)

**Goal:** The most technically complex part of the product is ported, hardened, and working. A user who signs up can complete onboarding and get a biological age back.

**Claude Code tasks**
- [ ] Port onboarding questionnaire from Base44 — map all questions and field types to new schema
- [ ] Multi-step onboarding UI (progress indicator, validation, save-and-resume)
- [ ] Risk engine port from Base44:
  - CV risk domain
  - Metabolic risk domain
  - Neurological risk domain
  - Oncological risk domain
  - MSK risk domain
- [ ] Biological age calculation (inputs from all 5 domains → single output)
- [ ] Store results in `risk_scores` table (de-identified, UUID-linked)
- [ ] Unit tests for risk calculations — verify outputs match Base44 results
- [ ] Landing page completion + SEO meta tags

**Watch point:** Risk engine logic must be documented by James before this day starts. If the inputs, weights, and thresholds aren't written down, this day stalls.

---

### Day 3 — Feature Build (Supplement Protocol + Dashboard)

**Goal:** The core value delivery is done. A user gets their supplement protocol and can see everything in a dashboard.

**Claude Code tasks**
- [ ] Supplement protocol generator:
  - Map risk profile inputs → supplement recommendations
  - Claude API call for personalised narrative/explanation
  - Port Base44 supplement logic, verify output parity
- [ ] Branded PDF generation:
  - User's bio-age, risk scores, supplement list, dosing instructions
  - Work Healthy / Longevity Coach branding
  - Download button on dashboard
- [ ] Consumer dashboard (single-page app feel):
  - Bio-age display with visual treatment
  - Risk domain scores (radar chart or bar chart)
  - Supplement protocol summary
  - "Next actions" panel
  - Progress tracking placeholder (data hooks ready for Tier 2)
- [ ] End-to-end flow test: sign-up → onboarding → risk score → supplement → PDF → dashboard

---

### Day 4 — Integration + Admin (Email + CRM)

**Goal:** The operational layer is in place. James can run the business. Users get emails. Nothing falls through the cracks.

**Claude Code tasks**
- [ ] Email sequences via Resend:
  - Welcome email (fires on sign-up)
  - Onboarding drip: Day 1, Day 3, Day 7 (trial-to-paid nudge)
  - Stripe webhook triggers: payment confirmed, payment failed, subscription cancelled
- [ ] Admin CRM panel (`/admin`):
  - User list with subscription status, signup date, plan tier
  - Basic analytics: total users, MRR, trial conversion rate
  - User detail view: health profile, risk scores, subscription history
  - Role-gated — Supabase RLS + JWT role check
- [ ] End-to-end testing of full user journey
- [ ] Fix any bugs surfaced by testing

---

### Day 5 — Ship (QA + Production Deployment)

**Goal:** Longevity Coach is live on production. All 7 MVP workflows pass a real-world smoke test.

**Morning**
- [ ] Final bug fixes from Day 4 testing
- [ ] Production environment variable audit (no test keys in prod)
- [ ] Stripe: switch from test mode to live mode
- [ ] Resend: confirm sending domain is verified in production
- [ ] Deploy to production on Vercel

**Smoke test (do this manually, in order)**
- [ ] Visit janet.care as a new user — does the landing page load and look right?
- [ ] Sign up for a free trial — does auth work, does the welcome email arrive?
- [ ] Complete the onboarding questionnaire — do all steps save correctly?
- [ ] View bio-age and risk scores — do they calculate correctly?
- [ ] View supplement protocol — is it accurate and personalised?
- [ ] Download the PDF — does it render correctly with branding?
- [ ] Log in as admin — can you see the new user, their plan, and their data?

**Afternoon**
- [ ] Begin Tier 2 scoping: B2B corporate portal, clinician dashboard, WhatsApp/Janet
- [ ] Document known issues / tech debt for post-sprint
- [ ] Handoff notes for Edge8 remote team

---

## Part 5: Sprint Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Pre-sprint inputs not ready (copy, pricing, risk engine logic) | High | Critical | James must complete checklist before boarding. No inputs = Day 1 stalls. |
| Risk engine port more complex than expected | Medium | High | Port on Day 2, not Day 3. Have Base44 running in parallel for reference. |
| Stripe webhook configuration issues | Medium | Medium | Test in Stripe CLI locally on Day 1 before deploying. |
| Supabase RLS regression | Low | Critical | Test RLS policies with dedicated test suite. Never change policies without running tests. |
| Scope creep | High | High | This document is the contract. If it's not in the 7 workflows, it doesn't ship in the sprint. |
| PDF rendering inconsistency | Low | Low | Use Puppeteer headless for consistent output across environments. |

---

## Part 6: Definition of Done

The sprint is complete when:

1. A new user can visit **janet.care**, understand the offer, and sign up for a paid subscription via Stripe
2. After sign-up, the user completes a health intake questionnaire and receives their **biological age and risk scores**
3. The user receives a **personalised supplement protocol** with a downloadable branded PDF
4. The user has a **dashboard** showing their health data, scores, and recommended actions
5. James can log in to an **admin CRM** and see all users, subscription status, and basic analytics
6. An **automated welcome email** fires on sign-up
7. The system is deployed to **production** with SSL, Vercel monitoring, and Supabase backups active

**Patient data must be secure at every step.** Row Level Security is enforced at the database layer. Identifiers are encrypted via Supabase Vault. The AI layer never touches PII.

---

## Appendix: Pre-Sprint Inputs Required from James

These must be ready before Day 1. If any are missing, the corresponding day's work cannot start.

| Input | Needed By | Used On |
|-------|-----------|---------|
| Pricing tiers (B2C monthly/annual amounts) | Day 0 | Day 1 (Stripe setup) |
| Landing page copy (hero, value prop, CTA) | Day 0 | Day 1 (landing page) |
| Brand assets (logo, colours, fonts) | Day 0 | Day 1 (landing page, Day 3 PDF) |
| Onboarding questionnaire (exact questions + field types) | Day 0 | Day 2 |
| Risk engine logic (inputs, weights, thresholds per domain) | Day 0 | Day 2 |
| Supplement mapping (risk profile → supplement recommendations) | Day 1 | Day 3 |
| Base44 codebase export + API endpoint documentation | Day 0 | Day 2–3 |
