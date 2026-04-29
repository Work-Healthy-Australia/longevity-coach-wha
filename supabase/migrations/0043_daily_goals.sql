alter table public.profiles
  add column if not exists daily_goals jsonb;
