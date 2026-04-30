# Plan: Evidence Base — Clinical Standards Table, Knowledge Seed, RAG Wiring
Date: 2026-04-28
Phase: Phase 2 (Intelligence)
Status: Draft

## Objective

The Atlas (risk scoring) and Sage (supplement protocol) AI agents currently operate entirely
on LLM parametric knowledge — no clinical guidelines are referenced in their system prompts,
there is no structured standards table, the `health_knowledge` table is empty, and
`retrieveKnowledge()` is never called by any agent.

This change fixes all four layers:

1. **`risk_assessment_standards` table** — a structured, queryable DB table storing the exact
   clinical frameworks, thresholds, score mappings, and source citations for each of the five
   risk domains. Atlas queries this table at runtime before generating scores. Sage queries the
   supplement evidence subset. Clinicians and the product team can update standards without
   redeploying code.

2. **System prompts** — updated to reference the standards table and the key framework names,
   keeping prompts focused while the structured data carries the thresholds.

3. **Knowledge seed** — `health_knowledge` populated with ~65 evidence-grounded passages for
   BM25 retrieval by all agents (BM25 works immediately; vector search activates once pgvector
   is enabled and embeddings are generated).

4. **RAG infrastructure fix** — the current `hybrid_search_health` SQL function requires a
   mandatory `query_vec` that `rag.ts` never provides; fix to accept NULL (BM25-only fallback);
   wire `retrieveKnowledge()` into Janet, Atlas, and Sage.

Done looks like: every risk score produced by Atlas maps to a row in `risk_assessment_standards`;
every supplement recommended by Sage carries an evidence level from the standards table;
Janet surfaces relevant knowledge chunks; `pnpm build` and `pnpm test` pass.

## Scope

In scope:
- Migration 0020: `risk_assessment_standards` table + seed with clinical frameworks + indexes + RLS
- Migration 0021: replace `hybrid_search_health` with NULL-safe PL/pgSQL (BM25 fallback)
- Migration 0022: UPDATE `agent_definitions` — Atlas system prompt referencing standards table
- Migration 0023: UPDATE `agent_definitions` — Sage system prompt with NIH ODS evidence base
- Migration 0024: INSERT ~65 knowledge chunks into `health_knowledge`
- `lib/ai/rag.ts` — fix call signature; graceful BM25 fallback when embedding unavailable
- `lib/ai/patient-context.ts` — wire `retrieveKnowledge()` into `loadPatientContext()` Promise.all
- `lib/ai/pipelines/risk-narrative.ts` — load relevant standards rows + inject into `buildPrompt()`
- `lib/ai/pipelines/supplement-protocol.ts` — load relevant standards rows + inject into `buildPrompt()`
- Tests for `rag.ts` (4 new unit tests)
- Regenerate `lib/supabase/database.types.ts`

Out of scope:
- Generating real vector embeddings (requires OpenRouter key; deferred to Nova)
- Nova pipeline implementation (Phase 4)
- MCP tool injection
- Any UI changes

## Data model changes

### New table: `risk_assessment_standards`

Not PII. Generic clinical reference data. Writer: service_role only (migrations + future admin UI).
Readers: service_role (Atlas, Sage pipelines) + admin role.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `domain` | text NOT NULL | CHECK: cv, metabolic, neuro, onco, msk, supplement, drug_interaction |
| `framework_name` | text NOT NULL | e.g. "2023 AusCVD Risk Calculator" |
| `source_citation` | text NOT NULL | Publication name + year |
| `source_url` | text | DOI or canonical URL |
| `evidence_level` | text NOT NULL | CHECK: I, II, III, IV |
| `risk_tier` | text NOT NULL | CHECK: low, moderate, high, very_high, not_applicable |
| `internal_score_min` | integer | Our 0–100 score lower bound for this tier |
| `internal_score_max` | integer | Our 0–100 score upper bound for this tier |
| `clinical_threshold` | text | Human-readable threshold, e.g. "< 5% 5-year CVD risk" |
| `key_risk_factors` | jsonb | Array of strings: factors that drive score into this tier |
| `protective_factors` | jsonb | Array of strings: factors that keep score below this tier |
| `clinical_guidance` | text | What to recommend at this tier |
| `applicable_age_min` | integer | Minimum age (NULL = all ages) |
| `applicable_age_max` | integer | Maximum age (NULL = all ages) |
| `applicable_sex` | text | CHECK: male, female, all |
| `notes` | text | Additional nuance |
| `active` | boolean NOT NULL DEFAULT true | Soft-delete / version management |
| `created_at` | timestamptz NOT NULL | |
| `updated_at` | timestamptz NOT NULL | |

