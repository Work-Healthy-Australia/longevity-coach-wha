-- Add routines_completed column to daily_logs for habit tracking,
-- and wearable_sync_enabled to profiles for Apple Health integration.

ALTER TABLE biomarkers.daily_logs
  ADD COLUMN IF NOT EXISTS routines_completed text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN biomarkers.daily_logs.routines_completed
  IS 'Array of routine item IDs completed today (morning_hydration, workout, etc.)';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wearable_sync_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wearable_provider text;

COMMENT ON COLUMN public.profiles.wearable_sync_enabled
  IS 'Whether the user has connected a wearable device for auto-sync';
COMMENT ON COLUMN public.profiles.wearable_provider
  IS 'Connected wearable provider: apple_health, garmin, fitbit, oura, whoop';
