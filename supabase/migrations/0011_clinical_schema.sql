-- Migration 0011: clinical tables (all in public)
--
-- patient_assignments : clinician ↔ patient access control join table
-- care_notes          : unified narrative notes (clinician or AI)
-- periodic_reviews    : structured monthly/quarterly reviews with strict write-section ownership
-- coach_suggestions   : Janet's actionable recommendation queue

-- ============================================================================
-- public.patient_assignments
-- ============================================================================

create table if not exists public.patient_assignments (
  id                uuid        primary key default gen_random_uuid(),
  patient_uuid      uuid        not null references auth.users(id) on delete cascade,
  clinician_uuid    uuid        references auth.users(id) on delete set null,
  coach_uuid        uuid        references auth.users(id) on delete set null,
  org_id            text,
  status            text        not null default 'active' check (status in ('active', 'inactive', 'transferred')),
  assigned_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique(patient_uuid, clinician_uuid)
);

create index if not exists patient_assignments_patient_uuid_idx
  on public.patient_assignments(patient_uuid);
create index if not exists patient_assignments_clinician_uuid_idx
  on public.patient_assignments(clinician_uuid);

alter table public.patient_assignments enable row level security;

drop policy if exists "patient_assignments_patient_select"   on public.patient_assignments;
drop policy if exists "patient_assignments_clinician_select" on public.patient_assignments;
drop policy if exists "patient_assignments_admin_all"        on public.patient_assignments;

create policy "patient_assignments_patient_select" on public.patient_assignments
  for select using (auth.uid() = patient_uuid);

create policy "patient_assignments_clinician_select" on public.patient_assignments
  for select using ((auth.jwt() ->> 'role') = 'clinician' and clinician_uuid = auth.uid());

create policy "patient_assignments_admin_all" on public.patient_assignments
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

-- ============================================================================
-- public.care_notes
-- ============================================================================

