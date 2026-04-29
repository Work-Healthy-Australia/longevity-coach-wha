alter table public.periodic_reviews
  add column if not exists janet_brief        text,
  add column if not exists domain_highlights  jsonb  default '[]',
  add column if not exists suggested_focus    jsonb  default '[]',
  add column if not exists adherence_signals  text,
  add column if not exists biomarker_deltas   text,
  add column if not exists alert_summary      text,
  add column if not exists data_coverage_note text,
  add column if not exists review_month       date,
  add column if not exists review_status      text
    default 'awaiting_clinician'
    check (review_status in ('awaiting_clinician','in_review','program_ready','sent_to_patient'));

create unique index if not exists periodic_reviews_patient_month_uidx
  on public.periodic_reviews (patient_uuid, review_month)
  where review_month is not null;
