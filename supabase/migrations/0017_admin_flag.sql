-- Add is_admin flag to profiles for admin CRM access control.
-- Set to true manually via Supabase Dashboard for James's account.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
