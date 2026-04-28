# Longevity Coach — Database Schema Design

**Last updated:** 2026-04-27

---

## Architectural Principles

1. **Single source of truth** — no derived columns. `age_delta`, `chronological_age` are computed at read time from `profiles.date_of_birth`. (AGENTS.md rule 1)
2. **PII boundary** — PII lives only in `public.profiles` + `auth.users`. All other tables are de-identified. (AGENTS.md rule 2)
3. **Typed columns for queryable data; JSONB only for opaque/schema-less data.** (AGENTS.md rule 3)
4. **One primary writer per table.** (AGENTS.md rule 4)
5. RLS enabled on every table. `service_role` bypasses RLS (Supabase default).
6. All migrations are idempotent (`if not exists`).

---

## Schema Map

| Schema | Purpose | Tables |
|--------|---------|--------|
| `public` | Identity, compliance, clinical care, programs | See section below |
| `biomarkers` | All patient measurements, lab data, uploads | `patient_uploads`, `lab_results`, `biological_age_tests`, `daily_logs` |
| `billing` | Financial layer — will be extracted as a standalone platform | `subscriptions`*, `plans`, `plan_addons`, `subscription_addons`, `test_orders`, `organisations`, `organisation_addons`, `organisation_members`, `suppliers`, `products` |

`*` Phase 2: `public.subscriptions` moves to `billing.subscriptions` once billing platform is extracted.

### public schema tables

| Table | Status | Purpose |
|-------|--------|---------|
| `profiles` | existing | PII anchor, 1:1 with auth.users |
| `consent_records` | existing | Append-only legal/AHPRA audit trail |
| `subscriptions` | existing → Phase 2 move to billing | Stripe subscription state |
| `health_profiles` | existing | De-identified questionnaire responses |
| `patient_uploads` | existing → Phase 2 move to biomarkers | Raw uploaded files + Janet metadata |
| `risk_scores` | existing (expanded 0005) | Computed longevity + domain risk output |
| `family_members` | new (0008) | Family history for actuarial risk engine |
| `patient_assignments` | new (0011) | Clinician ↔ patient access control join |
| `care_notes` | new (0011) | Unified narrative notes (clinician or AI) |
| `periodic_reviews` | new (0011) | Monthly/quarterly structured reviews |
| `coach_suggestions` | new (0011) | Janet's actionable recommendation queue |
| `supplement_plans` | new (0012) | AI/clinician supplement protocols |
| `meal_plans` | new (0012) | AI/clinician nutrition plans |
| `training_plans` | new (0012) | AI/clinician exercise protocols |

---

## Entity Relationship

```
auth.users
  │
  ├── profiles (1:1) ← PII
  ├── consent_records (1:many)
  ├── health_profiles (1:many)
  ├── family_members (1:many)
  │
  ├── patient_uploads (1:many)
  │       └── biomarkers.lab_results (1:many)
  │       └── biomarkers.biological_age_tests (1:many)
  │
  ├── biomarkers.daily_logs (1:many, unique per day)
  │
  ├── risk_scores (1:many snapshots)
  │
  ├── patient_assignments (many:many via clinician_uuid)
  │
  ├── care_notes (1:many)
  ├── periodic_reviews (1:many)
  │       └── supplement_plans (FK review_id)
  │       └── meal_plans (FK review_id)
  │       └── training_plans (FK review_id)
  ├── coach_suggestions (1:many)
  │
  ├── billing.subscriptions (1:many)
  │       └─ price_id soft-ref → billing.plans.stripe_price_id
  ├── billing.subscription_addons (1:many) → billing.plan_addons
  ├── billing.test_orders (1:many) → billing.products
  │
  └── billing.organisation_members (many:many)
            └── billing.organisations
                      ├── plan_id FK → billing.plans
                      └── billing.organisation_addons → billing.plan_addons
```

---

## public Schema

### `profiles` (existing)

**Writer:** `handle_new_user()` trigger on signup; patient via profile-edit forms.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | FK → auth.users(id) |
| full_name | text | Canonical; use `splitFullName()` helper, never split into columns |
| date_of_birth | date | Canonical DOB; age is derived at read time |
| phone | text | |
| address_postal | text | |
| role | text NOT NULL DEFAULT 'user' | CHECK in ('user', 'admin') |
| created_at / updated_at | timestamptz | |

RLS: owner select/update/insert; admin select.

