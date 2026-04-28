# Plan: P0 — Complete Vietnam Sprint MVP (non-AI track)
**Date:** 2026-04-28
**Phase:** 2 (Intelligence) + slice of 1 (Foundation hardening)
**Status:** Draft

## Objective

Ship the five P0 items + one P1 prerequisite that close the original Vietnam Sprint MVP definition for the non-AI track. After this change:
- Risk scores are deterministic with `confidence_level='high'` (no longer LLM-only).
- Supplement protocol items come from a curated, evidence-tagged catalog.
- The branded PDF is a clinical-looking document.
- Admin can see MRR / active members / churn / pipeline runs in one screen.
- The pgTAP RLS regression suite blocks any PR that weakens row-level security.
- A working GitHub Actions CI runs typecheck, tests, build, and pgTAP on every PR.

Done = the original Vietnam Definition of Done is met for the non-AI track AND CI is green.

## Scope

**In scope:**
- D1 — GitHub Actions CI workflow (P1, prerequisite for C1).
- A1 — Port deterministic risk engine from base-44 to `lib/risk/`.
- A2 — Supplement catalog migration + seed + recommender.
- B1 — Branded PDF report (replace skeleton).
- C1 — pgTAP RLS suite into CI (closes BUG-008).
- E1 — Admin CRM dashboard (`/admin` page).

**Out of scope:**
- Any LLM/agent change (Atlas, Sage, Janet, Nova).
- Any P2 item from the priority map (lab UI, simulator, alerts, ToS clause, erasure, pause, deceased, cost dashboards, DR drill, corporate, marketplace, clinician portal).
- B2/B3/C2 (P1 polish — defer to next wave).

## Data model changes

| Object | Type | Decision | Writer |
|---|---|---|---|
| `public.supplement_catalog` (new) | typed table | curated catalog of evidence-tagged supplements | seed file + admin only |
| `risk_scores.engine_output` | existing JSONB | already present; will now be populated by deterministic engine | `submitAssessment()` server action |
| `risk_scores.confidence_level` | existing text | already present; values upgraded from `moderate` to `high`/`moderate`/`low`/`insufficient` based on data completeness | same as above |
| `risk_scores.cv_risk` etc | existing numeric | already present; populated deterministically | same |

No PII implications. No new JSONB on `health_profiles`. No new tables outside `supplement_catalog`.

**Migration numbering:**
- `0021_supplement_catalog.sql` — new catalog table + RLS.

**Supplement catalog table shape:**
```sql
create table public.supplement_catalog (
  id              uuid primary key default gen_random_uuid(),
  sku             text unique not null,
  display_name    text not null,
  canonical_dose  text not null,
  timing_default  text,
  evidence_tag    text not null check (evidence_tag in ('A','B','C')),
  domain          text not null check (domain in ('cardiovascular','metabolic','neurodegenerative','oncological','musculoskeletal','general')),
  triggers_when   jsonb not null default '{}',
  contraindicates jsonb not null default '[]',
  cost_aud_month  numeric(6,2),
  supplier_sku_au text,
  notes           text,
  created_at      timestamptz not null default now()
);
alter table public.supplement_catalog enable row level security;
create policy "catalog_read_authenticated" on public.supplement_catalog
  for select using (auth.role() = 'authenticated');
-- Service-role-only writes (admin client + seed file only).
```

## Tasks

Tasks listed in dispatch order. **D1, A1, A2, B1, E1 can run in parallel** (no shared files, no migration ordering between them). **C1 sequential after D1** (needs the CI workflow file to extend). The coordinator dispatches D1 first; once D1 is done, dispatches the other four in parallel; C1 runs after.

---

### Task D1 — GitHub Actions CI workflow

**Files affected:**
- `.github/workflows/ci.yml` (new)

