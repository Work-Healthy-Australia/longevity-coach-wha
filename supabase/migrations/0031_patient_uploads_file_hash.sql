-- Migration 0031: add file_hash to patient_uploads for upload deduplication
-- SHA-256 hex digest of the raw file bytes, computed client-side.
-- Nullable so pre-existing rows are unaffected.
-- Partial unique index (WHERE file_hash IS NOT NULL) ensures legacy nulls never conflict.

alter table public.patient_uploads
  add column if not exists file_hash text;

create unique index if not exists patient_uploads_user_hash_uidx
  on public.patient_uploads(user_uuid, file_hash)
  where file_hash is not null;