---

### `consent_records` (existing, 0004)

**Writer:** Patient (insert only). Append-only — no UPDATE/DELETE policy.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_uuid | uuid NOT NULL | FK → auth.users(id) |
| policy_id | text NOT NULL | |
| policy_version | text NOT NULL | |
| accepted_at | timestamptz NOT NULL | |
| ip_address | text | |
| user_agent | text | |

RLS: owner select/insert; admin select.

---

### `health_profiles` (existing, 0001)

**Writer:** Onboarding server actions only.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_uuid | uuid NOT NULL | FK → auth.users(id) |
| responses | jsonb NOT NULL DEFAULT '{}' | De-identified questionnaire answers |
| completed_at | timestamptz | |
| created_at / updated_at | timestamptz | |

RLS: owner all; admin select.

---

### `risk_scores` (existing, expanded in 0005)

**Writer:** Service-role risk engine only. RLS denies user writes.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_uuid | uuid NOT NULL | FK → auth.users(id) |
| assessment_date | date | |
| longevity_score | numeric(5,2) | 0–100, higher = better |
| longevity_label | text | CHECK in ('Optimal','Good','Needs Attention','Concerning','Critical') |
| composite_risk | numeric(5,2) | 0–100, higher = higher risk |
| risk_level | text | CHECK in ('very_low','low','moderate','high','very_high') |
| biological_age | numeric(5,2) | Janet's composite (distinct from raw test in biological_age_tests) |
| cv_risk | numeric(5,2) | Cardiovascular |
| metabolic_risk | numeric(5,2) | |
| neuro_risk | numeric(5,2) | Neurodegenerative |
| onco_risk | numeric(5,2) | Oncological |
| msk_risk | numeric(5,2) | Musculoskeletal |
| cancer_risk | numeric(5,2) | |
| confidence_level | text | CHECK in ('low','moderate','high','insufficient') |
| data_completeness | numeric(4,3) | 0–1 fraction of expected data points |
| top_risk_drivers | text[] NOT NULL DEFAULT '{}' | |
| top_protective_levers | text[] NOT NULL DEFAULT '{}' | |
| recommended_screenings | text[] NOT NULL DEFAULT '{}' | |
| family_history_summary | text | |
| next_recommended_tests | text | |
| trajectory_6month | jsonb | Projected improvements (opaque) |
| domain_scores | jsonb | Full domain breakdown (opaque) |
| computed_at | timestamptz NOT NULL | |

**Not stored:** `chronological_age` (derived from `profiles.date_of_birth`), `age_delta` (derived from biological_age and DOB).

RLS: owner select; clinician/admin/systemAdmin select.

---

### `family_members` (new, 0008)

**Writer:** Patient.
**Why separate from health_profiles:** Family history is queryable (e.g. "patients with maternal cardiovascular history"). Typed rows let the risk engine run structured actuarial queries; JSONB in health_profiles would not.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_uuid | uuid NOT NULL | FK → auth.users(id) |
| relationship | text NOT NULL | CHECK in ('mother','father','maternal_grandmother','maternal_grandfather','paternal_grandmother','paternal_grandfather','sibling','other') |
| sex | text | CHECK in ('male','female','unknown') |
| is_alive | boolean NOT NULL | |
| current_age | int | Nullable — only if alive |
| age_at_death | int | Nullable — only if deceased |
| cause_category | text | CHECK in ('cardiovascular','cancer','neurological','metabolic','respiratory','infection','accident','other','unknown') |
| conditions | text[] NOT NULL DEFAULT '{}' | Secondary conditions |
| smoking_status | text | CHECK in ('never','former','current','unknown') |
| alcohol_use | text | CHECK in ('none','moderate','heavy','unknown') |
| notes | text | |
| created_at / updated_at | timestamptz | |

Index: `(user_uuid, relationship, is_alive)`.
RLS: owner all; clinician/admin/systemAdmin select.

---

### `patient_assignments` (new, 0011)

**Writer:** Admin/systemAdmin.
**Lives in public** so it can be referenced for access control joins from any domain without cross-schema complications.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| patient_uuid | uuid NOT NULL | FK → auth.users(id) ON DELETE CASCADE |
| clinician_uuid | uuid | FK → auth.users(id) ON DELETE SET NULL |
| coach_uuid | uuid | FK → auth.users(id) ON DELETE SET NULL |
| org_id | text | |
| status | text NOT NULL DEFAULT 'active' | CHECK in ('active','inactive','transferred') |
| assigned_at / created_at | timestamptz NOT NULL | |
| | | UNIQUE(patient_uuid, clinician_uuid) |