**What to build:**
A single workflow file that runs on every PR and every push to `main`. Jobs:
1. **typecheck** — checkout, install pnpm, install deps, run `pnpm exec tsc --noEmit`.
2. **lint** — same setup, run `pnpm exec eslint .` if eslint config exists; otherwise skip with a note.
3. **test** — same setup, run `pnpm test` (Vitest).
4. **build** — same setup, run `pnpm build`.
5. **pgtap** — see Task C1; this task creates a placeholder job that always passes, then C1 fills it in.

Use `pnpm/action-setup@v4` and `actions/setup-node@v4`. Cache `~/.pnpm-store` via `actions/cache@v4`.

Job dependencies: typecheck and lint can run in parallel; build depends on typecheck; test runs in parallel with build.

**Acceptance criteria:**
- Workflow file present at `.github/workflows/ci.yml`.
- All four jobs (typecheck, test, build, plus the pgtap placeholder) defined.
- Workflow triggers `pull_request` and `push: branches: [main]`.
- The `pgtap` job is a placeholder that runs `echo "pgTAP wired up in C1"` and exits 0 — to be replaced by C1.
- A locally-equivalent dry run via `act` is **not required**; a syntactic YAML check is sufficient.

**Rules to apply:**
- `.claude/rules/security.md` — no secrets in YAML; rely on GitHub repo secrets when needed.
- `.claude/rules/database.md` — none directly.

---

### Task A1 — Port deterministic risk engine

**Files affected:**
- `lib/risk/types.ts` (new)
- `lib/risk/cardiovascular.ts` (new)
- `lib/risk/metabolic.ts` (new)
- `lib/risk/neurodegenerative.ts` (new)
- `lib/risk/oncological.ts` (new)
- `lib/risk/musculoskeletal.ts` (new)
- `lib/risk/biological-age.ts` (new)
- `lib/risk/scorer.ts` (new — orchestrator)
- `lib/risk/assemble.ts` (new — pulls patient input shape from `health_profiles.responses`, `biomarkers.lab_results`, `biomarkers.daily_logs`)
- `app/(app)/onboarding/actions.ts` (modify — call scorer before Atlas dispatch)
- `tests/unit/risk/cardiovascular.test.ts` (new)
- `tests/unit/risk/metabolic.test.ts` (new)
- `tests/unit/risk/neurodegenerative.test.ts` (new)
- `tests/unit/risk/oncological.test.ts` (new)
- `tests/unit/risk/musculoskeletal.test.ts` (new)
- `tests/unit/risk/biological-age.test.ts` (new)
- `tests/unit/risk/scorer.test.ts` (new — snapshot tests across 5 fixture profiles)
- `tests/fixtures/risk-profiles.ts` (new)

**What to build:**

Reference: `/Users/jlm/code-projects/base-44-longevity-coach/base44/functions/riskEngine/entry.ts` — port the **pure-function** scorers verbatim (with TypeScript types), drop the `Deno.serve` handler and the `assemblePatientDataFromDB` (which uses base44 SDK). Replace those with a Next.js-side assembler that reads from our Supabase tables.

Five domain scorers:
- `scoreCardiovascular(patient): DomainResult` (lines 44–227 of base-44 entry.ts).
- `scoreMetabolic(patient): DomainResult` (lines 229–407).
- `scoreNeurodegenerative(patient): DomainResult` (lines 409–561).
- `scoreOncological(patient): DomainResult` (lines 563–712).
- `scoreMusculoskeletal(patient): DomainResult` (lines 714–841).

Helpers:
- `getRiskLevel(score)` — verbatim.
- `computeDomainResult(domain, factors, totalExpectedFactors)` — verbatim.
- `getTopModifiableRisks(domains, n)` — verbatim.
- `getOverallCompleteness(domains)` — verbatim.
- `getScoreConfidence(domains)` — verbatim — produces `{ level: 'high'|'moderate'|'low'|'insufficient', note: string }`.
- `getNextRecommendedTest(domains)` — verbatim.
- `estimateBiologicalAge(patient, domains)` — verbatim (lines 887–982).
- `getCurrentCompositeRisk(domains, weights)` — verbatim.
- `projectTrajectory(patient, domains, weights)` — verbatim.
- `adjustWeightsForHighRisk(defaultWeights, scores)` — present in base-44; copy verbatim.