RLS: service_role all; admin select. No patient write access.
Trigger: `set_updated_at` on UPDATE.

## Tasks

---

### Task 1 — Create risk_assessment_standards table + seed clinical frameworks

**Files affected:**
- `supabase/migrations/0020_risk_assessment_standards.sql` (new)
- `lib/supabase/database.types.ts` (regenerate after migration — subagent runs `supabase gen types`)

**What to build:**

Create the table as defined in the data model section above. Then INSERT seed rows for all
five domains. Write complete, accurate data — every row will be read at runtime by Atlas and Sage.

Seed at minimum these rows (subagent writes accurate clinical content for each):

**CV domain — 2023 Australian CVD Risk Guideline (Heart Foundation / RACGP):**
- low tier: < 5% 5-year absolute CVD risk → internal score 0–25
- moderate tier: 5–< 10% 5-year absolute CVD risk → internal score 26–55
- high tier: ≥ 10% 5-year absolute CVD risk → internal score 56–100
- very_high tier: Known CVD (prior MI, stroke, PCI/CABG) or diabetes + end-organ damage → 81–100
  Key factors: smoking, total chol > 7.5, SBP > 160, diabetes, AF, age, social disadvantage index,
  First Nations status, family history premature CVD
  Guidance per tier from the 2023 guideline treatment thresholds

**Metabolic domain — AUSDRISK (Dept of Health) + WHO/ADA diagnostic criteria:**
- low: AUSDRISK ≤ 5 (1/100 5-yr T2DM risk), HbA1c < 42 mmol/mol → score 0–20
- moderate: AUSDRISK 6–11, HbA1c 42–47 → score 21–45
- high: AUSDRISK ≥ 12, HbA1c 48–52 (borderline), HOMA-IR ≥ 2.9 → score 46–70
- very_high: T2DM diagnosis, HbA1c ≥ 53, fasting glucose ≥ 7.0 → score 71–100
  Key factors: age, ethnicity, waist circumference, physical inactivity, family history T2DM,
  prior high blood glucose, antihypertensive medication use

**Neuro domain — 2024 Lancet Commission on Dementia Prevention (Livingston et al.):**
- low: 0–2 modifiable risk factors present → score 0–20
- moderate: 3–5 modifiable risk factors → score 21–50
- high: 6–8 modifiable risk factors → score 51–75
- very_high: ≥ 9 modifiable factors OR known cognitive impairment → score 76–100
  14 factors: low education, hearing loss, hypertension, smoking, obesity, depression,
  physical inactivity, diabetes, excessive alcohol, TBI, social isolation,
  air pollution, vision loss, high LDL (new 2024)
  PAR note: hearing loss 8.2% is largest single midlife factor

**Onco domain — IARC/WHO World Cancer Report 2024 + Cancer Council Australia:**
- low: Non-smoker, healthy BMI, alcohol < 7 std/week, active, sun-safe → score 0–20
- moderate: Ex-smoker (quit > 5y) OR overweight OR moderate alcohol → score 21–45
- high: Current smoker OR obese OR heavy alcohol OR strong family history → score 46–75
- very_high: Current smoker + obese + heavy alcohol OR confirmed high-risk genetic variant → 76–100
  Key factors: tobacco (PAF 15%), excess body weight, alcohol, physical inactivity,
  UV radiation, processed meat, low fibre diet
  Screening: bowel 50–74 (NBCSP), breast 50–74 (BreastScreen), cervical 25–74 (NCSP)