RLS: patient select own; clinician select where clinician_uuid = auth.uid(); admin/systemAdmin all.

---

### `care_notes` (new, 0011)

**Writer:** Clinician (clinical notes) OR service_role/AI (ai notes). Never mixed in same row.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| patient_uuid | uuid NOT NULL | FK → auth.users(id) |
| author_uuid | uuid | FK → auth.users(id) ON DELETE SET NULL; NULL = AI |
| author_role | text NOT NULL | CHECK in ('clinician','ai','coach') — typed to survive role changes |
| note_type | text NOT NULL | CHECK in ('clinical','review','suggestion','follow_up','alert') |
| content | text NOT NULL | |
| is_visible_to_patient | boolean NOT NULL DEFAULT false | Explicit — avoids accidental exposure |
| priority | text | CHECK in ('low','normal','high','urgent') |
| follow_up_date | date | |
| tags | text[] NOT NULL DEFAULT '{}' | |
| related_entity_type | text | e.g. 'lab_result', 'risk_score' |
| related_entity_id | uuid | |
| created_at / updated_at | timestamptz | |

Index: `(patient_uuid, created_at DESC)`.
RLS: patient select where is_visible_to_patient = true; clinician select/insert/update own; service_role insert; admin all.

---

### `periodic_reviews` (new, 0011)

**Writers:** Patient (patient section) + service_role (AI section + clinician section on behalf of clinician). Three write scopes enforced by status enum.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| patient_uuid | uuid NOT NULL | FK → auth.users(id) |
| clinician_uuid | uuid | FK → auth.users(id) ON DELETE SET NULL |
| review_type | text NOT NULL | CHECK in ('monthly','quarterly') |
| review_date | date NOT NULL | |
| delivery_method | text | CHECK in ('in_app','video_call','phone','in_person') |
| status | text NOT NULL DEFAULT 'pending' | CHECK in ('pending','patient_submitted','clinician_reviewing','approved','sent') |
| **Patient section** | | |
| wins | text[] NOT NULL DEFAULT '{}' | |
| adherence_score | smallint | CHECK 0–100 |
| adherence_notes | text | |
| stress_level | smallint | CHECK 1–10 |
| stress_notes | text | |
| next_goals | text[] NOT NULL DEFAULT '{}' | |
| support_needed | text | |
| open_space | text | |
| patient_submitted_at | timestamptz | |
| **AI section** | | |
| ai_summary | text | |
| overall_sentiment | text | CHECK in ('positive','neutral','concerning','critical') |
| ai_processed_at | timestamptz | |
| **Clinician section** | | |
| clinician_notes | text | |
| approved_at | timestamptz | |
| created_at / updated_at | timestamptz | |

Indexes: `(patient_uuid, review_date DESC)`, `(status)`.
RLS: patient select/update (own, not approved); clinician select/update assigned; service_role update; admin all.

---

### `coach_suggestions` (new, 0011)

**Writer:** Service-role (Janet). Patient can update `is_dismissed` / `is_completed` only.
**Why not care_notes:** Suggestions are a task queue (dismissible, completable). Notes are narrative history. Different UX, different query patterns.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| patient_uuid | uuid NOT NULL | FK → auth.users(id) |
| suggestion_type | text NOT NULL | CHECK in ('test','lifestyle','supplement','referral','diet','exercise') |
| priority | smallint NOT NULL DEFAULT 3 | CHECK 1–5 (1 = most urgent) |
| title | text NOT NULL | |
| rationale | text | |
| expected_insight | text | |
| suggested_provider | text | |
| estimated_cost_aud | numeric(10,2) | |
| data_target | text | Gap this suggestion fills (e.g. 'fasting_glucose') |
| is_dismissed | boolean NOT NULL DEFAULT false | |
| dismissed_at | timestamptz | |
| is_completed | boolean NOT NULL DEFAULT false | |
| completed_at | timestamptz | |
| created_at | timestamptz NOT NULL | |

Index: `(patient_uuid, is_completed, priority DESC) WHERE is_dismissed = false` — open queue.
RLS: patient select/update own; service_role insert; clinician select; admin all.

---