Orchestrator at `lib/risk/scorer.ts`:
```ts
export type EngineOutput = {
  longevity_score: number;
  longevity_label: 'Optimal' | 'Good' | 'Needs Attention' | 'Concerning' | 'Critical';
  composite_risk: number;
  biological_age: number;
  chronological_age: number | null;
  age_delta: number | null;
  risk_level: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';
  trajectory_6month: TrajectoryResult;
  domains: { cardiovascular: DomainResult; metabolic: DomainResult; neurodegenerative: DomainResult; oncological: DomainResult; musculoskeletal: DomainResult };
  domain_weights: Record<string, number>;
  top_risks: ModifiableRisk[];
  data_completeness: number;
  score_confidence: { level: 'high' | 'moderate' | 'low' | 'insufficient'; note: string };
  last_calculated: string;
  next_recommended_tests: string;
};

export function scoreRisk(patient: PatientInput): EngineOutput;
```

Assembler at `lib/risk/assemble.ts`:
```ts
export async function assemblePatientFromDB(
  supabase: SupabaseClient,
  userId: string,
): Promise<PatientInput>;
```
- Reads `profiles` (DOB → age, sex_at_birth, height_cm, weight_kg).
- Reads latest `health_profiles.responses` (medical_history, lifestyle, family_history including new `cancer_history` shape).
- Reads `biomarkers.lab_results` (groups by biomarker_code into `blood_panel`).
- Reads last 7 days of `biomarkers.daily_logs` (mood, sleep_hours, energy_level, steps, hrv).
- Returns a `PatientInput` matching the base-44 expected shape.

**Adapt** the family-history mapper to read the new `cancer_history` field structure (Y/N status + entries with type/relatives/onsetAge), translating to the base-44 `family_history.cancer = { first_degree, age_onset, types[] }` shape.

Wire-in at `app/(app)/onboarding/actions.ts::submitAssessment()`:
- After `pii-split.ts` writes, call `assemblePatientFromDB` then `scoreRisk`.
- **Use the admin client (`createAdminClient()`) for the `risk_scores` upsert.** Per `data-management.md` Rule 4, `risk_scores` is service-role-write-only; per `security.md`, the admin client is permitted "Risk engine writes to `risk_scores`". Existing `submitAssessment()` already uses the user-context client for `health_profiles` and `profiles` updates — keep those, and only the `risk_scores` upsert switches to admin.
- Upsert columns: `engine_output = JSON.stringify(output)`, all five domain values, `biological_age`, `confidence_level = output.score_confidence.level`, `data_completeness`, `next_recommended_tests`, `top_risk_drivers`, `top_protective_levers`, `assessment_date = today UTC`.
- The Atlas pipeline call already lives downstream; after this change Atlas reads from `risk_scores.engine_output` instead of computing from raw responses. **Hand-off contract for the AI track:** `lib/risk/index.ts` exports `scoreRisk`, `assemblePatientFromDB`, and the `EngineOutput` type. Atlas pipeline (out of scope here) will adopt these on its own schedule.

**Tests required:**

Five fixture profiles in `tests/fixtures/risk-profiles.ts`:
1. `pristine` — 30yo, low risk on every dimension (ApoB 65, hsCRP 0.3, HDL 70, fasting glucose 4.5, full sleep, full exercise).
2. `high-cv` — 55yo male, ApoB 145, Lp(a) 90, LDL 165, HDL 35, family history cardiovascular first-degree.
3. `metabolic-syndrome` — 48yo, BMI 32, HbA1c 6.0, HOMA-IR 3.2, fasting insulin 18.
4. `low-data` — only DOB and sex provided; rest empty. Expect `confidence_level='insufficient'`.
5. `pristine-with-wearable` — same as 1 but with vo2max 52, hrv 70 → biological age expected ~5 years younger than chronological.

