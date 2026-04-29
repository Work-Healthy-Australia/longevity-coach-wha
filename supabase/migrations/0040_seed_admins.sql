-- Seed all existing profiles as admins.
-- At time of writing (2026-04-28) there are exactly two accounts in the database
-- and both belong to the founding team. Every current user should be an admin.
UPDATE public.profiles SET is_admin = true;