### `supplement_plans`, `meal_plans`, `training_plans` (new, 0012)

**Writer:** Service-role (AI creates draft); clinician updates status/dates/notes.

Shared structure:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| patient_uuid | uuid NOT NULL | FK → auth.users(id) |
| created_by_uuid | uuid | FK → auth.users(id) ON DELETE SET NULL; NULL = AI |
| created_by_role | text NOT NULL | CHECK in ('ai','clinician','coach') |
| status | text NOT NULL DEFAULT 'draft' | CHECK in ('draft','active','paused','completed','superseded') |
| valid_from / valid_to | date | |
| notes | text | |
| review_id | uuid | FK → public.periodic_reviews(id) ON DELETE SET NULL |
| created_at / updated_at | timestamptz | |

Payload columns (JSONB — opaque, schema-less, not queried individually):

| Table | JSONB columns |
|-------|---------------|
| supplement_plans | `items jsonb NOT NULL DEFAULT '[]'` — array of {name, dose, unit, timing, rationale, estimated_cost_aud} |
| meal_plans | `dietary_restrictions text[]`, `calorie_target int`, `macros_target jsonb`, `meal_structure jsonb` |
| training_plans | `sessions_per_week smallint`, `sessions jsonb NOT NULL DEFAULT '[]'` — array of {day, type, duration_min, exercises[]} |

RLS: patient select own; service_role insert; clinician update; admin all.

---

## biomarkers Schema

### `patient_uploads` (existing, 0006 — Phase 2 move from public)

**Writer:** Patient (insert); service_role (Janet updates `janet_*` columns).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_uuid | uuid NOT NULL | FK → auth.users(id) |
| storage_path | text NOT NULL | `{user_uuid}/{upload_uuid}-{filename}` |
| original_filename | text NOT NULL | |
| mime_type | text NOT NULL | |
| file_size_bytes | bigint NOT NULL | |
| janet_status | text NOT NULL DEFAULT 'pending' | CHECK in ('pending','processing','done','error') |
| janet_category | text | 'blood_work','imaging','genetic','microbiome','metabolic','other' |
| janet_summary | text | |
| janet_findings | jsonb | Structured extraction output |
| janet_error | text | |
| janet_processed_at | timestamptz | |
| created_at / updated_at | timestamptz | |

Indexes: `(user_uuid)`, `(janet_status)`.
RLS: owner select/insert/delete; admin select. No user UPDATE (Janet updates via service_role).

---

### `lab_results` (new, 0009)

**Writer:** Service-role (Janet extracts from uploads or manual admin entry).
**Why separate from patient_uploads:** One upload may contain dozens of biomarkers. This table normalises them to one row per biomarker per test date, enabling trend queries and threshold alerts.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_uuid | uuid NOT NULL | FK → auth.users(id) |
| upload_id | uuid | FK → patient_uploads(id) ON DELETE SET NULL; nullable for manual entry |
| test_date | date NOT NULL | |
| panel_name | text | e.g. 'Comprehensive Metabolic Panel' |
| lab_provider | text | |
| biomarker | text NOT NULL | Standardised code: 'HbA1c', 'LDL_cholesterol', 'hsCRP' |
| value | numeric NOT NULL | |
| unit | text NOT NULL | e.g. 'mmol/L', 'mg/dL' |
| reference_min / reference_max | numeric | Lab reference range |
| optimal_min / optimal_max | numeric | Longevity coaching optimal range |
| status | text | CHECK in ('low','optimal','borderline','high','critical') |
| category | text | CHECK in ('metabolic','cardiovascular','hormonal','inflammatory','haematology','vitamins','kidney','liver','thyroid','other') |
| trend | text | CHECK in ('improving','stable','declining','unknown') |
| notes | text | |
| created_at | timestamptz NOT NULL | |

Indexes: `(user_uuid, biomarker, test_date DESC)`, `(upload_id)`.
RLS: owner select; service_role insert/update; clinician/admin select.

---

### `biological_age_tests` (new, 0009)