Per-domain tests (one file per scorer): each tests a "happy path", an "extreme case", and a "missing data case" against the fixtures. ≥ 3 cases per domain × 5 domains = 15 minimum.

Bio-age tests (1 file): age modifiers, missing data, sex-specific testosterone path. ≥ 3 cases.

Scorer snapshot test (`scorer.test.ts`): runs `scoreRisk` against each of the 5 fixtures and snapshots `JSON.stringify(output, null, 2)`. Future refactors fail loudly. ≥ 5 cases.

**Acceptance criteria:**
- `lib/risk/` directory contains all files listed above.
- `pnpm test` passes with ≥ 23 risk-related tests.
- Snapshot tests stable across two consecutive runs.
- A new `submitAssessment()` call writes a `risk_scores` row with `engine_output` populated and `confidence_level` reflecting actual data completeness (not hardcoded `'moderate'`).
- The orchestrator function and types are exported from `lib/risk/index.ts` for consumption by Atlas pipeline (handed off to AI track).
- No DB calls inside the scorers — they remain pure.
- Family-history adapter correctly translates the new `cancer_history` value shape into the base-44 `family_history.cancer` shape.

**Rules to apply:**
- `.claude/rules/data-management.md` — no PII inside the engine; takes a de-identified `PatientInput`.
- `.claude/rules/ai-agents.md` — pipeline writer model; `risk_scores` is service-role-write but for now the scorer runs inside `submitAssessment()` (a server action) with the user-context client. RLS on `risk_scores` allows owner-write; verify.

---

### Task A2 — Deterministic supplement catalog

**Files affected:**
- `supabase/migrations/0021_supplement_catalog.sql` (new)
- `supabase/seeds/supplement_catalog.sql` (new)
- `lib/supplements/catalog.ts` (new)
- `lib/supabase/database.types.ts` (regenerate after migration)
- `tests/unit/supplements/catalog.test.ts` (new)
- `tests/fixtures/supplement-engine-outputs.ts` (new)

**What to build:**

Migration `0021_supplement_catalog.sql` — exact SQL from the Data Model section above.

Seed file `supabase/seeds/supplement_catalog.sql` — ~40 evidence-tagged items. Cover at least:
- **Cardiovascular:** omega-3 (EPA/DHA), CoQ10, niacin (B3), vitamin K2, garlic extract.
- **Metabolic:** berberine, alpha-lipoic acid, chromium, magnesium glycinate, inositol.
- **Neurodegenerative:** lion's mane, omega-3 (overlap OK), curcumin, B-complex, citicoline, creatine.
- **Oncological:** sulforaphane (broccoli sprouts), vitamin D3, selenium, green-tea extract.
- **Musculoskeletal:** vitamin D3, vitamin K2 (overlap), calcium citrate, collagen peptides, magnesium glycinate (overlap).
- **General longevity:** NAC, glycine, glutathione, taurine, ashwagandha, rhodiola, melatonin, fisetin.

Each item: SKU (e.g. `OMEGA3-2G`), display_name, canonical_dose, timing_default, evidence_tag, domain, triggers_when (JSON predicate), contraindicates (list of medication SKUs or class names), cost_aud_month, notes.

Example trigger predicates:
- omega-3 EPA/DHA → `{"apoB_gt": 100}` OR `{"triglycerides_gt": 150}` OR `{"hsCRP_gt": 1.0}`
- berberine → `{"hba1c_gt": 5.7}` OR `{"fasting_glucose_gt": 5.5}`
- vitamin D3 → `{"vitamin_d_lt": 75}` OR `{"musculoskeletal_score_gt": 50}`

Helper `lib/supplements/catalog.ts`:
```ts
export type SupplementCatalogItem = {
  sku: string;
  display_name: string;
  canonical_dose: string;
  timing_default: string | null;
  evidence_tag: 'A' | 'B' | 'C';
  domain: 'cardiovascular' | 'metabolic' | 'neurodegenerative' | 'oncological' | 'musculoskeletal' | 'general';
  triggers_when: Record<string, number>;
  contraindicates: string[];
  notes: string | null;
};

// Pure function: given engine output + member medication list, returns ranked
// supplement recommendations. No DB calls; catalog is loaded by the caller.
export function recommendFromRisk(
  engineOutput: EngineOutput,
  catalog: SupplementCatalogItem[],
  memberMedications: string[] = [],
): SupplementCatalogItem[];
```