**MSK domain — 2024 RACGP / Healthy Bones Australia Osteoporosis Guideline + FRAX:**
- low: FRAX MOF < 10% 10-year → score 0–25
- moderate: FRAX MOF 10–20% → score 26–55; recommend DXA referral
- high: FRAX MOF 20–30% or hip 3–4.5% → score 56–80; consider pharmacotherapy
- very_high: FRAX MOF ≥ 30% or hip ≥ 4.5% → score 81–100; treat
  Key factors: age, female sex, low BMI (< 19), prior fragility fracture, parental hip fracture,
  corticosteroids > 5 mg/day > 3 months, rheumatoid arthritis, secondary osteoporosis,
  alcohol ≥ 3 units/day, current smoking

**Supplement domain — NIH ODS evidence base (for Sage):**
- Insert one row per major supplement class with evidence level, dosing guidance, and drug interactions
- Minimum: Vitamin D, Omega-3, Magnesium, B12, CoQ10, Iron, Zinc, Curcumin, Vitamin K2, NAD+ precursors

**Drug-interaction domain (for Sage):**
- Insert rows for critical interactions:
  - Anticoagulants + fish oil/Vit E/CoQ10/Ginkgo
  - Thyroid meds + iron/calcium/magnesium (timing)
  - SSRIs + St John's Wort (contraindicated)
  - Oral contraceptives + St John's Wort (CYP3A4)
  - Statins + CoQ10 (supportive, not contraindicated)

**Regenerate TypeScript types after migration:**
```bash
supabase gen types typescript --local > lib/supabase/database.types.ts
```

**Acceptance criteria:**
- [ ] `supabase db push` applies 0020 cleanly
- [ ] `SELECT COUNT(*) FROM risk_assessment_standards` ≥ 25 rows
- [ ] All five domains have rows in all four tiers
- [ ] `lib/supabase/database.types.ts` includes `risk_assessment_standards` type
- [ ] `pnpm build` passes; `pnpm test` passes (no new tests required for this task — data-only)

**Rules to apply:** `.claude/rules/database.md`, `.claude/rules/data-management.md`

---

### Task 2 — Fix hybrid_search_health and rag.ts

**Files affected:**
- `supabase/migrations/0021_fix_hybrid_search_bm25_fallback.sql` (new)
- `lib/ai/rag.ts` (modify)
- `tests/unit/ai/rag.test.ts` (new)

**What to build:**

**Migration 0021** — Replace `hybrid_search_health` with a PL/pgSQL version where
`query_vec vector(2560) DEFAULT NULL`. NULL → pure BM25. Non-null → hybrid RRF as before.

```sql
create or replace function public.hybrid_search_health(
  query_text  text,
  query_vec   vector(2560) DEFAULT NULL,
  match_count int          DEFAULT 5,
  sem_weight  float        DEFAULT 1.0,
  kw_weight   float        DEFAULT 1.0
)
returns table (id uuid, content text, metadata jsonb, score float)
language plpgsql
security definer
set search_path = public
as $$
begin
  if query_vec is null then
    return query
      select hk.id, hk.content, hk.metadata,
             ts_rank_cd(hk.fts, plainto_tsquery(query_text))::float as score
      from public.health_knowledge hk
      where hk.fts @@ plainto_tsquery(query_text)
      order by score desc
      limit match_count;
  else
    return query
      with semantic as (
        select hk.id,
               row_number() over (order by hk.embedding <=> query_vec) as rank
        from public.health_knowledge hk
        where hk.embedding is not null
        limit match_count * 2
      ),
      keyword as (
        select hk.id,
               row_number() over (
                 order by ts_rank_cd(hk.fts, plainto_tsquery(query_text)) desc
               ) as rank
        from public.health_knowledge hk
        where hk.fts @@ plainto_tsquery(query_text)
        limit match_count * 2
      ),
      fused as (
        select coalesce(s.id, k.id) as id,
               (coalesce(sem_weight / (60.0 + s.rank), 0.0) +
                coalesce(kw_weight  / (60.0 + k.rank), 0.0)) as score
        from semantic s full outer join keyword k on s.id = k.id
      )
      select hk.id, hk.content, hk.metadata, f.score
      from fused f join public.health_knowledge hk on hk.id = f.id
      order by f.score desc
      limit match_count;
  end if;
end;
$$;
```

