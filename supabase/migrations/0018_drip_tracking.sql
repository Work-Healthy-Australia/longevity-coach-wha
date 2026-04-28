-- Track which drip emails have been sent per user to prevent re-sends.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS drip_day1_sent_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS drip_day3_sent_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS drip_day7_sent_at timestamptz;
