# Janet Cares — User Testing Checklist

A manual end-to-end checklist for the human tester (or you) to walk through after the codebase is debugged and ready for release. **Use this once per release, top to bottom**, with a fresh test account where indicated.

**Time required:** ~3 hours for a full pass. ~45 min for the smoke-only subset (marked `[smoke]`).

**Sign-off:** every section ends with a Pass / Fail / Note row — fill it in as you go.

**Severity legend:**
- **Show-stopper** — block release until fixed.
- **Visible defect** — release notes mention it; fix this sprint.
- **Polish** — backlog.

---

## 0. Test environment + accounts

Before you start, line these up:

- [ ] One **fresh patient account** (email never seen by the system) — `tester+patient1@janet.care` style.
- [ ] One **second patient account** for cross-account isolation tests — `tester+patient2@janet.care`.
- [ ] One **clinician account** (existing, or newly granted via SQL/admin UI).
- [ ] One **admin / super-admin account** (your account).
- [ ] **Stripe test mode** is enabled (look at the dashboard top-left corner — must say "Test mode").
- [ ] **Test card** ready: `4242 4242 4242 4242`, any future expiry, any CVC, any postcode.
- [ ] **A real PDF lab panel** to upload (a fictional one is fine, but realistic structure).
- [ ] Browser: **Chrome, Safari, Firefox** all available. Run the smoke pass in all three.
- [ ] **Mobile device** for responsive checks (or Chrome DevTools mobile emulation as fallback).

---

## 1. Public marketing site (no auth)  `[smoke]`

Open in an Incognito / Private window.

| # | Test | What to verify | Severity if fails |
|---|---|---|---|
| 1.1 | Open `/` | Page loads in under 3s, no console errors, hero renders, trust line shows **AHPRA-registered clinicians** (not GMC) | Show-stopper |
| 1.2 | Hero CTA "Get my bio-age →" | Routes to `/signup` | Show-stopper |
| 1.3 | Hero CTA "See a sample report" | Routes to `/sample-report` and renders | Show-stopper |
| 1.4 | Trust strip | Reads RACGP / 45 and Up Study / AHPRA / ISO 27001 — no UK regulator references anywhere | Show-stopper |
| 1.5 | Scroll to footer | Reads "© 2026 · WORK HEALTHY AUSTRALIA PTY LTD" — Privacy + Terms links work, not `#` | Visible defect |
| 1.6 | Open `/science` | Loads, has h1, no UK regulator refs | Visible defect |
| 1.7 | Open `/team` | Loads, has h1, photos render (or marked as illustrative) | Visible defect |
| 1.8 | Open `/stories` | Loads, has h1 | Visible defect |
| 1.9 | Open `/sample-report` | Sample patient is AU (Sydney/Melbourne/Brisbane), not London | Polish |
| 1.10 | Open `/legal/collection-notice` | Loads, mentions Work Healthy Australia Pty Ltd, AHPRA, Privacy Act 1988 | Show-stopper |
| 1.11 | Open `/legal/data-handling` | Loads, AU-compliant content | Show-stopper |
| 1.12 | Open `/pricing` | Nav renders correctly with normal logo size; if plans seeded, cards render with prices; if no plans, "Pricing details coming soon" empty state shows (no $0.00 row) | Show-stopper |
| 1.13 | Pricing — toggle Monthly/Annual | Prices update correctly, annual shows discounted total | Visible defect |
| 1.14 | Pricing — select a plan | "Continue to checkout" enables, total updates correctly | Show-stopper |
| 1.15 | OG previews | Share `https://janet.care` to Slack / iMessage. Unfurl shows AU-correct trust line, not UK | Visible defect |

**Outcome:** ☐ Pass · ☐ Fail · Notes:

---

## 2. Account creation, verification, sign-in  `[smoke]`

Use a fresh email `tester+patient1@janet.care`.

