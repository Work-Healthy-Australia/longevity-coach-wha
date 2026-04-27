-- Adds postal address to profiles. PII columns belong on profiles (not in
-- health_profiles.responses JSONB) so they can be Vault-migrated later and
-- so right-to-erasure is a single-row scrub.

alter table public.profiles
  add column if not exists address_postal text;