Logic:
1. Walk every catalog item.
2. Test each `triggers_when` predicate against `engineOutput`. Predicate-key resolver:

   | Predicate key | Resolves to |
   |---|---|
   | `apoB_gt`, `apoB_lt` | factor `apoB` raw_value across all domains |
   | `lp_a_gt` | factor `lp_a` raw_value |
   | `ldl_gt`, `ldl_lt` | factor `ldl` raw_value |
   | `hdl_lt` | factor `hdl` raw_value |
   | `triglycerides_gt` | factor `triglycerides` raw_value |
   | `hba1c_gt`, `hba1c_lt` | factor `hba1c` raw_value |
   | `homa_ir_gt` | factor `HOMA_IR` raw_value |
   | `fasting_glucose_gt` | factor `fasting_glucose` raw_value |
   | `fasting_insulin_gt` | factor `fasting_insulin` raw_value |
   | `hsCRP_gt` | factor `hsCRP` raw_value |
   | `homocysteine_gt` | factor `homocysteine` raw_value |
   | `vitamin_d_lt` | factor `vitamin_d` raw_value |
   | `omega3_index_lt` | factor `omega3_index` raw_value |
   | `vo2max_lt` | factor `vo2max` raw_value |
   | `bmi_gt` | derived: `weight_kg / (height_m^2)` from PatientInput |
   | `cv_score_gt` | `engineOutput.domains.cardiovascular.score` |
   | `metabolic_score_gt` | `engineOutput.domains.metabolic.score` |
   | `neuro_score_gt` | `engineOutput.domains.neurodegenerative.score` |
   | `onco_score_gt` | `engineOutput.domains.oncological.score` |
   | `msk_score_gt` | `engineOutput.domains.musculoskeletal.score` |
   | `age_gt`, `age_lt` | `engineOutput.chronological_age` |

   Suffix `_gt` = greater than; `_lt` = less than. Multiple keys in a single `triggers_when` are OR-combined (any match fires the recommendation).

3. Filter out items where any contraindication appears in `memberMedications` (case-insensitive substring match).
4. Rank by: domain weight (from `engineOutput.domain_weights`) × evidence-tag multiplier (A=3, B=2, C=1).
5. Return top 8.

