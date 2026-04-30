-- Journal enhancements: title, mood, tags, pin, full-text search
-- Adds optional metadata columns and FTS to journal_entries.

alter table public.journal_entries
  add column if not exists title     text,
  add column if not exists mood      text check (mood in ('great','good','okay','low','bad')),
  add column if not exists tags      text[] not null default '{}',
  add column if not exists is_pinned boolean not null default false;

-- Full-text search column (generated)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'journal_entries'
      and column_name = 'fts'
  ) then
    alter table public.journal_entries
      add column fts tsvector generated always as (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
      ) stored;
  end if;
end$$;

-- Indexes
create index if not exists journal_entries_tags_idx
  on public.journal_entries using gin (tags);

create index if not exists journal_entries_fts_idx
  on public.journal_entries using gin (fts);

create index if not exists journal_entries_pinned_idx
  on public.journal_entries (user_uuid, is_pinned desc, created_at desc);
