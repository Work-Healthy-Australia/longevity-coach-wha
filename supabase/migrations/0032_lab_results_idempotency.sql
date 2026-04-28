-- 0032_lab_results_idempotency.sql
-- Idempotent re-upload guard. One row per (user, biomarker, test_date)
-- when test_date is known; rows without a test_date can repeat (we don't
-- have enough info to dedupe them). The non-unique index from 0009 is
-- kept for existing query patterns; this adds a unique partial index
-- alongside it.
create unique index if not exists lab_results_user_biomarker_date_unique
  on biomarkers.lab_results(user_uuid, biomarker, test_date)
  where test_date is not null;