**`lib/ai/rag.ts`** — Fix `retrieveKnowledge()`:
1. Try `embedText([query])`, catch all errors silently
2. Pass `query_vec: queryVec ?? null` to RPC

**`tests/unit/ai/rag.test.ts`** — 4 tests:
- Returns content array from RPC data
- Returns empty array when RPC returns null/empty
- Passes `query_vec: null` when embedText throws
- Passes `query_vec` array when embedText succeeds

**Acceptance criteria:**
- [ ] `hybrid_search_health` signature has `query_vec DEFAULT NULL`
- [ ] Calling with only `query_text` returns BM25 results (no error)
- [ ] `rag.ts` passes `query_vec: null` when embedding fails
- [ ] 4 new unit tests pass; `pnpm build` + `pnpm test` pass

---

### Task 3 — Update Atlas system prompt to reference standards table

**Files affected:**
- `supabase/migrations/0022_atlas_evidence_anchored_prompt.sql` (new)
- `lib/ai/pipelines/risk-narrative.ts` (modify — load standards at runtime)

**What to build:**

**Migration 0022** — UPDATE Atlas system_prompt. The new prompt must:
- Name each framework (AusCVD 2023, AUSDRISK, Lancet Commission 2024, IARC/WHO, RACGP/HBA FRAX 2024)
- State that clinical standards will be injected into the prompt context at runtime
- Include the 5-tier scoring rubric (0–25 very low, 26–45 low-moderate, 46–65 moderate,
  66–80 elevated, 81–100 high) anchored to the framework thresholds
- State confidence level criteria (high/moderate/low/insufficient)
- Mandate data_gaps listing when key scoring inputs are absent
- Keep JSON-output instruction

**`lib/ai/pipelines/risk-narrative.ts`** — In `runRiskNarrativePipeline()`, after the
existing `Promise.all`, query `risk_assessment_standards` for all active rows grouped by
domain. Format them as a structured context block and pass to `buildPrompt()` as a new
`standards` parameter.

```typescript
// Load all active standards
const { data: standards } = await admin
  .from('risk_assessment_standards')
  .select('domain, framework_name, risk_tier, clinical_threshold, key_risk_factors, clinical_guidance, source_citation')
  .eq('active', true)
  .in('domain', ['cv', 'metabolic', 'neuro', 'onco', 'msk'])
  .order('domain')
  .order('internal_score_min');

// In buildPrompt(), add section:
// ## Clinical scoring standards (loaded from risk_assessment_standards)
// [formatted standards by domain]
```

The standards query must NOT be inside the existing `Promise.all` (it is a single fast
read, sequential is acceptable). Wrap in try/catch — empty array fallback if query fails.

**Acceptance criteria:**
- [ ] Atlas system_prompt contains "AusCVD", "AUSDRISK", "Lancet Commission", "FRAX"
- [ ] `runRiskNarrativePipeline()` queries `risk_assessment_standards` and includes result in prompt
- [ ] `buildPrompt()` signature updated to accept optional `standards` param
- [ ] Existing integration tests pass (mock may need updating to expect new prompt structure)
- [ ] `pnpm build` + `pnpm test` pass

---

### Task 4 — Update Sage system prompt with NIH ODS evidence base

**Files affected:**
- `supabase/migrations/0023_sage_evidence_anchored_prompt.sql` (new)
- `lib/ai/pipelines/supplement-protocol.ts` (modify — load supplement + drug_interaction standards)

**What to build:**