**Writer:** Service-role (Janet parses epigenetic test reports).
**Why separate from risk_scores.biological_age:** This is the raw lab test result (TruDiagnostic, Everlab, Elysium). `risk_scores.biological_age` is Janet's composite calculated from all inputs. Both are needed for trending and auditability.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_uuid | uuid NOT NULL | FK → auth.users(id) |
| upload_id | uuid | FK → patient_uploads(id) ON DELETE SET NULL |
| test_date | date NOT NULL | |
| biological_age | numeric(5,2) NOT NULL | |
| test_provider | text | 'TruDiagnostic', 'Everlab', 'Elysium' |
| test_method | text | CHECK in ('phenoage','grimage','horvath','dunedin_pace','other') |
| optimal_markers / suboptimal_markers / elevated_markers / total_markers | int | Marker counts |
| report_url | text | |
| key_insights | text[] NOT NULL DEFAULT '{}' | |
| notes | text | |
| created_at | timestamptz NOT NULL | |

**Not stored:** `chronological_age` — derived from `profiles.date_of_birth`.
RLS: owner select; service_role insert; clinician/admin select.

---

### `daily_logs` (new, 0010)

**Writer:** Patient. One row per patient per day (UNIQUE constraint).
**No blood_glucose column** — glucose goes through `lab_results` (with test_provider='glucometer' for self-measured). Keeps daily_logs focused on wellness metrics.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_uuid | uuid NOT NULL | FK → auth.users(id) |
| log_date | date NOT NULL | UNIQUE(user_uuid, log_date) |
| **Sleep** | | |
| sleep_hours | numeric(4,2) | |
| sleep_quality | smallint | CHECK 1–10 |
| **Wellbeing** | | |
| energy_level / mood / stress_level | smallint | CHECK 1–10 |
| **Movement** | | |
| workout_completed | boolean DEFAULT false | |
| workout_type / workout_duration_min / strength_notes | text/int/text | |
| workout_intensity | smallint | CHECK 1–10 |
| steps | int | |
| **Recovery** | | |
| mobility_completed / mobility_duration_min | bool/int | |
| meditation_completed / meditation_duration_min | bool/int | |
| sauna_completed / sauna_rounds | bool/int | |
| **Vitals** | | |
| weight_kg | numeric(5,2) | |
| hrv | numeric(6,2) | |
| resting_heart_rate | int | |
| blood_pressure_systolic / blood_pressure_diastolic | int | |
| **Nutrition** | | |
| water_ml | int | |
| protein_grams | numeric(6,2) | |
| meals_consumed | jsonb DEFAULT '[]' | Opaque — free-form meal descriptions |
| **Gut** | | |
| gut_health | smallint | CHECK 1–10 |
| bowel_movements | int | |
| bowel_quality | text | |
| supplements_taken | text[] NOT NULL DEFAULT '{}' | |
| notes | text | |
| created_at / updated_at | timestamptz | |

Index: `(user_uuid, log_date DESC)`.
RLS: owner all; clinician/admin select.

---

## billing Schema

The billing schema is designed to be extracted into a standalone platform. All Stripe-facing state and supplier/product catalog live here.

### `subscriptions` (existing in public — Phase 2 move)

**Writer:** Stripe webhook only.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_uuid | uuid NOT NULL | FK → auth.users(id) |
| stripe_customer_id | text UNIQUE | |
| stripe_subscription_id | text UNIQUE | |
| price_id | text | Soft-ref to plans.stripe_price_id |
| status | text NOT NULL | |
| current_period_end | timestamptz | |
| cancel_at_period_end | boolean NOT NULL DEFAULT false | |
| created_at / updated_at | timestamptz | |

---

### `plans`

**Writer:** Admin only. Reference data — defines tiers and Stripe price IDs.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | |
| tier | text NOT NULL | CHECK in ('individual','professional','corporate') |
| billing_interval | text NOT NULL | CHECK in ('month','year') |
| stripe_price_id | text NOT NULL UNIQUE | Soft-referenced by subscriptions.price_id |
| base_price_cents | int NOT NULL | Per-seat for corporate; flat for individual/professional |
| annual_discount_pct | numeric(5,2) NOT NULL DEFAULT 0 | CHECK 0–100 |
| feature_flags | jsonb NOT NULL DEFAULT '{}' | Ceiling of what this tier permits |
| is_active | boolean NOT NULL DEFAULT true | |
| created_at / updated_at | timestamptz | |

---

### `plan_addons`

