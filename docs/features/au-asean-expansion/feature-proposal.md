# Feature Proposals — AU & ASEAN Expansion
**Date:** 2026-04-29
**Source:** Janet Global Competitive Audit v2.0 (`docs/engineering/plan/janet-globa-audit-expanded.html`)
**Status:** Proposed — pending James review. Nothing here is scheduled or committed.

These are **net-new feature areas** not covered by the existing 14 epics. If James approves any of them, they graduate to a numbered epic in `docs/product/epics.md`.

---

## Existing coverage — deconflict

Features already addressed in the current epics are excluded below even where the audit mentions them.

| Audit gap | Covered by | Status |
|---|---|---|
| Lab PDF import + biomarker parsing | Epic 2 + Epic 8 | In build |
| Live wearable data | Epic 8 (outstanding) | Scheduled |
| Supplement marketplace | Epic 13 | Scheduled |
| B2B corporate PEPM | Epic 12 | Scheduled |
| Clinician portal | Epic 9 | Scheduled |
| Gamification / points | Epic 7 | Partial |

---

## Proposed features

| # | Proposed Epic | Market | Must-have for launch? | Engineering entry point | Rationale |
|---|---|---|---|---|---|
| P1 | Regional Compliance Layer | AU + ASEAN | **Yes — legal prerequisite** | Consent schema extension, data residency config, breach-notification cron | Can't accept paying users in AU/ASEAN without TGA, AU Privacy Act, SG PDPA, ID PDP, Thai PDPA compliance |
| P2 | Insurer Partnership Layer | APAC | **Yes for APAC consumer pricing** | `insurer_accounts` table, wellness score webhook, insurer admin portal | AIA Vitality subsidises at S$8/mo. Without an insurer B2B model, direct pricing is non-competitive |
| P3 | Localisation Engine | ASEAN | **Yes for non-EN markets** | `next-intl` i18n, `locale` on profiles, halal flag on supplement catalog, TCM contraindication index | Bahasa MY/ID, Mandarin, Thai unlock ~85% of addressable ASEAN population currently excluded |
| P4 | Epigenetic Layer | AU + SG | No — differentiator | `biomarkers.epigenetic_scores` table, CSV/API import, risk engine confidence upgrade | TruDiagnostic (global), MFM/Biogenix (AU), Chi Longevity (SG) — import-only, no lab build. Closes biggest credibility gap vs Vively |
| P5 | Coach Ecosystem | ANZ | **Yes for coach distribution** | `coach_assignments`, `coach_commissions`, `coach_profiles` tables, `/coach/` portal, public `/find-a-coach` | HCANZA coaches are Janet's ANZ distribution channel. Distinct from clinicians (Epic 9) — no AHPRA, different workflow |
| P6 | White-Label / Clinic Licensing | APAC + AU | No — expansion accelerator | `tenants` table, per-tenant theming + routing, tenant-scoped Janet persona | APAC private hospitals (Bumrungrad, Gleneagles, Siloam) + AU functional medicine clinics want a branded platform for their patients |
| P7 | Microbiome Pipeline | SG + Global | No — quality differentiator | `biomarkers.microbiome_scores` table, AMILI/Viome import, Sage prompt extension | Gut microbiome data materially improves supplement protocol accuracy (probiotic strain, magnesium form selection) |

---

## P1 — Regional Compliance Layer

**Classification:** AU must-have · ASEAN must-have
**Equivalent epic if approved:** Epic 15