| # | Test | What to verify | Severity |
|---|---|---|---|
| 2.1 | Click "Begin" → `/signup` | Form renders with email, password, full name fields | Show-stopper |
| 2.2 | Submit with weak password | Inline error appears, password field NOT cleared | Visible defect |
| 2.3 | Submit with valid details | Redirects to "verify your email" page | Show-stopper |
| 2.4 | Check inbox | Welcome / verification email arrived within 30s, sender is `noreply@janet.care` (not Resend default), HTML renders with Janet Cares branding | Show-stopper |
| 2.5 | Click verify link | Lands on `/dashboard` with "Welcome" toast or onboarding prompt | Show-stopper |
| 2.6 | Sign out | Returns to `/login` | Show-stopper |
| 2.7 | Sign in again | Lands on `/dashboard` (or `/onboarding` if not done) | Show-stopper |
| 2.8 | Sign in with wrong password | Inline error, no redirect | Visible defect |
| 2.9 | "Forgot password" flow | Email arrives, reset link works, can sign in with new password | Show-stopper |
| 2.10 | Open `/uploads` while logged out | Bounces to `/login?redirect=/uploads`, after sign-in lands on `/uploads` (NOT dashboard) | Visible defect |
| 2.11 | Open `/insights` while logged out | Same — preserves redirect (currently broken per BUG-024) | Visible defect |
| 2.12 | Browser tab title on `/login` | Reads "Sign in · Janet Cares" — NOT "Sign in · Janet Cares · Janet Cares" | Polish |

**Outcome:** ☐ Pass · ☐ Fail · Notes:

---

## 3. Health questionnaire (onboarding)  `[smoke]`

As `tester+patient1` immediately after signup.

| # | Test | What to verify | Severity |
|---|---|---|---|
| 3.1 | Land on `/onboarding` | Step 1 renders (basics) | Show-stopper |
| 3.2 | Fill step 1, click Next | Saves draft, advances to step 2 | Show-stopper |
| 3.3 | Refresh mid-questionnaire | Resumes at the step you left, with answers preserved | Show-stopper |
| 3.4 | Fill all 6 steps with realistic data | Each step's plain-English description is present and readable | Visible defect |
| 3.5 | Submit final step | Redirects to `/dashboard` with onboarding-complete prompt | Show-stopper |
| 3.6 | Wait 30–60s, refresh dashboard | Bio-age + 5 risk domain scores have appeared (risk_analyzer pipeline ran) | Show-stopper |
| 3.7 | Open Supabase Studio → `health_profiles` | Patient row exists, `responses` JSONB contains questionnaire answers, `completed_at` is set | Show-stopper |
| 3.8 | `health_profiles.responses` JSONB | Does NOT contain `date_of_birth`, `phone_mobile`, `address_postal` (PII boundary) | Show-stopper |
| 3.9 | `profiles` row | DOB / phone / postal address ARE here (correct PII location) | Show-stopper |
| 3.10 | `risk_scores` row | Exists for this user, `narrative` field is non-null and reads naturally | Show-stopper |
| 3.11 | `supplement_plans` row | Exists with at least 3 critical-tier items, each with rationale | Show-stopper |

**Outcome:** ☐ Pass · ☐ Fail · Notes:

---

## 4. Subscription / Stripe checkout  `[smoke]`

| # | Test | What to verify | Severity |
|---|---|---|---|
| 4.1 | From dashboard, navigate to subscription / pricing | Plan cards visible | Show-stopper |
| 4.2 | Select monthly plan, click Continue | Redirects to `checkout.stripe.com` with the right product + price | Show-stopper |
| 4.3 | Use test card `4242 4242 4242 4242` | Payment succeeds | Show-stopper |
| 4.4 | After Stripe redirect | Lands on `/dashboard?checkout=success` (NOT localhost) | Show-stopper |
| 4.5 | Subscription state | Dashboard reflects "Active" within 30s of payment | Show-stopper |
| 4.6 | Stripe webhook | Check Vercel logs — `[stripe/webhook] subscription.created` fired and processed | Show-stopper |
| 4.7 | Supabase `subscriptions` row | Exists for this user with `status = 'active'` | Show-stopper |
| 4.8 | Cancel via Stripe customer portal | Subscription state updates in app within 30s | Visible defect |