**Writer:** Admin only. Optional recurring feature add-ons, scoped to minimum tier.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | |
| description | text | |
| feature_key | text NOT NULL UNIQUE | Canonical flag key: 'supplement_protocol', 'pdf_export', 'genome_access', 'advanced_risk_report', 'dexa_ordering' |
| stripe_price_id_monthly | text NOT NULL UNIQUE | |
| stripe_price_id_annual | text NOT NULL UNIQUE | |
| price_monthly_cents | int NOT NULL | |
| price_annual_cents | int NOT NULL | |
| min_tier | text NOT NULL | CHECK in ('individual','professional','corporate') |
| is_active | boolean NOT NULL DEFAULT true | |
| created_at / updated_at | timestamptz | |

---

### `subscription_addons`

**Writer:** Stripe webhook (on checkout completion or subscription item add).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_uuid | uuid NOT NULL | FK → auth.users(id) ON DELETE CASCADE |
| plan_addon_id | uuid NOT NULL | FK → billing.plan_addons(id) |
| stripe_subscription_id | text NOT NULL | Soft-ref to subscriptions.stripe_subscription_id |
| stripe_subscription_item_id | text NOT NULL UNIQUE | Used to remove the add-on from Stripe |
| status | text NOT NULL DEFAULT 'active' | CHECK in ('active','cancelled') |
| created_at / updated_at | timestamptz | |
| | | UNIQUE(user_uuid, plan_addon_id) |

RLS: patient select/insert/delete own; admin all.

---

### `test_orders`

**Writer:** Patient (insert via API); Stripe webhook (status updates); admin (fulfillment updates).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_uuid | uuid NOT NULL | FK → auth.users(id) ON DELETE RESTRICT |
| product_id | uuid NOT NULL | FK → billing.products(id) |
| stripe_payment_intent_id | text UNIQUE | |
| amount_cents | int NOT NULL | Snapshotted at order time — price changes don't affect past orders |
| status | text NOT NULL DEFAULT 'pending' | CHECK in ('pending','paid','fulfilling','completed','cancelled','refunded') |
| notes | text | |
| created_at / updated_at | timestamptz | |

RLS: patient select/insert own; health_manager select own org's; admin all.

---

### `organisations`

**Writer:** Admin.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | |
| plan_id | uuid | FK → billing.plans(id) — must reference a 'corporate' tier plan |
| seat_count | int NOT NULL DEFAULT 0 | CHECK >= 0 |
| created_at / updated_at | timestamptz | |

RLS: org members select own org; health_manager select+update own org; admin all.

---

### `organisation_addons`

**Writer:** Health manager (enable/disable); admin.
Replaces the feature_flags JSONB blob — typed rows are queryable, indexable, and auditable.

| Column | Type | Notes |
|--------|------|-------|
| org_id | uuid NOT NULL | FK → billing.organisations(id) ON DELETE CASCADE |
| plan_addon_id | uuid NOT NULL | FK → billing.plan_addons(id) |
| enabled_at | timestamptz NOT NULL DEFAULT now() | |
| | | PRIMARY KEY (org_id, plan_addon_id) |

Application enforces: org can only enable add-ons whose `min_tier` ≤ their plan's tier.

---

### `organisation_members`

**Writer:** Admin/health_manager (invite flow).

| Column | Type | Notes |
|--------|------|-------|
| org_id | uuid NOT NULL | FK → billing.organisations(id) ON DELETE CASCADE |
| user_uuid | uuid NOT NULL | FK → auth.users(id) ON DELETE CASCADE |
| role | text NOT NULL DEFAULT 'member' | CHECK in ('member','health_manager') |
| joined_at | timestamptz NOT NULL DEFAULT now() | |
| | | PRIMARY KEY (org_id, user_uuid) |

UNIQUE index on `user_uuid` enforces one org per user (remove if multi-org is ever needed).

---

### `suppliers`

**Writer:** Admin only.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | |
| contact_email | text | |
| contact_phone | text | |
| address | text | |
| external_identifier | text | ABN, provider number |
| is_active | boolean NOT NULL DEFAULT true | |
| created_at / updated_at | timestamptz | |

RLS: patient/health_manager see active suppliers only (no contact details); admin all.

---

### `products`

**Writer:** Admin only.
Stripe price ID is populated by admin after creating it in Stripe dashboard — never auto-created.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| supplier_id | uuid NOT NULL | FK → billing.suppliers(id) ON DELETE RESTRICT |
| product_code | text NOT NULL | UNIQUE(supplier_id, product_code) |
| name | text NOT NULL | |
| description | text | |
| category | text NOT NULL | CHECK in ('imaging','pathology','genomics','hormonal','microbiome','other') |
| wholesale_cents | int NOT NULL | Hidden from non-admin RLS |
| retail_cents | int NOT NULL | Snapshotted to test_orders.amount_cents at order time |
| stripe_price_id | text UNIQUE | Created in Stripe by admin |
| is_active | boolean NOT NULL DEFAULT true | |
| created_at / updated_at | timestamptz | |