**Migration 0023** — UPDATE Sage system_prompt. The new prompt must:
- Reference NIH ODS as primary evidence source
- State that supplement evidence standards will be injected at runtime from the standards table
- Include evidence tier definitions (Level I–IV)
- Include mandatory drug-supplement interaction flag rules:
  - Anticoagulants: fish oil > 3 g, Vit E > 400 IU, CoQ10, Ginkgo → flag bleeding risk
  - Thyroid meds: iron/calcium/magnesium → must be 2h apart, always flag
  - SSRIs/SNRIs: St John's Wort → contraindicated, do not recommend
  - OCP/HRT: St John's Wort → contraindicated (CYP3A4)
  - If medications not disclosed: `interactions_checked: false`
- State critical biomarker thresholds that trigger medical attention flag:
  Vit D < 25 nmol/L, ferritin < 10 µg/L, B12 < 100 pmol/L

**`lib/ai/pipelines/supplement-protocol.ts`** — After the existing `Promise.all`, query
`risk_assessment_standards` for domains 'supplement' and 'drug_interaction' rows. Format
and inject as `## Supplement evidence reference` and `## Drug-supplement interactions` in
`buildPrompt()`.

**Acceptance criteria:**
- [ ] Sage system_prompt contains "NIH ODS", "interactions_checked", "evidence_level"
- [ ] `runSupplementProtocolPipeline()` queries supplement/drug_interaction standards rows
- [ ] `pnpm build` + `pnpm test` pass

---

### Task 5 — Seed health_knowledge with ~65 clinical reference passages

**Files affected:**
- `supabase/migrations/0024_health_knowledge_seed.sql` (new)

**What to build:**

Insert ~65 knowledge chunks. Each has content (2–6 sentences), NULL embedding, and metadata
JSONB with keys: `source`, `category`, `evidence_level`, `published_at`.

**Required categories and chunk counts:**

- `cv` (10 chunks): AusCVD 5-yr thresholds, lipid targets by risk tier (LDL < 1.8 for high-risk),
  BP targets (< 130/80 in high-risk/diabetes), smoking cessation CV benefit, HDL/LDL mechanism,
  hs-CRP as independent predictor, homocysteine and CV risk, Lp(a) genetically determined risk,
  AF and stroke risk (CHA2DS2-VASc), omega-3 and TG lowering evidence (REDUCE-IT)

- `metabolic` (10 chunks): AUSDRISK score table, HbA1c diagnostic thresholds (WHO 2011),
  HOMA-IR insulin resistance thresholds, metabolic syndrome IDF criteria,
  T2DM prevention lifestyle (DPP trial: 58% risk reduction with 7% weight loss + 150 min/week),
  fasting vs 2-hour OGTT significance, visceral adiposity and metabolic risk,
  sleep deprivation and glucose metabolism, alcohol and metabolic syndrome, uric acid and gout/T2DM

- `neuro` (10 chunks): 2024 Lancet Commission 14 modifiable factors (45% attributable),
  hearing loss as largest single midlife factor (8.2% PAR), hypertension in midlife doubles
  dementia risk, physical inactivity and dementia risk (150 min/week threshold),
  depression bidirectional risk, sleep and glymphatic amyloid clearance,
  social isolation late-life (5% PAR), Mediterranean diet and cognitive protection (MIND study),
  TBI history and long-term dementia risk, LDL > 3.0 mmol/L and vascular dementia risk

- `onco` (10 chunks): WHO 2026 40% preventable cancers, tobacco 15% global cancer PAF,
  obesity and 13 cancer types (IARC), alcohol — no safe level for cancer risk (WHO 2023),
  physical inactivity and colon/breast/endometrial cancer, UV radiation and skin cancer
  (SunSmart SPF 50+ recommendation), NBCSP bowel screening 50–74 (two-yearly),
  BreastScreen Australia 50–74 (two-yearly), NCSP cervical 25–74 (every 5 years),
  processed meat IARC Group 1 carcinogen (colorectal cancer)

- `msk` (10 chunks): FRAX MOF threshold table (10/20/30%), 2024 RACGP osteoporosis key
  risk factors, calcium 1000–1300 mg/day (diet-first), vitamin D bone health (target > 50 nmol/L),
  weight-bearing exercise and bone density, falls prevention (strength + balance training),
  sarcopenia — muscle mass loss after 30y (1–2%/decade), BMI and knee OA risk (BMI > 27.5 → 4x),
  RA and systemic inflammation, glucosamine/chondroitin Level II evidence knee OA