**Outcome:** ☐ Pass · ☐ Fail · Notes:

---

## 5. Dashboard + Report  `[smoke]`

| # | Test | What to verify | Severity |
|---|---|---|---|
| 5.1 | Open `/dashboard` | Bio-age, subscription status, next-action CTA, uploads card all render | Show-stopper |
| 5.2 | Member alerts chip | If any alerts exist, chip is visible with severity tone | Visible defect |
| 5.3 | Open `/report` | Risk narrative, 5 domain scores, supplement table, Janet chat panel all render | Show-stopper |
| 5.4 | Janet chat panel | Visible at desktop as a sticky sidebar; collapses appropriately on mobile | Visible defect |
| 5.5 | Download branded PDF | PDF downloads with Janet Cares branding, member name, date, scores, protocol | Show-stopper |
| 5.6 | PDF filename | Matches Janet Cares branding (not "longevity-coach-export-…") | Polish |

**Outcome:** ☐ Pass · ☐ Fail · Notes:

---

## 6. Janet conversational agent  `[smoke]`

In `/report` chat panel:

| # | Test | What to verify | Severity |
|---|---|---|---|
| 6.1 | Type "What's my biggest risk?" and submit | Streaming response begins within 1.5s, references your actual top driver | Show-stopper |
| 6.2 | Type "Tell me about my supplement protocol" | Janet uses supplement_advisor sub-agent (response references items by name) | Visible defect |
| 6.3 | Type "What exercise should I do this week?" | Janet uses pt_coach sub-agent | Visible defect |
| 6.4 | Sign out, sign back in, return to chat | Janet's first response references something from the previous session | Visible defect |
| 6.5 | Browser DevTools console while chatting | NO `[janet-chat realtime] payload` logs (no PII leak) | Show-stopper |
| 6.6 | Network tab during a chat turn | Streamed response, not a single blob; no obvious PII in URL params | Show-stopper |
| 6.7 | Latency | Median first-token under 1s, full response under 30s | Visible defect |

**Outcome:** ☐ Pass · ☐ Fail · Notes:

---

## 7. Uploads + Janet document parser

| # | Test | What to verify | Severity |
|---|---|---|---|
| 7.1 | Open `/uploads` | Multi-file dropzone visible, existing uploads listed | Show-stopper |
| 7.2 | Drop one PDF lab panel | Upload starts, status indicator updates: pending → analysing → complete | Show-stopper |
| 7.3 | Drop 3 files at once | All three process in parallel, each independent | Visible defect |
| 7.4 | After "complete" status | Open Supabase → `patient_uploads` row has `janet_status = 'complete'` and findings populated | Show-stopper |
| 7.5 | Same upload again (duplicate detection) | Second upload deduplicated by SHA-256 | Visible defect |
| 7.6 | After upload | `biomarkers.lab_results` has structured rows for each biomarker, with derived status (low/optimal/high/critical) | Show-stopper |
| 7.7 | Member alerts | If any biomarker is `low`/`high`/`critical`, an alert appears on the dashboard chip within 60s | Show-stopper |
| 7.8 | Open `/labs` | Biomarker list shows new results | Visible defect |
| 7.9 | Open `/labs/[biomarker]` | Trend chart renders if multiple historical values exist | Visible defect |
| 7.10 | `/simulator` | LDL/HbA1c/hsCRP/SBP/Weight sliders work, scores update in real time | Visible defect |

**Outcome:** ☐ Pass · ☐ Fail · Notes:

---

## 8. Daily check-in + streaks

