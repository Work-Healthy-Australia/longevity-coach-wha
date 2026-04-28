-- Patient file uploads: Supabase Storage bucket + metadata table.
--
-- Storage path pattern: {user_uuid}/{upload_uuid}-{original_filename}
-- Folder-based RLS uses split_part(name, '/', 1) to isolate per-user.
--
-- Janet (Claude Opus 4.7) writes janet_* columns via service role.
-- Patients own select/insert/delete; no user UPDATE (Janet updates via service role).

-- ---------------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-uploads',
  'patient-uploads',
  false,
  52428800,  -- 50 MB
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/tiff',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Storage RLS policies (on storage.objects)
-- ---------------------------------------------------------------------------
drop policy if exists "uploads_owner_select" on storage.objects;
drop policy if exists "uploads_owner_insert" on storage.objects;
drop policy if exists "uploads_owner_delete" on storage.objects;
drop policy if exists "uploads_admin_select"  on storage.objects;

create policy "uploads_owner_select" on storage.objects
  for select using (
    bucket_id = 'patient-uploads'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "uploads_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'patient-uploads'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "uploads_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'patient-uploads'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "uploads_admin_select" on storage.objects
  for select using (
    bucket_id = 'patient-uploads'
    and (auth.jwt() ->> 'role') = 'admin'
  );

-- ---------------------------------------------------------------------------
-- patient_uploads metadata table
-- ---------------------------------------------------------------------------
create table if not exists public.patient_uploads (
  id                uuid        primary key default gen_random_uuid(),
  user_uuid         uuid        not null references auth.users(id) on delete cascade,
  storage_path      text        not null,
  original_filename text        not null,
  mime_type         text        not null,
  file_size_bytes   bigint      not null,
  -- Janet analysis output
  janet_status      text        not null default 'pending'
                    check (janet_status in ('pending', 'processing', 'done', 'error')),
  janet_category    text,       -- e.g. 'blood_work', 'imaging', 'genetic', 'microbiome', 'metabolic', 'other'
  janet_summary     text,
  janet_findings    jsonb,
  janet_error       text,
  janet_processed_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists patient_uploads_user_uuid_idx
  on public.patient_uploads(user_uuid);
create index if not exists patient_uploads_janet_status_idx
  on public.patient_uploads(janet_status);

alter table public.patient_uploads enable row level security;

drop policy if exists "uploads_meta_owner_select" on public.patient_uploads;
drop policy if exists "uploads_meta_owner_insert" on public.patient_uploads;
drop policy if exists "uploads_meta_owner_delete" on public.patient_uploads;
drop policy if exists "uploads_meta_admin_select"  on public.patient_uploads;

create policy "uploads_meta_owner_select" on public.patient_uploads
  for select using (auth.uid() = user_uuid);

create policy "uploads_meta_owner_insert" on public.patient_uploads
  for insert with check (auth.uid() = user_uuid);

-- No user UPDATE: Janet updates janet_* via service role only.
create policy "uploads_meta_owner_delete" on public.patient_uploads
  for delete using (auth.uid() = user_uuid);

create policy "uploads_meta_admin_select" on public.patient_uploads
  for select using ((auth.jwt() ->> 'role') = 'admin');

-- updated_at trigger (reuses set_updated_at() from 0001_init.sql)
drop trigger if exists set_updated_at_patient_uploads on public.patient_uploads;
create trigger set_updated_at_patient_uploads
  before update on public.patient_uploads
  for each row execute function public.set_updated_at();