- `supplements` (10 chunks): Vitamin D deficiency thresholds + replacement dosing (NIH ODS),
  omega-3 REDUCE-IT summary (icosapentaenoic acid 4 g/day, 25% MACE reduction),
  magnesium forms and bioavailability (glycinate > oxide), B12 methylcobalamin vs cyanocobalamin,
  CoQ10 and statin myopathy (Q-SYMBIO trial, 100–300 mg/day ubiquinol),
  iron deficiency management (ferrous bisglycinate + Vit C; separate from thyroid meds),
  zinc and immune/testosterone (RDI 8–11 mg/day; UL 40 mg/day),
  curcumin bioavailability and piperine (20x absorption with 5 mg piperine),
  Vitamin K2 (MK-7) and bone + vascular health, NAD+ precursors (NMN/NR emerging Level III evidence)

- `drug_interactions` (5 chunks): anticoagulant + fish oil/Vit E/CoQ10 bleeding risk,
  thyroid medication timing with minerals (2h separation),
  St John's Wort CYP3A4 induction (OCP, SSRIs, statins, warfarin),
  calcium and iron absorption competition (take 2h apart),
  vitamin E > 400 IU antiplatelet effect (avoid in pre-op, anticoagulated patients)

**Acceptance criteria:**
- [ ] `SELECT COUNT(*) FROM health_knowledge` ≥ 60
- [ ] All 7 categories have rows
- [ ] All rows have non-null `content` and `fts` (auto-generated)
- [ ] `pnpm build` passes

---

### Task 6 — Wire RAG into Janet, Atlas, Sage

**Files affected:**
- `lib/ai/patient-context.ts` (modify)
- (Atlas and Sage wiring already covered in Tasks 3 and 4)

**What to build:**

**`lib/ai/patient-context.ts`** — Add `retrieveKnowledge()` call inside the existing
`Promise.all` in `loadPatientContext()`. Use the patient's top risk driver from
existing `riskScores` if available, otherwise "longevity health risk prevention".

The call is the last item in `Promise.all` and wrapped in `.catch(() => [])`.

```typescript
retrieveKnowledge(
  // Build query from available context — falls back gracefully
  'longevity health risk prevention assessment',
  4
).catch((): string[] => []),
```

Assign the result to `knowledgeChunks` in the returned context object.

Note: at the time `loadPatientContext()` runs, we don't yet have the riskScores (they're
being loaded in the same Promise.all). So use a fixed query string for Janet context load.
The Atlas and Sage pipelines pass domain-specific queries directly (handled in Tasks 3+4).

**Acceptance criteria:**
- [ ] `loadPatientContext()` calls `retrieveKnowledge()` in its `Promise.all`
- [ ] `knowledgeChunks` is no longer hardcoded to `[]`
- [ ] RAG failure does not throw — `.catch(() => [])` ensures non-blocking
- [ ] `summariseContext()` correctly injects chunks into Janet's system context when present
- [ ] All existing tests pass

---

## Build order (sequential)

1. Task 1 (standards table) — must come first; Atlas/Sage code in Tasks 3+4 reads from it
2. Task 2 (fix RAG) — must come before Task 6 (Janet wiring)
3. Task 3 (Atlas prompt + code) — after Task 1
4. Task 4 (Sage prompt + code) — after Task 1; can run parallel with Task 3
5. Task 5 (health_knowledge seed) — independent after Task 2
6. Task 6 (Janet RAG wiring) — after Task 2

## Migration summary

| Migration | Description |
|---|---|
| 0020 | `risk_assessment_standards` table + RLS + seed (all 5 domains + supplement + drug_interaction) |
| 0021 | Replace `hybrid_search_health` with NULL-safe PL/pgSQL BM25 fallback |
| 0022 | UPDATE atlas system_prompt — clinical framework references |
| 0023 | UPDATE sage system_prompt — NIH ODS evidence base |
| 0024 | INSERT ~65 knowledge chunks into `health_knowledge` |
