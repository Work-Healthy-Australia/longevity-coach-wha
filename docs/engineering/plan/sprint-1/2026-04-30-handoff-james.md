# Handoff to James — 2026-04-30 (Vietnam Sprint, post-overnight)

**From:** Trac / Cascade · **To:** James Murray  
**Branch state at write time:** `feat/260429-agent-complete` and `main` synced through `dcf9be7` (plan-builder UX + tier styling).  
**Companion docs:** [`vietnam-sprint-plan.md`](./vietnam-sprint-plan.md) · [`docs/product/epic-status.md`](../../../product/epic-status.md)

---

## 1. What landed since your last review (≈24h, 2026-04-29 morning → 2026-04-30 morning)

### Headline shifts in `epic-status.md`
- **Epic 6 (The Coach):** 92% → **100%** — latency benchmarks + clinical prompt review doc + PT Coach `tool_use` shipped.
- **Epic 9 (The Care Team):** 30% → **75%** — full clinician portal end-to-end (foundation → workspace → agent → program email).
- **Epic 11 (The Trust Layer):** 75% → **96%** — right-to-erasure waves 1–3 with E2E smoke test.
- **Epic 12 (Distribution):** ~40% → **60%** — admin tier mgmt, plan-builder, org members, B2B plan APIs.
- **Epic 13 (Business Model):** ~30% → **50%** — public `/pricing`, DB-driven Stripe checkout, `/account/billing`, full admin catalog (plans, add-ons, suppliers, products), pricing-admin foundation migration `0052`.

### Engineering completeness waves (Trac / Claude)
- **Wave 1** — migration collision fix, CI Vitest + pgTAP, repeat-tests cron registered, PDF verified (BUG-005 closed).
- **Wave 2** — PT Coach pipeline + tool, clinician-brief pipeline, latency logs.
- **Wave 3** — personalised daily goals, journal quick-link, rest-day streak dots, `/insights` digest feed.
- **Wave 4** — trust layer: erasure flow, pause/freeze, ToS disclosure, simulator E2E.
- **Chef wave** — meal plan pipeline + `Chef` agent + Janet `request_meal_plan` tool (migrations `0056`–`0061`).
- **Stability fixes** — Zod `min/max` removed from pipeline output schemas; 3-attempt JSON parse retry across all LLM pipelines; hydration warnings on locale dates suppressed; Haiku model ID corrected in compression; `supplement_advisor` `max_tokens` 3000→6000; `supplement_advisor` schema + Janet conversation persistence fixed; `agents.agent_conversations` added to `supabase_realtime` publication (migration `0062`).
- **Plan-builder UX + tier styling polish** (`dcf9be7`) — most recent commit on `main`.

