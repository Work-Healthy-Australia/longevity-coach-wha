# Current State Assessment — 2026-04-28

## Phase 1 (Foundation) — 90% complete

### Done

| Area | Status | Notes |
|---|---|---|
| Auth (signup, login, password reset, email verify) | ✅ Done | OTP + PKCE both handled in `/auth/callback` |
| Marketing / public pages | ✅ Done | `/`, `/science`, `/team`, `/stories`, `/sample-report`, legal |
| Onboarding questionnaire (6 steps) | ✅ Done | Schema-driven, save-and-resume, PII split at write time |
| Stripe checkout + webhook | ✅ Done | Subscription lifecycle handled; RLS-correct upserts |
| File uploads portal | ✅ Done | Supabase Storage bucket, 50 MB limit, MIME whitelist |
| Janet document analyser | ✅ Done | `lib/uploads/janet.ts` — Claude Opus 4.7 + adaptive thinking |
| Janet wired to upload action | ✅ Done | `uploads/actions.ts` calls `analyzeUpload()` synchronously |
| Dashboard (basic) | ✅ Done | Assessment state, risk score placeholders, uploads count, subscription |
| Welcome email on signup | ✅ Done | Resend; idempotent; silently no-ops without `RESEND_API_KEY` |
| RLS on every table | ✅ Done | All 13 migrations enforce RLS |
| Consent records | ✅ Done | Append-only `consent_records` table; written on assessment submit |

### Gaps remaining in Phase 1

| Gap | Impact | Notes |
|---|---|---|
| `/report` page does not exist | High | Users have no place to see their results |
| `/account` page does not exist | Medium | No self-service profile/subscription management |
| Logged-in nav has no links | Medium | Only logo + sign-out; no Dashboard/Report/Uploads links |
| Admin CRM is a stub | Medium | James cannot see users or analytics |
| Drip email sequences | Low | Welcome only; no Day 1/3/7 re-engagement |

---

## Phase 2 (Intelligence) — 0% complete

The entire agent/pipeline layer is unbuilt. `lib/ai/` contains only `.gitkeep`.

### What the user story needs next

The patient has now:
1. Signed up ✅
2. Completed onboarding questionnaire ✅
3. Uploaded blood test files ✅ (Janet analysed them)

The platform has not yet:
- Generated a biological age or domain risk scores
- Written a human-readable risk narrative
- Created a supplement protocol
- Given the patient anywhere to see these results
- Enabled the patient to talk to Janet

---

## Database state

13 migrations applied. Key schema facts:

| Table | Schema | State |
|---|---|---|
| `profiles` | public | ✅ Has: full_name, date_of_birth, phone, role |
| `health_profiles` | public | ✅ Has: responses JSONB, completed_at |
| `risk_scores` | public | ✅ Has: domain scores, bio-age, narrative-adjacent columns (top_risk_drivers, recommended_screenings, confidence_level). Missing: `narrative` text, `engine_output` jsonb, `data_gaps` text[] |
| `patient_uploads` | public | ✅ Complete with janet_* columns |
| `supplement_plans` | public | ✅ Has: items JSONB, status, valid_from/to |
| `coach_suggestions` | public | ✅ Complete |
| `care_notes` | public | ✅ Complete |
| `periodic_reviews` | public | ✅ Complete |
| `patient_assignments` | public | ✅ Complete |
| `agent_conversations` | — | ❌ Missing — needed for Janet chat |
| `support_tickets` | — | ❌ Missing — needed for Alex |
| `appointments` | — | ❌ Missing — needed for Janet booking |
| `health_updates` | — | ❌ Missing — needed for Nova digest display |
| `health_knowledge` | — | ❌ Missing — needed for Janet RAG |

---

## lib/ state

| Path | State |
|---|---|
| `lib/uploads/janet.ts` | ✅ Complete — document analyser |
| `lib/questionnaire/` | ✅ Complete |
| `lib/profiles/` | ✅ Complete — PII split, name helpers |
| `lib/supabase/` | ✅ Complete — all four clients |
| `lib/email/` | ✅ Complete — welcome email |
| `lib/consent/` | ✅ Complete |
| `lib/stripe/` | ✅ Stripe client exists |
| `lib/ai/` | ❌ Empty — PatientContext, pipelines, Janet all missing |
| `lib/risk/` | ❌ Empty — deterministic risk engine not built |
| `lib/pdf/` | ❌ Empty — PDF generation not built |

---

## Risk engine note

The deterministic risk engine (`lib/risk/`) has not been built. The agent-system.md data flow shows it should run synchronously inside `submitAssessment()` before the redirect. For Phase 2, the Risk Narrative Pipeline will operate directly from questionnaire responses and upload findings, computing initial risk scores via LLM. When the deterministic engine is built, it will slot in before the LLM pipeline and supply structured `engine_output` for the narrative to annotate.

---

## Key invariants that must not change

1. PII lives only on `profiles`. `health_profiles.responses` is de-identified.
2. Supabase key naming: `SUPABASE_SECRET_KEY` (not `SUPABASE_SERVICE_ROLE_KEY`).
3. `proxy.ts` is the route guard — no ad-hoc auth in pages.
4. `useActionState` from `react` (not `react-dom`) — React 19 rename.
5. Pipeline writes use the admin (service-role) client. Never the user client.