| # | Test | What to verify | Severity |
|---|---|---|---|
| 8.1 | Open `/check-in` | Mood / sleep / energy / exercise form renders | Show-stopper |
| 8.2 | Submit check-in | Saves to `daily_checkins`, streak count updates on dashboard | Show-stopper |
| 8.3 | Streak display | M-T-W-T-F-S-S dots reflect the past week accurately | Visible defect |
| 8.4 | Check-in twice in one day | Second submission updates the existing row, doesn't create a duplicate | Visible defect |
| 8.5 | Open `/trends` | Line chart of past 30 days renders | Visible defect |
| 8.6 | Open `/journal` | Past check-ins listed in reverse chronological order | Visible defect |

**Outcome:** ☐ Pass · ☐ Fail · Notes:

---

## 9. Account settings

| # | Test | What to verify | Severity |
|---|---|---|---|
| 9.1 | Open `/account` | Identity, Security, Care Team, Notifications, Delete sections all render | Show-stopper |
| 9.2 | Edit Identity card with invalid data | **Inline error shows the real reason** (NOT "Something went wrong") | Show-stopper |
| 9.3 | Edit Identity card valid update | Saves, success state shown | Show-stopper |
| 9.4 | Change password — wrong current password | **Inline error: "current password is incorrect"** (or similar real message) | Show-stopper |
| 9.5 | Change password — valid | Saves, can sign out and in with new password | Show-stopper |
| 9.6 | Change email | Verification flow fires, new email becomes the login after confirm | Visible defect |
| 9.7 | Notifications prefs toggle | Saves, persists across reload | Visible defect |
| 9.8 | Care Team — invite a clinician | Invite email sends, clinician can accept | Visible defect |
| 9.9 | Click "Delete account" | Confirmation modal appears, requires explicit confirm, hard to fat-finger | Show-stopper |
| 9.10 | Cancel account deletion | Returns to account page, account still active | Show-stopper |
| 9.11 | Click "Export my data" | ZIP downloads with branded filename, contains profile, questionnaire, lab results, conversations | Show-stopper |

**Outcome:** ☐ Pass · ☐ Fail · Notes:

---

## 10. Cross-account isolation (RLS)

Critical — PII / clinical data security.

| # | Test | What to verify | Severity |
|---|---|---|---|
| 10.1 | Sign in as `tester+patient2`, open Supabase Studio with the **anon key** | Cannot see patient1's `profiles` row | Show-stopper |
| 10.2 | Same — `health_profiles` | Cannot see patient1's `health_profiles` row | Show-stopper |
| 10.3 | Same — `risk_scores`, `supplement_plans`, `patient_uploads`, `lab_results`, `agent_conversations`, `daily_checkins`, `member_alerts`, `consent_records` | Cannot see patient1's rows in ANY of these | Show-stopper |
| 10.4 | Patient2 cannot UPDATE patient1's rows | (use raw SQL via the JS client with anon key) | Show-stopper |
| 10.5 | Patient2 cannot DELETE patient1's rows | Same | Show-stopper |
| 10.6 | Patient2 attempts to insert into another patient's `daily_checkins` | Rejected by RLS | Show-stopper |

**Outcome:** ☐ Pass · ☐ Fail · Notes:

---

## 11. Clinician portal

Sign in as the clinician account.

| # | Test | What to verify | Severity |
|---|---|---|---|
| 11.1 | Open `/clinician` | Two-pane workspace renders, queue grouped by status (awaiting / in_review / program_ready / sent_to_patient) | Show-stopper |
| 11.2 | Urgent flag | Patients flagged `needs_attention` or stress ≥ 8 are visually distinguished | Visible defect |
| 11.3 | Click a patient | Right pane shows Patient card with Janet brief, structured fields | Show-stopper |
| 11.4 | Janet chat panel | Live chat with `janet_clinician` agent works; system prompt is clinician-colleague tone | Show-stopper |
| 11.5 | 30-Day Program tab | Save draft works | Show-stopper |
| 11.6 | Approve & Send | Sets `review_status = sent_to_patient`, patient gets notification | Show-stopper |
| 11.7 | Booking calendar | Clinician availability shows; can publish recurring slots | Visible defect |
| 11.8 | Cross-clinician isolation | This clinician cannot see another clinician's assigned patients (verify with a 2nd clinician account) | Show-stopper |