### Your direct contributions (last 24h, by commit)
| Area | Commits |
|---|---|
| **Family history redesign (Wave 1–3)** | `1c0102c`, `ec961ce`, `b15b9c0`, `8cf7f99` — per-relative card model, hydration shim, legacy field collapse, fixes latent `metabolic.ts` `multiple` flag bug. |
| **Risk simulator (Epic 8 B6)** | `d3b9740`, `b6071a4` — real-time CV/metabolic simulator with numeric SBP slider. |
| **Intake / risk labels** | `6d9c54d` SBP intake field; `3663e19`, `6ab5d03`, `e39e94c` BMI labelling + factor-name cleanup; `c4d6ad7` close 5 bio-age input-coverage gaps. |
| **Clinician portal (PRs #34–#37, #41–#45)** | C1–C6 decisions, role expansion + schema + proxy gates, patient consent surface, admin clinician invite + branded Resend email, review workspace + schedule + profile, `janet_clinician` real-time agent + `submit_30_day_program` tool, patient program-delivery email, invite form feedback fix. |
| **Pricing / billing (PRs #24–#27, #29–#32)** | Wave 1 collision + invites; Wave 2 feature-flag resolver + pricing calculators; Wave 3 public `/pricing` + DB-driven checkout; Wave 4 `/account/billing` + add-ons + test orders APIs; Wave 5 admin plans/add-ons/suppliers/products; Wave 7 inline edit forms. |
| **Erasure (PRs #46, #48, #50, #51)** | Wave 1 audit table + `data_no_training` policy; Wave 2 cascade engine + `deleteAccount` rewrite + 19 tests; Wave 3 UX (consent toggle, `/legal/data-handling`, type-DELETE confirm). |
| **Coach polish (#44, plus direct)** | Personalised daily goals + onboarding E2E; insights research-digest feed; Regenerate-report button; latency benchmark suite (`tests/e2e/janet-latency.spec.ts`); clinical prompt review doc (`docs/qa/clinical-prompt-review.md`); rest-day streak / journal link / latency logging plan-B completions. |
| **Design specs authored** | `b3011df` **Janet Secure Messaging Spec** (`docs/features/secure-messaging/janet-secure-messaging-spec.md`). |

---

## 2. Your next two items

### 2.1 Calendar system — clinician ↔ patient booking (Epic 9, Phase 5)

**Status:** *Design approved by Trac 2026-04-29. Zero code yet. This is your next build.*

**Plans (read in order):**
- Summary spec — `@/Applications/E8/client/longevity-coach-wha/docs/engineering/plan/clinician-patient-booking-calendar.md`
- Implementation plan (waves + tasks + acceptance criteria) — `@/Applications/E8/client/longevity-coach-wha/docs/engineering/changes/2026-04-29/clinician-patient-booking-calendar/PLAN.md`

**Three waves, merge independently:**
| Wave | Delivers | Verify |
|---|---|---|
| **W1 — DB foundation** | `clinician_profiles`, `clinician_availability`, `appointments` adds (`video_link`, `patient_notes`, `clinician_notes`, `requested_at`, `accepted_at`, `pending` status), `profiles.role` += `clinician`. New canonical schema files + regenerated `lib/supabase/database.types.ts`. | `pnpm build` clean. |
| **W2 — `/clinician/schedule`** | Weekly availability grid (add/remove slots) + pending requests list (Accept/Decline). Server actions in `app/(clinician)/schedule/actions.ts`. | Logged-in clinician can manage availability and respond to pending requests. |
| **W3 — `/care-team`** | Patient profile card for assigned clinician + 28-day available-slot calendar + booking-request form. Dashboard "Care Team" tile becomes a real link. | End-to-end: patient books → clinician sees pending → accepts → patient sees confirmed. |

**Important pre-flight (already verified for you):**
- Proxy guard for `/clinician/*` is already live in `lib/supabase/proxy.ts` — **do not modify**.
- Migration plan said `0053`, but the migrations directory has now reached `0062`. Use **`0063_clinician_booking_foundation.sql`** as the next slot. Check `supabase/migrations/` before writing.
- No third-party calendar library — pure CSS grid + native `Date` logic. Tokens: `--lc-primary: #2F6F8F`, `--lc-sage: #6B8E83`, `--lc-canvas: #FAFAF7`.

**Open product decisions you need to call (currently unresolved in the plan):**
1. **Auto-confirm vs manual accept** — plan defaults to *always requires clinician acceptance*. Confirm.
2. **Session types** — single type only, or Initial / Follow-up / Urgent picker on the patient side?
3. **Patient-side cancellation** — allowed from UI? Notice required? Currently *deferred*.

### 2.2 Secure messaging — your QA pass once calendar is online

**Status:** *Spec written by you yesterday (`b3011df`). Implementation not yet started.*

**Docs:**
- Spec — `@/Applications/E8/client/longevity-coach-wha/docs/features/secure-messaging/janet-secure-messaging-spec.md`
- Implementation plan — `@/Applications/E8/client/longevity-coach-wha/docs/engineering/changes/2026-04-29/secure-messaging/PLAN.md`

**Why it must follow the calendar:** the secure-message conversation is keyed on `clinical.patient_assignments.id`, and the natural QA flow is *book session → exchange messages about the upcoming session → complete session → message about follow-up*. Without a real `appointments` row in `confirmed` state, the test is artificial.

**Your QA scope when ready:**
- End-to-end: patient sends → Twilio nudge fires (no PHI in body) → clinician deep-links → reads in-app → replies → patient sees realtime update <500ms.
- Tamper-evidence: confirm `body_hmac` mismatch on a manually-mutated row triggers the audit alert.
- Retention: confirm purge cron computes `MAX(created_at + 7yr, dob + 25yr)` correctly for a minor patient fixture.
- RLS: clinician without an active `patient_assignments` row cannot read messages even by direct URL.

**Pre-conditions for me/Claude to start the build:** confirm encryption key management approach (Supabase Vault vs env-injected KMS-derived key) and Twilio Messaging Service SID provisioning — both flagged in the spec.

---

## 3. Other planned-but-undesigned features / epics still open

Pulled from outstanding sections of `epic-status.md` — ordered by epic, not priority. Each item is currently **without a plan doc**; you'll want to triage which deserve a spec next.

### Epic 7 — Daily Return
- Push / SMS / email reminder for the daily check-in (channels + cadence undecided).
- Weekly insights digest from check-in patterns (template, send day, copy tone).
- Health-journal full UI — quick-link tile exists, page is unbuilt.

### Epic 8 — Living Record
- Wearable OAuth integrations — Oura, Apple Watch, Garmin (each is its own design).
- Manual metric entry UI (BP cuff, weight scale, glucose monitor without a wearable).
- `/alerts` index / triage page (currently only the dashboard chip).
- Alert *delivery* channels — push / SMS / email.
- Source-upload back-link from each lab row to its `patient_uploads` document.
- Snooze / dismiss-suppression and auto-resolve when next reading is back in range.
- Top-nav entry for `/labs` (currently dashboard quick-link only).

### Epic 9 — Care Team (beyond calendar + messaging)
- Clinical notes UI writing into `clinical.care_notes` (today only `appointments.notes` is writable).
- Janet chat persistence per patient — `clinician_conversation_id` column exists, not yet populated.
- Community feed and patient challenges (deferred sub-epic — needs product spec).
- **Real clinician pilot use** — gates the move from `●●●◐○` to `●●●●○`.

### Epic 10 — Knowledge Engine
- Category filter on `/insights` digest feed.
- medRxiv integration (v2).
- Clinical reviewer rubric for digest quality.
- (Operator) enable pgvector extension in Supabase dashboard; add `NCBI_API_KEY`.

### Epic 11 — Trust Layer
- Pause / freeze account flow refinement (basic pause shipped).
- Deceased-flag flow with warm copy path (not a checkbox — needs UX spec).
- Quarterly trust-audit cadence (logs scrub, signed-URL TTL check, deceased-flow walk-through).

### Epic 12 — Distribution
- **Employer dashboard** `/employer` — schema exists (`billing.organisations`, `organisation_addons`, `organisation_members`, `org_invites`), UI is unbuilt. Needs a full design pass.
- Bulk CSV invite intake handler — schema row exists, server action missing.
- **Supplement marketplace** — auto-replenishment + in-app purchase from protocol page.
- Sign-in-with-Vercel for clinician partners.
- Admin audit log (who changed agent settings and when).

### Epic 13 — Business Model (provider partners — entirely undesigned)
- `provider_partners`, `provider_offerings`, `provider_orders` tables.
- Admin pages under `app/(admin)/providers/` for onboarding, catalog editing, order monitoring.
- Janet `tool_use` → `search_offerings(category, region, evidence_tag)`.
- **Stripe Connect** — split payments to providers.
- Per-recommendation audit trail (Janet suggestion → offering surfaced → conversion → outcome).
- Provider-facing dashboard (Phase 6 self-service).
- Catalog evidence-discipline review process.
- Patient-side disclosure copy ("we receive a referral fee").

### Epic 14 — Platform Foundation (operational layer)
- CI: Playwright + Lighthouse on every PR (Vitest + pgTAP already running).
- Sentry / Highlight error monitoring + alert routing.
- Anthropic API spend dashboard + 80%-of-budget alert.
- Supabase storage quota alert.
- Vercel function execution-time monitoring.
- Supabase point-in-time-restore drill + `docs/operations/dr-runbook.md`.
- Quarterly penetration test cadence on a staging mirror.
- Monthly dependency CVE scan (Dependabot + `pnpm audit`).
- Weekly log scrub for PII regressions.
- Production-readiness checklist (`docs/operations/checklist.md`) + PR-template enforcement.
- AHPRA breach-notification protocol document.
- Data-residency confirmation per region.

---

## 4. Recommended decision order for tomorrow

1. **Sign off the three calendar product decisions in §2.1** (auto-confirm, session types, cancellation) — unblocks W1 immediately.
2. **Confirm secure-messaging key-management + Twilio Messaging Service SID** — unblocks the implementation plan.
3. **Pick one of `Employer dashboard`, `Provider partners`, or `Health journal full UI`** as the next epic to spec — these three are the largest planned-but-undesigned surfaces and all gate revenue or retention.
4. Everything in §3 under Epic 14 is *operator/SRE* work — fold into a separate platform-hardening sprint after pilot launch; not on the critical path for the Vietnam sprint MVP.

---

## 5. Files / commits worth opening directly

- `@/Applications/E8/client/longevity-coach-wha/docs/product/epic-status.md` — single source of truth for percentages and outstanding lists.
- `@/Applications/E8/client/longevity-coach-wha/docs/engineering/plan/clinician-patient-booking-calendar.md`
- `@/Applications/E8/client/longevity-coach-wha/docs/engineering/changes/2026-04-29/clinician-patient-booking-calendar/PLAN.md`
- `@/Applications/E8/client/longevity-coach-wha/docs/features/secure-messaging/janet-secure-messaging-spec.md`
- `@/Applications/E8/client/longevity-coach-wha/docs/engineering/changes/2026-04-29/secure-messaging/PLAN.md`
- `@/Applications/E8/client/longevity-coach-wha/supabase/migrations/0062_agent_conversations_realtime.sql` — last applied migration; next slot is `0063`.