View `products_public` (used by non-admin roles):
```sql
create view billing.products_public as
  select id, supplier_id, product_code, name, description,
         category, retail_cents, stripe_price_id, is_active
  from billing.products;
```

---

## Feature Flag Resolution

Runtime resolution order (implemented in `lib/features/resolve.ts`):

```
1. Platform admin?                          → all features unlocked
2. Org member?
   a. Feature in organisation_addons?       → unlocked
   b. Feature included in org plan tier?    → unlocked
   c. Otherwise                             → locked
3. Standalone subscriber?
   a. subscription_addons row exists?       → unlocked
   b. Feature included in their plan tier?  → unlocked
   c. Otherwise                             → locked (show upsell)
```

---

## Stripe Integration Points

| Trigger | Stripe event | DB write |
|---------|-------------|----------|
| User completes checkout | `checkout.session.completed` | Insert `subscriptions` + `subscription_addons` rows |
| User adds recurring add-on | `subscriptionItems.create` | Insert `subscription_addons` row |
| User removes recurring add-on | `subscriptionItems.del` | Mark `subscription_addons.status = 'cancelled'` |
| User orders a test | `paymentIntents.create` | Insert `test_orders` with status 'pending' |
| Test payment confirmed | `payment_intent.succeeded` | Update `test_orders.status = 'paid'` |
| Subscription cancelled | `customer.subscription.deleted` | Update `subscriptions.status` |

---

## Phase 2 Migration Plan

After the billing platform is extracted and app code is updated, move these tables using `ALTER TABLE ... SET SCHEMA` (RLS policies and indexes move automatically):

```sql
ALTER TABLE public.health_profiles   SET SCHEMA intake;      -- if intake schema is ever added
ALTER TABLE public.patient_uploads   SET SCHEMA biomarkers;
ALTER TABLE public.subscriptions     SET SCHEMA billing;
```

Additionally, the billing tables (plans, plan_addons, etc.) are currently designed for `billing` schema from the start — no migration needed for those.

---

## Migration File Index

| File | Schema | Tables |
|------|--------|--------|
| 0001_init.sql | public | profiles, health_profiles, risk_scores, subscriptions + triggers |
| 0002_sync_full_name_on_signup.sql | public | handle_new_user() fix |
| 0003_profiles_address_postal.sql | public | profiles.address_postal |
| 0004_consent_records.sql | public | consent_records |
| 0005_risk_scores_expand.sql | public | risk_scores — 15 new columns |
| 0006_patient_uploads.sql | public | patient_uploads + storage bucket |
| 0007_create_schemas.sql | — | Create biomarkers + billing schemas |
| 0008_intake_schema.sql | public | family_members |
| 0009_biomarkers_schema.sql | biomarkers | lab_results, biological_age_tests |
| 0010_biomarkers_daily_logs.sql | biomarkers | daily_logs |
| 0011_clinical_schema.sql | public | patient_assignments, care_notes, periodic_reviews, coach_suggestions |
| 0012_programs_schema.sql | public | supplement_plans, meal_plans, training_plans |
| 0013 (pending) | billing | plans, plan_addons, subscription_addons, test_orders, organisations, organisation_addons, organisation_members, suppliers, products |

---

## Open Questions

1. **Per-seat vs flat corporate pricing** — if corporate is per-seat, `organisations.seat_count` drives the total; if flat, it's informational only.
2. **`feature_key` enum** — exact string values must be agreed and typed before 0013 runs. Starting set: `supplement_protocol`, `pdf_export`, `genome_access`, `advanced_risk_report`, `dexa_ordering`.
3. **Org add-on billing** — does the org get a single Stripe subscription item per add-on (flat) or per-seat? This affects whether `organisation_addons` needs a `stripe_subscription_item_id` column.
4. **profiles.role expansion** — current check constraint only allows 'user' and 'admin'. Roles used in RLS policies ('clinician', 'systemAdmin', 'health_manager') come from JWT claims. Decide whether to expand the profiles.role check constraint or keep JWT-only for those roles.