**Outcome:** ☐ Pass · ☐ Fail · Notes:

---

## 12. Admin / Super Admin

Sign in as the admin account.

| # | Test | What to verify | Severity |
|---|---|---|---|
| 12.1 | Open `/admin` | Loads (defense-in-depth `is_admin` check passes) | Show-stopper |
| 12.2 | Open `/admin/tiers` | Tier management UI renders | Visible defect |
| 12.3 | Open `/admin/plan-builder` | Plan builder UI renders, can create a draft plan | Visible defect |
| 12.4 | Open `/admin/users` (when shipped) | User list renders with current role assignments | Visible defect |
| 12.5 | Grant a role to another user | `user_role_assignments` row created, audit log captures the change | Show-stopper |
| 12.6 | Revoke a role | `revoked_at` set, audit log captures it | Show-stopper |
| 12.7 | Try to grant `super_admin` as Admin (not Super) | Rejected with "only super_admin can grant" message | Show-stopper |
| 12.8 | Try to grant `manager` to user without AHPRA verification | Rejected with "manager role requires ahpra_verified_at" message | Show-stopper |
| 12.9 | Non-admin user opens `/admin` | Bounces to dashboard, no admin UI visible | Show-stopper |

**Outcome:** ☐ Pass · ☐ Fail · Notes:

---

## 13. Role-based visibility (after PR #113 + 0069 ship)

| # | As role | Can access | Cannot access | Severity |
|---|---|---|---|---|
| 13.1 | Patient | Own dashboard, report, account, uploads | Other patients' data, /admin, /clinician | Show-stopper |
| 13.2 | Clinician | Assigned patients' clinical records, /clinician | Non-assigned patients, /admin tier-management | Show-stopper |
| 13.3 | Manager (AHPRA) | All B2C OR B2B patients (per scope), op metadata, billing/seat | The other segment | Show-stopper |
| 13.4 | Corp Health Manager | Own org's seat data + aggregate health | Individual patient clinical records, other orgs | Show-stopper |
| 13.5 | Admin | Suppliers, plans, role builder, rosters, billing/seat | Per-patient clinical records | Show-stopper |
| 13.6 | Super Admin | Everything | n/a | Show-stopper |

**Outcome:** ☐ Pass · ☐ Fail · Notes:

---

## 14. Cross-cutting

| # | Test | What to verify | Severity |
|---|---|---|---|
| 14.1 | Mobile (Safari iOS or Chrome DevTools at 375 × 812) | Hero, dashboard, /report, /pricing all readable; nav collapses to hamburger or stacks; no horizontal scroll | Visible defect |
| 14.2 | Tablet (768 px) | Layouts adapt cleanly | Polish |
| 14.3 | Slow network (Chrome DevTools → Slow 3G) | Pages still load within 10s, loading states shown | Polish |
| 14.4 | Sign in across Chrome / Safari / Firefox | All three work end to end | Show-stopper |
| 14.5 | DevTools Console on every page | Zero red errors on a clean session | Visible defect |
| 14.6 | Lighthouse score on `/` | Performance ≥ 80, A11y ≥ 90, Best Practices ≥ 90, SEO ≥ 95 | Visible defect |
| 14.7 | Tab `<title>` on every page | No "Janet Cares · Janet Cares" duplication | Polish |

**Outcome:** ☐ Pass · ☐ Fail · Notes:

---

## 15. Regulatory / compliance smoke  `[smoke]`