create table if not exists public.care_notes (
  id                    uuid        primary key default gen_random_uuid(),
  patient_uuid          uuid        not null references auth.users(id) on delete cascade,
  author_uuid           uuid        references auth.users(id) on delete set null,
  author_role           text        not null check (author_role in ('clinician', 'ai', 'coach')),
  note_type             text        not null check (note_type in ('clinical', 'review', 'suggestion', 'follow_up', 'alert')),
  content               text        not null,
  is_visible_to_patient boolean     not null default false,
  priority              text        check (priority in ('low', 'normal', 'high', 'urgent')),
  follow_up_date        date,
  tags                  text[]      not null default '{}',
  related_entity_type   text,
  related_entity_id     uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists care_notes_patient_uuid_idx
  on public.care_notes(patient_uuid);
create index if not exists care_notes_patient_created_idx
  on public.care_notes(patient_uuid, created_at desc);

alter table public.care_notes enable row level security;

drop policy if exists "care_notes_patient_select"    on public.care_notes;
drop policy if exists "care_notes_clinician_select"  on public.care_notes;
drop policy if exists "care_notes_clinician_insert"  on public.care_notes;
drop policy if exists "care_notes_clinician_update"  on public.care_notes;
drop policy if exists "care_notes_ai_insert"         on public.care_notes;
drop policy if exists "care_notes_admin_all"         on public.care_notes;

create policy "care_notes_patient_select" on public.care_notes
  for select using (auth.uid() = patient_uuid and is_visible_to_patient = true);

create policy "care_notes_clinician_select" on public.care_notes
  for select using ((auth.jwt() ->> 'role') = 'clinician');

create policy "care_notes_clinician_insert" on public.care_notes
  for insert with check ((auth.jwt() ->> 'role') = 'clinician');

create policy "care_notes_clinician_update" on public.care_notes
  for update using ((auth.jwt() ->> 'role') = 'clinician' and author_uuid = auth.uid());

create policy "care_notes_ai_insert" on public.care_notes
  for insert with check (author_role = 'ai');

create policy "care_notes_admin_all" on public.care_notes
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists care_notes_set_updated_at on public.care_notes;
create trigger care_notes_set_updated_at
  before update on public.care_notes
  for each row execute function public.set_updated_at();

-- ============================================================================
-- public.periodic_reviews
-- ============================================================================

create table if not exists public.periodic_reviews (
  id                      uuid        primary key default gen_random_uuid(),
  patient_uuid            uuid        not null references auth.users(id) on delete cascade,
  clinician_uuid          uuid        references auth.users(id) on delete set null,
  review_type             text        not null check (review_type in ('monthly', 'quarterly')),
  review_date             date        not null,
  delivery_method         text        check (delivery_method in ('in_app', 'video_call', 'phone', 'in_person')),
  status                  text        not null default 'pending'
                          check (status in ('pending', 'patient_submitted', 'clinician_reviewing', 'approved', 'sent')),

  -- Patient-submitted (patient writes this section)
  wins                    text[]      not null default '{}',
  adherence_score         smallint    check (adherence_score between 0 and 100),
  adherence_notes         text,
  stress_level            smallint    check (stress_level between 1 and 10),
  stress_notes            text,
  next_goals              text[]      not null default '{}',
  support_needed          text,
  open_space              text,
  patient_submitted_at    timestamptz,

  -- AI section (service_role writes)
  ai_summary              text,
  overall_sentiment       text        check (overall_sentiment in ('positive', 'neutral', 'concerning', 'critical')),
  ai_processed_at         timestamptz,

  -- Clinician section (service_role writes on clinician's behalf)
  clinician_notes         text,
  approved_at             timestamptz,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists periodic_reviews_patient_uuid_idx
  on public.periodic_reviews(patient_uuid);
create index if not exists periodic_reviews_patient_date_idx
  on public.periodic_reviews(patient_uuid, review_date desc);
create index if not exists periodic_reviews_status_idx
  on public.periodic_reviews(status);

alter table public.periodic_reviews enable row level security;

drop policy if exists "periodic_reviews_patient_select"    on public.periodic_reviews;
drop policy if exists "periodic_reviews_patient_update"    on public.periodic_reviews;
drop policy if exists "periodic_reviews_clinician_select"  on public.periodic_reviews;
drop policy if exists "periodic_reviews_clinician_update"  on public.periodic_reviews;
drop policy if exists "periodic_reviews_ai_update"         on public.periodic_reviews;
drop policy if exists "periodic_reviews_admin_all"         on public.periodic_reviews;

create policy "periodic_reviews_patient_select" on public.periodic_reviews
  for select using (auth.uid() = patient_uuid);

-- Patient can only update their own section while not yet approved
create policy "periodic_reviews_patient_update" on public.periodic_reviews
  for update using (auth.uid() = patient_uuid and status != 'approved');

create policy "periodic_reviews_clinician_select" on public.periodic_reviews
  for select using ((auth.jwt() ->> 'role') = 'clinician');

create policy "periodic_reviews_clinician_update" on public.periodic_reviews
  for update using ((auth.jwt() ->> 'role') = 'clinician' and clinician_uuid = auth.uid());

create policy "periodic_reviews_ai_update" on public.periodic_reviews
  for update using (auth.role() = 'service_role');

create policy "periodic_reviews_admin_all" on public.periodic_reviews
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists periodic_reviews_set_updated_at on public.periodic_reviews;
create trigger periodic_reviews_set_updated_at
  before update on public.periodic_reviews
  for each row execute function public.set_updated_at();

-- ============================================================================
-- public.coach_suggestions
-- ============================================================================

create table if not exists public.coach_suggestions (
  id                  uuid        primary key default gen_random_uuid(),
  patient_uuid        uuid        not null references auth.users(id) on delete cascade,
  suggestion_type     text        not null check (suggestion_type in ('test', 'lifestyle', 'supplement', 'referral', 'diet', 'exercise')),
  priority            smallint    not null default 3 check (priority between 1 and 5),
  title               text        not null,
  rationale           text,
  expected_insight    text,
  suggested_provider  text,
  estimated_cost_aud  numeric(10,2),
  data_target         text,
  is_dismissed        boolean     not null default false,
  dismissed_at        timestamptz,
  is_completed        boolean     not null default false,
  completed_at        timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists coach_suggestions_patient_uuid_idx
  on public.coach_suggestions(patient_uuid);
create index if not exists coach_suggestions_patient_active_idx
  on public.coach_suggestions(patient_uuid, is_completed, priority desc)
  where is_dismissed = false;

alter table public.coach_suggestions enable row level security;

drop policy if exists "coach_suggestions_patient_select"  on public.coach_suggestions;
drop policy if exists "coach_suggestions_patient_update"  on public.coach_suggestions;
drop policy if exists "coach_suggestions_service_insert"  on public.coach_suggestions;
drop policy if exists "coach_suggestions_clinician_select" on public.coach_suggestions;
drop policy if exists "coach_suggestions_admin_all"       on public.coach_suggestions;

create policy "coach_suggestions_patient_select" on public.coach_suggestions
  for select using (auth.uid() = patient_uuid);

create policy "coach_suggestions_patient_update" on public.coach_suggestions
  for update using (auth.uid() = patient_uuid);

create policy "coach_suggestions_service_insert" on public.coach_suggestions
  for insert with check (auth.role() = 'service_role');

create policy "coach_suggestions_clinician_select" on public.coach_suggestions
  for select using ((auth.jwt() ->> 'role') = 'clinician');

create policy "coach_suggestions_admin_all" on public.coach_suggestions
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));
