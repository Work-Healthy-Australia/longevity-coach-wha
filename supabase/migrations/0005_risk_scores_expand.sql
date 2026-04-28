-- Expand risk_scores to absorb the full RiskAssessment shape from base-44.
--
-- Columns preserved (already in use by dashboard code):
--   biological_age, cv_risk, metabolic_risk, neuro_risk, onco_risk, msk_risk
--
-- Deliberately NOT stored (AGENTS.md rule 1 — derived at read time):
--   chronological_age  → compute from profiles.date_of_birth JOIN
--   age_delta          → compute as (profiles.date_of_birth age) - biological_age
--
-- RLS: service_role writes; users/clinicians/admins read their own or all rows.

-- ---------------------------------------------------------------------------
-- New typed columns
-- ---------------------------------------------------------------------------
alter table public.risk_scores
  add column if not exists assessment_date         date,
  add column if not exists longevity_score         numeric(5,2)   check (longevity_score  between 0 and 100),
  add column if not exists longevity_label         text           check (longevity_label   in ('Optimal','Good','Needs Attention','Concerning','Critical')),
  add column if not exists composite_risk          numeric(5,2)   check (composite_risk    between 0 and 100),
  add column if not exists risk_level              text           check (risk_level         in ('very_low','low','moderate','high','very_high')),
  add column if not exists cancer_risk             numeric(5,2)   check (cancer_risk        between 0 and 100),
  add column if not exists confidence_level        text           check (confidence_level   in ('low','moderate','high','insufficient')),
  add column if not exists data_completeness       numeric(4,3)   check (data_completeness  between 0 and 1),
  add column if not exists family_history_summary  text,
  add column if not exists next_recommended_tests  text,
  -- arrays — typed columns, not JSONB (AGENTS.md rule 3)
  add column if not exists top_risk_drivers        text[]         not null default '{}',
  add column if not exists top_protective_levers   text[]         not null default '{}',
  add column if not exists recommended_screenings  text[]         not null default '{}',
  -- opaque objects — JSONB (AGENTS.md rule 3 exception: no filter/range/index need)
  add column if not exists trajectory_6month       jsonb,
  add column if not exists domain_scores           jsonb;

-- ---------------------------------------------------------------------------
-- RLS — add clinician and systemAdmin read access
-- (existing: risk_owner_select, risk_admin_select from 0001_init.sql)
-- ---------------------------------------------------------------------------
drop policy if exists "risk_clinician_select"   on public.risk_scores;
drop policy if exists "risk_systemadmin_select" on public.risk_scores;

create policy "risk_clinician_select" on public.risk_scores
  for select using ((auth.jwt() ->> 'role') = 'clinician');

create policy "risk_systemadmin_select" on public.risk_scores
  for select using ((auth.jwt() ->> 'role') = 'systemAdmin');