| # | Test | What to verify | Severity |
|---|---|---|---|
| 15.1 | Sign-up flow | Consent record written to `consent_records` (append-only) with policy version, timestamp, channel | Show-stopper |
| 15.2 | All public pages | No "GMC", "Royal College of GPs" (UK), "Imperial Longevity Lab", "UK Biobank" anywhere | Show-stopper |
| 15.3 | Footer entity | "Work Healthy Australia Pty Ltd" — not a UK Ltd | Show-stopper |
| 15.4 | Privacy / Terms links | Both work, content references AHPRA + Privacy Act 1988 | Show-stopper |
| 15.5 | OG image | Every social-share preview shows AU credentials | Visible defect |
| 15.6 | Vercel logs during a test session | NO logs containing email, full name, DOB, address, lab values, or other PII | Show-stopper |
| 15.7 | Resend dashboard | Auth emails send via your domain (`janet.care`), not Resend default | Visible defect |
| 15.8 | Right-to-erasure | Delete an account, verify data is removed from `profiles`, `health_profiles`, `risk_scores`, etc. (or anonymised per the erasure policy) | Show-stopper |

**Outcome:** ☐ Pass · ☐ Fail · Notes:

---

## 16. AI quality (sample-based)

Spot-check the AI surfaces — these can't be exhaustively tested manually, but you can sample.

| # | Test | What to verify | Severity |
|---|---|---|---|
| 16.1 | Pick 5 random patients, read their `risk_scores.narrative` | Narrative references the patient's actual top drivers, sounds clinically grounded, no hallucinated medical claims | Show-stopper |
| 16.2 | Pick 5 random patients, read their `supplement_plans.items` | Each item has a clear rationale; tier assignments make sense | Show-stopper |
| 16.3 | Run a 10-turn conversation with Janet | She remembers earlier turns; answers stay grounded in the patient's actual data | Show-stopper |
| 16.4 | Ask Janet for a research citation | If she cites a source, the source actually exists and says what she claims | Visible defect |
| 16.5 | Janet sub-agent invocation | When you ask about exercise / supplements / risk, the right sub-agent fires (visible in `agent_usage` table or response shape) | Visible defect |

**Outcome:** ☐ Pass · ☐ Fail · Notes:

---

## 17. Operational

| # | Test | What to verify | Severity |
|---|---|---|---|
| 17.1 | Sentry dashboard | Receiving errors from prod (run a test 500 to confirm); no flood of unrelated noise | Show-stopper |
| 17.2 | Vercel deploy | Latest main is deployed and healthy | Show-stopper |
| 17.3 | Cron jobs | `repeat-tests`, `drip-emails`, `clinician-brief` etc. fired in last 24h (check Vercel cron logs) | Visible defect |
| 17.4 | Supabase status | All extensions enabled; pgvector, pg_cron healthy | Visible defect |
| 17.5 | Cost dashboard | Anthropic API spend reasonable; no runaway agent loops in `agent_usage` | Visible defect |

**Outcome:** ☐ Pass · ☐ Fail · Notes:

---

## Final sign-off

| Section | Pass / Fail | Tester | Date |
|---|---|---|---|
| 1. Public marketing | | | |
| 2. Auth | | | |
| 3. Onboarding | | | |
| 4. Stripe | | | |
| 5. Dashboard + Report | | | |
| 6. Janet | | | |
| 7. Uploads | | | |
| 8. Daily check-in | | | |
| 9. Account | | | |
| 10. RLS isolation | | | |
| 11. Clinician | | | |
| 12. Admin | | | |
| 13. Role visibility | | | |
| 14. Cross-cutting | | | |
| 15. Regulatory | | | |
| 16. AI quality | | | |
| 17. Operational | | | |

**Release decision:**

- ☐ All show-stoppers pass → ship.
- ☐ Visible defects only → ship with release note + sprint task to fix.
- ☐ Any show-stopper fails → do not ship.

**Signed:** ____________________ **Date:** ____________________

---

## Notes for next time

If you find anything not covered by this checklist, add it here and update the checklist for the next release.

| What was missed | Where it should live in the checklist |
|---|---|
| | |
