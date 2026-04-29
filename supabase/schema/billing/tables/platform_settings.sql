-- Canonical schema: billing.platform_settings
-- Last updated: migration 0052_pricing_admin_foundation

create table if not exists billing.platform_settings (
  key         text        primary key,
  value       text        not null,
  description text,
  updated_at  timestamptz not null default now()
);

alter table billing.platform_settings enable row level security;

create policy "admin full access" on billing.platform_settings
  using     ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

drop trigger if exists platform_settings_set_updated_at on billing.platform_settings;
create trigger platform_settings_set_updated_at
  before update on billing.platform_settings
  for each row execute function public.set_updated_at();
