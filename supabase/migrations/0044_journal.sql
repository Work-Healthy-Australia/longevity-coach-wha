create table if not exists public.journal_entries (
  id          uuid        primary key default gen_random_uuid(),
  user_uuid   uuid        not null references auth.users(id) on delete cascade,
  body        text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.journal_entries enable row level security;

create policy "journal_owner" on public.journal_entries
  for all using (auth.uid() = user_uuid);

create index if not exists journal_entries_user_idx
  on public.journal_entries (user_uuid, created_at desc);