**Rationale:** Epic 11 (The Trust Layer) is AHPRA-focused and UK/GDPR-aligned. This is a distinct set of obligations:
- **TGA (AU)** — Therapeutic Goods Advertising Code. Every Sage-generated supplement claim must be TGA-compliant. Non-compliant claim = legal liability per protocol.
- **Australian Privacy Act 1988 + APPs** — breach notification within 30 days (not GDPR's 72h), explicit sensitive health data consent, right to access and correction. Different framework to GDPR.
- **HCANZA recognition** — required for any HCANZA-accredited coach to recommend Janet. The coach network is the AU distribution channel.
- **Singapore PDPA** — 3-day breach notification, data residency options.
- **Indonesian PDP Law 2022** — data localisation requirements.
- **Thai PDPA** — DPO appointment required at scale.
- **ISO 27001 roadmap** — Naluri and ThoughtFull cite this as SEA enterprise sales gate.

**Engineering entry points:**
- Data residency config: Supabase region selection per `profiles.country`
- Consent schema: extend `consent_records` with `market` and `policy_version_market` fields
- Breach notification: background job monitors Supabase audit log; alerts admin within market-specific TTL
- Supplement catalog: `tga_compliant boolean` + `tga_claim_level text` on each item
- Export bundle: APPs-compliant format (extends existing export-everything at `/api/export`)

**What needs James:** TGA legal review of the supplement catalog. Privacy solicitor engagement per market. HCANZA application process.

---

## P2 — Insurer Partnership Layer

**Classification:** APAC must-have (consumer pricing viability)
**Equivalent epic if approved:** Epic 16

**Rationale:** AIA Vitality is available at S$8/month because AIA cross-subsidises it against insurance premium discounts. Janet's direct pricing (~S$30–50/month equivalent) cannot compete without an insurer subsidy model. The window to partner with smaller APAC insurers (Income/Singlife, FWD, Great Eastern) before they sign exclusivity with AIA Vitality is open now — likely 12–18 months.

**Engineering entry points:**
- `insurer_accounts` table in `billing` schema: insurer FK, PEPM rate, region, API webhook URL
- `wellness_score` computed view: derived from check-in streak, risk score delta over 90 days, alert resolution rate — pure read, no new data
- Outbound webhook: weekly `wellness_score` push to insurer API (configurable per `insurer_accounts.webhook_url`)
- Insurer admin portal: `/insurer/` route group, aggregate cohort data only (no individual PII), RLS scoped to `insurer_id`
- Co-branded onboarding: `?ref=insurer_slug` query param → `profiles.insurer_id` FK at signup

**What needs James:** Insurer partnership negotiations (business development). Deciding which insurer to pilot with first. Agreeing on the wellness score definition with the insurer's actuarial team.

---

## P3 — Localisation Engine

**Classification:** ASEAN must-have (non-EN markets)
**Equivalent epic if approved:** Epic 17

**Rationale:** Bahasa Malaysia and Indonesian together cover ~280M people. Mandarin covers SG/MY Chinese-speaking communities. Thai covers 70M. English-only is a demographic ceiling of ~15% of addressable ASEAN population. Beyond translation, the supplement protocols that are Janet's core IP are built on Western dietary science and must be validated for Asian dietary contexts — rice-based diets, hawker food, halal requirements, and TCM contraindication awareness.

**Engineering entry points:**
- `next-intl` (or `next-i18next`) for Next.js App Router i18n
- `profiles.locale` column: captured at signup from `Accept-Language` or user preference
- Translation strings: `messages/{en,ms,zh-Hans,th}.json`
- Supplement catalog schema: `halal_certified boolean`, `tcm_contraindications text[]`
- Sage prompt: conditional halal filter when `profiles.locale` is `ms` or `id` and user has Muslim dietary preference (questionnaire field)
- Nova pipeline: add "Asian health / SEA dietary science" category scan

**What needs James:** Regional dietitian contracts for protocol localisation review. Halal certification scope (which items need MUI certification vs. just ingredient review). Decision on which languages to ship first.

---

## P4 — Epigenetic Layer

**Classification:** AU highly compatible · Global differentiator
**Equivalent epic if approved:** Epic 18

**Rationale:** DNA methylation clocks (DunedinPACE, GrimAge, PhenoAge) are becoming the gold standard for biological age measurement. Every premium AU competitor offers this (Vively via PhenoAge, MFM, Biogenix) and InsideTracker/TruDiagnostic in the US. This is a **partnership import model only** — no lab infrastructure required. Janet imports the score, displays it alongside the questionnaire-derived bio age, and uses it to upgrade confidence levels in Atlas narratives.

**Engineering entry points:**
- `biomarkers.epigenetic_scores`: `(user_uuid, source, score_type, score_value, test_date, raw_report_url)`
- Import flow: CSV upload via `/uploads` + automated column-map parsing (reuses Janet upload infrastructure)
- Risk engine: when `epigenetic_scores` row exists, `confidence_level` upgrades to `epigenetic_confirmed`
- Bio age dashboard tile: dual display — "Questionnaire: 38" / "Epigenetic (TruDiagnostic): 35"
- Atlas prompt: includes epigenetic score when present, notes source and test date
- Repeat test reminder: Janet surfaces at month 11 post-test-date

**What needs James:** TruDiagnostic affiliate agreement. MFM or Biogenix partnership agreement for AU. Chi Longevity or Alexandra Hospital HEAL for SG.

---

## P5 — Coach Ecosystem

**Classification:** ANZ must-have (distribution channel)
**Equivalent epic if approved:** Epic 19

**Rationale:** Janet's "no-staff ecosystem" model depends on an activated HCANZA coach network. Coaches need a portal, patient assignment tooling, and commission tracking to make Janet their practice platform of choice. This is explicitly distinct from the clinician layer (Epic 9): coaches are not AHPRA-registered practitioners, carry lower clinical liability, cover a much broader market, and use Janet as a client engagement tool rather than a clinical records system.

**Clinician (Epic 9) vs Coach (this feature):**
| | Clinician | Coach |
|---|---|---|
| Registration | AHPRA | HCANZA |
| Liability | Clinical | Wellness |
| Portal purpose | Care notes, clinical briefs, appointments | Habit coaching, supplement guidance |
| Commission | N/A | % of supplement / test orders |
| Volume | Low (specialist) | High (mass market) |

**Engineering entry points:**
- `coach_profiles`: credentials, bio, specialties, `is_public`, `hcanza_id`
- `coach_assignments`: `(coach_uuid, patient_uuid, assigned_at, status)`
- `coach_commissions`: `(coach_uuid, order_id, order_type, amount_cents, payout_status)`
- Commission hook: `provider_orders` write (Epic 13) → check `coach_assignments` → insert `coach_commissions` row
- `/coach/` portal: patient list, patient summary (bio age, risk, protocol, 7-day check-ins), commission ledger
- `/find-a-coach`: public listing, filterable by specialty and location
- PDF report: coach name + credentials in footer when `coach_assignment` exists

**What needs James:** HCANZA recognition application. Commission rate decision (% of supplement order). Whether coaches can be non-HCANZA in phase 1 (open to any certified wellness coach globally).

---

## P6 — White-Label / Clinic Licensing

**Classification:** APAC highly compatible · AU high-value
**Equivalent epic if approved:** Epic 20

**Rationale:** APAC private hospital networks (Bumrungrad TH, Mount Elizabeth SG, Gleneagles SG/MY, Siloam ID) and AU functional medicine clinics want a longevity platform branded as their own for their patients. HolistiCare runs this model in the US. White-label licensing gives Janet APAC distribution without competing directly in consumer marketing.

**Engineering entry points:**
- `tenants` table in `billing` schema: `(id, name, domain, theme_json, approved_supplement_categories, active_plan_id)`
- `profiles.tenant_id` nullable FK: null = direct consumer; set = white-label patient
- Tenant resolution in `proxy.ts`: hostname → `tenants.domain` lookup at request time
- CSS variables override: tenant's `theme_json` injected as `<style>` in root layout
- Janet persona: system prompt includes `tenant.janet_name` and `tenant.guardrails` when `tenant_id` is set
- `tenant_custom_fields` JSONB: up to 10 custom questionnaire fields per tenant
- Billing: per-patient PEPM invoice via Stripe (no checkout shown to patient)

**What needs James:** Clinic licensing pricing decision (PEPM rate). Minimum patient commitment per tenant. How much of the product can a tenant suppress (e.g. can they disable the supplement protocol entirely)?

---

## P7 — Microbiome Pipeline

**Classification:** SG highly compatible · Global medium-term
**Equivalent epic if approved:** Epic 21

**Rationale:** Gut microbiome composition predicts supplement absorption more accurately than blood panels alone. Magnesium form (glycinate vs. malate vs. threonate) and probiotic strain efficacy are highly microbiome-dependent. AMILI (SG) is launching a personalised nutrition app with Google in April 2026. Viome leads globally. Neither has a longevity coaching layer — Janet can import their output and use it to materially improve Sage's protocol specificity.

**Engineering entry points:**
- `biomarkers.microbiome_scores`: `(user_uuid, source, diversity_score, keystone_presence jsonb, deficiency_flags text[], test_date)`
- Import flow: CSV/JSON upload via `/uploads`, parsed by Janet upload infrastructure
- Sage prompt extension: when `microbiome_scores` present, include deficiency flags and keystone species summary; adjust probiotic and magnesium recommendations accordingly
- `PatientContext.load()`: microbiome scores as 11th parallel read
- Nova pipeline: add "microbiome and longevity" category scan

**What needs James:** AMILI API agreement. Viome affiliate agreement. Decision on whether to build an in-app "order a microbiome test" flow (links to Epic 13 provider ecosystem) or import-only initially.

---

## Recommended phasing

| Phase | Features to include |
|---|---|
| Before AU consumer launch | P1 (compliance) · P5 (coach ecosystem) |
| Before APAC consumer launch | P1 (compliance) · P2 (insurer) · P3 (localisation) |
| After first 1,000 users | P4 (epigenetic) · P7 (microbiome) — low engineering lift, high credibility |
| Phase 6+ (Scale) | P6 (white-label) — high effort, high ceiling |
