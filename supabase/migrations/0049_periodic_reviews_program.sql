-- Migration 0049: clinician portal workspace columns on periodic_reviews
--
-- Adds the columns the clinician workspace needs to drive the
-- awaiting_clinician → in_review → program_ready → sent_to_patient flow:
--
--   program_30_day             — text body of the program Janet drafts /
--                                 the clinician edits before approval
--   program_sent_at            — when the clinician approved and the patient
--                                 was emailed
--   clinician_conversation_id  — resumable janet_clinician session anchor
--                                 (Wave 10 will populate this)

alter table public.periodic_reviews
  add column if not exists program_30_day            text,
  add column if not exists program_sent_at           timestamptz,
  add column if not exists clinician_conversation_id uuid;

-- The existing patient_assignments check above patient_assignments_clinician_select
-- (migration 0011) gates clinician reads. Periodic reviews need a parallel policy
-- so the assigned clinician can both read and update the review.

drop policy if exists "periodic_reviews_clinician_select"  on public.periodic_reviews;
drop policy if exists "periodic_reviews_clinician_update"  on public.periodic_reviews;

create policy "periodic_reviews_clinician_select" on public.periodic_reviews
  for select using (
    auth.uid() = clinician_uuid
    or exists (
      select 1 from public.patient_assignments pa
      where pa.patient_uuid = periodic_reviews.patient_uuid
        and pa.clinician_uuid = auth.uid()
        and pa.status = 'active'
    )
  );

create policy "periodic_reviews_clinician_update" on public.periodic_reviews
  for update using (
    auth.uid() = clinician_uuid
    or exists (
      select 1 from public.patient_assignments pa
      where pa.patient_uuid = periodic_reviews.patient_uuid
        and pa.clinician_uuid = auth.uid()
        and pa.status = 'active'
    )
  );
