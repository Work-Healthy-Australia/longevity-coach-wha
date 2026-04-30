-- Allow historical risk score rows so the report can show diffs.
--
-- Changes the unique constraint from (user_uuid) to (user_uuid, assessment_date)
-- so each assessment date gets its own row. Same-day pipeline reruns upsert to
-- the same row; different days create new rows, enabling progress tracking.
--
-- The report page already queries ORDER BY assessment_date DESC LIMIT 2.

ALTER TABLE public.risk_scores
  DROP CONSTRAINT IF EXISTS risk_scores_user_uuid_key;

ALTER TABLE public.risk_scores
  ADD CONSTRAINT risk_scores_user_uuid_assessment_date_key
  UNIQUE (user_uuid, assessment_date);
