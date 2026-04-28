-- Migration 0009: biomarkers.lab_results, biomarkers.biological_age_tests
--
-- Lab results: structured biomarker extraction from patient_uploads (Janet AI) or manual entry.
-- Biomarker = one value (HbA1c, LDL, hsCRP, etc.) from a panel. Enables trending, thresholds,
-- multi-lab consolidation.
--
-- Biological age tests: raw epigenetic/biological age test results from labs
-- (TruDiagnostic, Everlab, Elysium, etc.). Distinct from public.risk_scores.biological_age
-- which is Janet's composite score.
--
-- Writers: service_role (Janet AI); readers: owner, clinician, admin, systemAdmin.

-- ============================================================================
-- biomarkers.lab_results
-- ============================================================================

create table if not exists biomarkers.lab_results (
  id                uuid        primary key default gen_random_uuid(),
  user_uuid         uuid        not null references auth.users(id) on delete cascade,
  upload_id         uuid        references public.patient_uploads(id) on delete set null,
  test_date         date        not null,
  panel_name        text,
  lab_provider      text,
  biomarker         text        not null,
  value             numeric     not null,
  unit              text        not null,
  reference_min     numeric,
  reference_max     numeric,
  optimal_min       numeric,
  optimal_max       numeric,
  status            text        check (status in ('low', 'optimal', 'borderline', 'high', 'critical')),
  category          text        check (category in (
    'metabolic', 'cardiovascular', 'hormonal', 'inflammatory', 'haematology',
    'vitamins', 'kidney', 'liver', 'thyroid', 'other'
  )),
  trend             text        check (trend in ('improving', 'stable', 'declining', 'unknown')),
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists lab_results_user_uuid_idx
  on biomarkers.lab_results(user_uuid);
create index if not exists lab_results_user_biomarker_date_idx
  on biomarkers.lab_results(user_uuid, biomarker, test_date desc);
create index if not exists lab_results_upload_id_idx
  on biomarkers.lab_results(upload_id);

alter table biomarkers.lab_results enable row level security;

drop policy if exists "lab_results_owner_select" on biomarkers.lab_results;
drop policy if exists "lab_results_service_insert" on biomarkers.lab_results;
drop policy if exists "lab_results_service_update" on biomarkers.lab_results;
drop policy if exists "lab_results_clinician_select" on biomarkers.lab_results;
drop policy if exists "lab_results_admin_select" on biomarkers.lab_results;

create policy "lab_results_owner_select" on biomarkers.lab_results
  for select using (auth.uid() = user_uuid);

create policy "lab_results_service_insert" on biomarkers.lab_results
  for insert with check ((auth.jwt() ->> 'role') = 'service_role' or (auth.jwt() ->> 'role') = 'systemAdmin');

create policy "lab_results_service_update" on biomarkers.lab_results
  for update using ((auth.jwt() ->> 'role') in ('service_role', 'systemAdmin'));

create policy "lab_results_clinician_select" on biomarkers.lab_results
  for select using ((auth.jwt() ->> 'role') = 'clinician');

create policy "lab_results_admin_select" on biomarkers.lab_results
  for select using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

-- ============================================================================
-- biomarkers.biological_age_tests
-- ============================================================================

create table if not exists biomarkers.biological_age_tests (
  id                uuid        primary key default gen_random_uuid(),
  user_uuid         uuid        not null references auth.users(id) on delete cascade,
  upload_id         uuid        references public.patient_uploads(id) on delete set null,
  test_date         date        not null,
  biological_age    numeric(5,2) not null,
  test_provider     text,
  test_method       text        check (test_method in ('phenoage', 'grimage', 'horvath', 'dunedin_pace', 'other')),
  optimal_markers   int,
  suboptimal_markers int,
  elevated_markers  int,
  total_markers     int,
  report_url        text,
  key_insights      text[]      not null default '{}',
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists biological_age_tests_user_uuid_idx
  on biomarkers.biological_age_tests(user_uuid);
create index if not exists biological_age_tests_user_date_idx
  on biomarkers.biological_age_tests(user_uuid, test_date desc);
create index if not exists biological_age_tests_upload_id_idx
  on biomarkers.biological_age_tests(upload_id);

alter table biomarkers.biological_age_tests enable row level security;

drop policy if exists "biological_age_tests_owner_select" on biomarkers.biological_age_tests;
drop policy if exists "biological_age_tests_service_insert" on biomarkers.biological_age_tests;
drop policy if exists "biological_age_tests_clinician_select" on biomarkers.biological_age_tests;
drop policy if exists "biological_age_tests_admin_select" on biomarkers.biological_age_tests;

create policy "biological_age_tests_owner_select" on biomarkers.biological_age_tests
  for select using (auth.uid() = user_uuid);

create policy "biological_age_tests_service_insert" on biomarkers.biological_age_tests
  for insert with check ((auth.jwt() ->> 'role') in ('service_role', 'systemAdmin'));

create policy "biological_age_tests_clinician_select" on biomarkers.biological_age_tests
  for select using ((auth.jwt() ->> 'role') = 'clinician');

create policy "biological_age_tests_admin_select" on biomarkers.biological_age_tests
  for select using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));
