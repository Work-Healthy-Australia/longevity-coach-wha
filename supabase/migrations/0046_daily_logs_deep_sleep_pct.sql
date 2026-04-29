-- 0041_daily_logs_deep_sleep_pct.sql
-- Adds deep_sleep_pct column to biomarkers.daily_logs for the bio-age engine
-- (estimateBiologicalAge consumes wearable_data.avg_deep_sleep_pct, weight 0.06).
-- Members can self-report from a wearable each morning via the daily check-in
-- form. Optional, 0–100 range.

alter table biomarkers.daily_logs
  add column if not exists deep_sleep_pct numeric(5,2);