DB loader (separate file, called by the AI track's Sage pipeline):
```ts
// lib/supplements/loader.ts (new)
export async function loadCatalog(supabase: SupabaseClient): Promise<SupplementCatalogItem[]>;
```

**Tests required:**
- 5+ Vitest cases in `catalog.test.ts` against fixture engine outputs.
- One test per fixture: pristine returns ≤ 2 general items; high-cv returns omega-3 + CoQ10 + niacin in top 3; metabolic-syndrome returns berberine + ALA in top 3.
- Contraindication test: high-cv + medication "warfarin" excludes vitamin K2.

**Acceptance criteria:**
- Migration applied locally and table queryable.
- Seed file inserts ≥ 40 distinct SKUs.
- `recommendFromRisk()` deterministic — same input → same output (sort order included).
- Snapshot tests stable.
- Catalog table reflects in `database.types.ts` after `supabase gen types`.

**Rules to apply:**
- `.claude/rules/database.md` — RLS, idempotent migration, types regeneration.
- `.claude/rules/data-management.md` — typed columns over JSONB for queryable fields. The `triggers_when` and `contraindicates` are opaque-shape config and stay JSONB.

---

### Task B1 — Branded PDF report

**Files affected:**
- `lib/pdf/report-doc.tsx` (rewrite)
- `lib/pdf/styles.ts` (new — shared styles)
- `app/api/report/pdf/route.tsx` (modify — pass full data shape)
- `tests/unit/pdf/report-doc.test.tsx` (new — render to buffer + size assertion)

**What to build:**

A2-formatted PDF rendered with `@react-pdf/renderer`. Pages:

1. **Cover** — Logo (top-left), member name, "Health Risk Report", report date, biological age headline ("Bio age: 47 vs chronological 53"), single-line "Confidence: high — based on N data points".
2. **Risk profile** — Five domain rows, each with: domain name, score 0–100, risk level pill (very_low → very_high colour-graded), top 2 modifiable factors (small text). Layout as a vertical card list.
3. **Top modifiable risks** — Numbered list of top 5 modifiable factors across domains, with current score, optimal range, and a one-line "what to do".
4. **Supplement protocol** — Table with columns: name, dose, timing, tier. Up to 12 rows; if more, footnote "+N more in your dashboard".
5. **6-month projection** — Two numbers side-by-side: "Today's longevity score: X" / "Projected (6mo): Y". Below: bullet list of top 5 improvements.
6. **Footer** — Disclaimer ("This report is informational and is not a substitute for medical advice…"), generation timestamp, page numbers.

Logo: pull from `docs/brand/longevity-coach-horizontal-logo.png`. Convert to embedded `<Image>` source via `import` or static base64.

Fonts: Helvetica family is fine (already registered). If time allows, register Inter for body and Fraunces for headings via local TTF.

Colours from `lib/pdf/styles.ts`:
- `palette.primary = '#2F6F8F'` (matches `--lc-primary`).
- `palette.sage = '#6B8E83'`.
- Risk-level palette: `very_low` `#2A7A5C`, `low` `#5B9F86`, `moderate` `#B5722F`, `high` `#B5452F`, `very_high` `#8E2C1A`.

Page size A4, margins 18mm.

**`/api/report/pdf` route changes:**
- Pass the full `engine_output` JSON to `<ReportDocument>` instead of cherry-picking columns.
- Pass profile (full_name, date_of_birth) for the cover header.
- Pass supplement_plans.items for the protocol table.

**Acceptance criteria:**
- PDF renders without errors via `pnpm test` smoke (`renderToBuffer(<ReportDocument data={...} />)` returns a Buffer).
- Output buffer ≥ 30 KB and ≤ 800 KB for the medium fixture.
- Manually downloading from `/api/report/pdf` produces a valid PDF that opens in Preview/Acrobat.
- All six pages present.
- Footer has disclaimer + page numbers.
- Risk-level pills colour-coded correctly per the palette.

**Rules to apply:**
- `.claude/rules/security.md` — service-role admin client only if writing back; this route reads with user context (already does).
- `.claude/rules/nextjs-conventions.md` — route stays under `app/api/`; uses `force-dynamic` (already does).

---

### Task C1 — pgTAP RLS suite into CI

**Files affected:**
- `.github/workflows/ci.yml` (modify — replace D1's placeholder pgtap job)

**What to build:**

The `pgtap` job in `ci.yml` (created as a placeholder by D1):
1. Spins up a Postgres 15 service container with the pgtap extension.
2. Applies all migrations from `supabase/migrations/` in numerical order.
3. Runs `psql -f supabase/tests/rls.sql` against the spun-up DB.
4. Treats any failed pgTAP assertion as a CI failure.

Use the `supabase/postgres:15.6.1.146` image (matches Supabase Cloud).

**Acceptance criteria:**
- The pgtap job runs on every PR.
- A deliberately-broken policy (added in a test commit) fails the job.
- A clean main passes the job.
- BUG-008 marked closed in `docs/product/epic-status.md` (handed off to documentation phase, not done in this task).

**Rules to apply:**
- `.claude/rules/database.md` — RLS regression test discipline.
- `.claude/rules/security.md` — never disable RLS.

---

### Task E1 — Admin CRM dashboard

**Files affected:**
- `app/(admin)/admin/page.tsx` (rewrite — currently a stub)
- `lib/admin/metrics.ts` (new)
- `tests/unit/admin/metrics.test.ts` (new)

**What to build:**

Single-screen admin dashboard at `/admin` (gated by `is_admin` flag, layout already exists at `app/(admin)/layout.tsx`).

**Admin-client exception note:** `nextjs-conventions.md` says "Never import the admin client in a page or server component." The Admin CRM is the documented exception in `security.md` ("Any future clinician-gated data access"). Use the admin client *only* inside `lib/admin/metrics.ts` (server-only via `import "server-only"`); the page imports the metric functions, never the admin client directly. This keeps the rule's spirit (admin client confined to a single server-only module) and gives us auditability.

Six metric tiles:
1. **MRR** — Sum of `subscriptions.unit_amount` × frequency-multiplier where `status IN ('active','trialing','past_due')`. Display as $X,XXX/mo.
2. **Active members** — Count of profiles with at least one active/trialing subscription.
3. **New signups** (date-range) — Count of `profiles.created_at` in range.
4. **Churn** (last 30 days) — Count of subscriptions with `status='canceled'` AND `ended_at > now() - 30 days`.
5. **Pipeline runs (24h)** — Count of `risk_scores.computed_at > now() - 24h`.
6. **Uploads (24h)** — Count of `patient_uploads.created_at > now() - 24h`.

Date-range filter (header, single `<select>`): `7d`, `30d`, `quarter`, `all`.

Server component; reads via admin client (service role) since this aggregates across all members.

`lib/admin/metrics.ts` exports pure async functions per metric, parallelised with `Promise.all` in the page.

Below the tile grid: a recent-signups table (last 10 profiles ordered by created_at desc) with columns: name (linked to `/admin/users/[id]`), email (from auth.users via admin client), signed-up date, subscription status, has assessment.

**Acceptance criteria:**
- `/admin` renders with all six tiles and the recent-signups table.
- Date-range filter works (changes URL search param `?range=30d`).
- All queries run in parallel via `Promise.all`.
- Non-admin user redirected to `/dashboard` (existing layout-level gate).
- Vitest tests for `lib/admin/metrics.ts` covering: empty DB returns zeros; MRR sums correctly across mixed monthly/annual; churn excludes today's cancellations.

**Rules to apply:**
- `.claude/rules/security.md` — admin client usage gated to admin routes only.
- `.claude/rules/data-management.md` — all PII access goes through profiles + auth.users; no PII rendered in the metric tiles themselves.

---

## Build order

```
D1 ────┬───► A1 ────────────► (parallel review)
       ├───► A2 ────────────► (parallel review)
       ├───► B1 ────────────► (parallel review)
       ├───► E1 ────────────► (parallel review)
       └───► C1 (replaces D1's pgtap placeholder)
```

D1 first because it's tiny and other tasks benefit from green CI as they land.
A1, A2, B1, E1 can be dispatched in parallel — disjoint file sets.
C1 sequential after D1 — same workflow file.

## Per-task review gate

For each task: spec-compliance review (does it match acceptance criteria?), then code-quality review (rules satisfied? RLS on new tables? no PII drift? `pnpm build` + `pnpm test` pass?). Both must approve before marking the task complete.

## Definition of done (whole change)

1. All six tasks have ✅ on both spec and code-quality reviews.
2. `pnpm build` clean.
3. `pnpm test` green with ≥ 28 new tests across risk + supplements + pdf + admin.
4. CI green on the change branch.
5. New `risk_scores` rows from a fresh test signup show `confidence_level` reflecting real data.
6. PDF download from `/api/report/pdf` produces a multi-page branded document.
7. `/admin` shows non-zero numbers in production data.
8. CHANGELOG.md, EXECUTIVE_SUMMARY.md, QA_REPORT.md present in the change folder.
9. Epic status doc updated: Epic 3 50→80, Epic 4 50→75, Epic 5 35→75, Epic 11 55→70 (BUG-008 closed), Epic 12 5→25 (admin CRM partial), Epic 14 40→55 (CI).
