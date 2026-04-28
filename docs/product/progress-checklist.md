# Longevity Coach — Progress Checklist

**Last updated:** 2026-04-28 (upload portal delivered)  
**Legend:** ✅ Done · 🔄 Partial · ❌ Not built

---

## Phase 1 — Foundation `90% complete`

### Epic 1.1 — Public Marketing Presence
- [x] ✅ 1.1.1 — Science page
- [x] ✅ 1.1.2 — Team page
- [x] ✅ 1.1.3 — Member stories page
- [x] ✅ 1.1.4 — Sample report page
- [x] ✅ 1.1.5 — Nav across public sections

### Epic 1.2 — Account Creation & Verification
- [x] ✅ 1.2.1 — Email + password signup
- [x] ✅ 1.2.2 — Email verification (OTP + PKCE)
- [x] ✅ 1.2.3 — Sign in → dashboard redirect
- [x] ✅ 1.2.4 — Password reset by email
- [x] ✅ 1.2.5 — Welcome email on account activation

### Epic 1.3 — Health Questionnaire
- [x] ✅ 1.3.1 — 6-step questionnaire (basics, medical history, family, lifestyle, goals, consent)
- [x] ✅ 1.3.2 — Save-and-resume progress
- [x] ✅ 1.3.3 — Plain-English section descriptions
- [x] ✅ 1.3.4 — Post-submit redirect to dashboard with next-step prompt

### Epic 1.4 — Subscription & Payment
- [x] ✅ 1.4.1 — Monthly and annual plan selection
- [x] ✅ 1.4.2 — Stripe checkout (no redirect off-product)
- [x] ✅ 1.4.3 — Subscription status reflected immediately after payment
- [x] ✅ 1.4.4 — Stripe webhook handles lifecycle (success, failure, cancel)

### Epic 1.5 — Personal Dashboard (Foundation)
- [x] ✅ 1.5.1 — Assessment status shown (not started / in progress / complete)
- [x] ✅ 1.5.2 — Subscription status at a glance
- [x] ✅ 1.5.3 — Risk score placeholder when assessment complete
- [x] ✅ 1.5.4 — CTA reflects next logical step

### Phase 1 Gaps (still open)
- [ ] ❌ `/report` page — members have no in-app place to see results
- [ ] ❌ `/account` page — no self-service profile or subscription management
- [ ] ❌ App nav links — only logo + sign-out; Dashboard / Report / Uploads links missing
- [ ] ❌ Admin CRM — James cannot see members or analytics
- [ ] ❌ Drip email sequence — Day 1 / 3 / 7 re-engagement emails not wired

---

## Phase 2 — Intelligence `~10% complete`

### Epic 2.1 — Biological Age Assessment
- [ ] ❌ 2.1.1 — Auto-generate bio-age from questionnaire on submit
- [ ] ❌ 2.1.2 — Bio-age vs chronological age visual comparison
- [ ] ❌ 2.1.3 — Top contributing factors shown to member
- [ ] ❌ 2.1.4 — Projected score change from recommended actions

### Epic 2.2 — Five-Domain Risk Breakdown
- [ ] ❌ 2.2.1 — Risk scores across 5 domains (CV, Metabolic, Neuro, Onco, MSK)
- [ ] ❌ 2.2.2 — Plain-language domain explanations
- [ ] ❌ 2.2.3 — Highest-opportunity domain highlighted
- [ ] ❌ 2.2.4 — Scores auto-updated when new data arrives

### Epic 2.3 — Personalised Supplement Protocol
- [ ] ❌ 2.3.1 — 30-day supplement protocol generated from risk profile
- [ ] ❌ 2.3.2 — Per-supplement plain-language rationale
- [ ] ❌ 2.3.3 — Protocol updated when risk scores change
- [ ] ❌ 2.3.4 — AI Supplement Advisor (Janet) can answer protocol questions

### Epic 2.4 — Branded Health Report (PDF)
- [ ] ❌ 2.4.1 — Downloadable PDF with bio-age, domains, drivers, supplement protocol
- [ ] ❌ 2.4.2 — Personalised with member name, date, results
- [ ] ❌ 2.4.3 — Written in plain English
- [ ] ❌ 2.4.4 — Regeneratable on demand

### Epic 2.5 — Personal Report Screen
- [ ] ❌ 2.5.1 — In-app report view (bio-age, domains, supplement protocol)
- [ ] ❌ 2.5.2 — Last-updated date shown
- [ ] ❌ 2.5.3 — Links from report into coaching/action areas

### What's been built toward Phase 2
- [x] ✅ Database schema for risk scores, supplement plans, patient uploads — all migrated
- [x] ✅ `/uploads` portal — members can upload previous pathology and imaging; Janet reads each file and auto-detects category
- [x] ✅ Multi-file parallel upload — drag or select multiple files; each runs its own independent async pipeline
- [x] ✅ Janet document analyser (`lib/uploads/janet.ts`) — Claude Opus 4.7, adaptive thinking, prompt caching, PDF + image support
- [x] ✅ Dashboard uploads card — file count, adaptive CTA, assessment gate wired
- [x] ✅ `supplement_plans` table exists and has the right shape
- [x] 🔄 `lib/pdf/report-doc.tsx` — skeleton exists, not wired to data
- [ ] ❌ Atlas pipeline (risk narrative AI) — schema and types ready; pipeline logic not yet built
- [ ] ❌ Sage pipeline (supplement protocol AI) — schema and types ready; pipeline logic not yet built
- [ ] ❌ Risk engine triggered on questionnaire submit — not wired
- [ ] ❌ Janet chat agent — not built

---

## Phase 3 — Engagement `0% complete`

- [ ] ❌ Daily check-in (mood, sleep, energy, exercise)
- [ ] ❌ Habit streak tracking
- [ ] ❌ AI coaching suite (nutrition, supplements, fitness, general)
- [ ] ❌ Weekly meal planning + shopping lists
- [ ] ❌ Health journal and insights feed

---

## Phase 4 — Clinical Depth `0% complete`

- [ ] ❌ Lab result uploads with auto-parsing
- [ ] ❌ Longitudinal biomarker charts
- [ ] ❌ Wearable connections (Oura, Apple Watch, Garmin)
- [ ] ❌ Risk simulator (project bio-age impact of lifestyle changes)

---

## Phase 5 — Care Network `0% complete`

- [ ] ❌ Clinician portal with patient overview
- [ ] ❌ Care team invitation + permissions
- [ ] ❌ In-platform appointment booking
- [ ] ❌ Community challenges and member feed

---

## Phase 6 — Scale `0% complete`

- [ ] ❌ Corporate account management
- [ ] ❌ Admin CRM (team-level)
- [ ] ❌ Supplement marketplace

---

## What's Next (Priority Order)

1. **Close Phase 1 gaps** — report page, account page, app nav, drip emails, admin CRM
   → See `docs/engineering/sprints/plan-simple-features.md`

2. **Build Phase 2 AI pipelines** — Atlas (risk narrative) + Sage (supplement protocol)
   → See `docs/engineering/sprints/plan-a-agent-layer.md`

3. **Wire Phase 2 to UI** — report screen, PDF download, bio-age on dashboard
   → Follows pipeline completion

4. **Phase 3 daily engagement** — check-in, habits, Janet chat
   → Follows Phase 2 delivery
