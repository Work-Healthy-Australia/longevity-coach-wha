-- Canonical schema: billing.feature_keys
-- Last updated: migration 0052_pricing_admin_foundation

create table if not exists billing.feature_keys (
  key           text        primary key,
  label         text        not null,
  description   text,
  tier_affinity text        not null check (tier_affinity in ('core','clinical','elite')),
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table billing.feature_keys enable row level security;

create policy "admin full access" on billing.feature_keys
  using     ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

drop trigger if exists feature_keys_set_updated_at on billing.feature_keys;
create trigger feature_keys_set_updated_at
  before update on billing.feature_keys
  for each row execute function public.set_updated_at();
