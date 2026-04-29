-- Canonical schema: billing.tier_inclusions
-- Last updated: migration 0052_pricing_admin_foundation

create table if not exists billing.tier_inclusions (
  id                     uuid        primary key default gen_random_uuid(),
  plan_id                uuid        not null references billing.plans(id) on delete cascade,
  janet_service_id       uuid        not null references billing.janet_services(id),
  quantity               int         not null default 1 check (quantity >= 1),
  frequency              text        not null default 'monthly'
                         check (frequency in ('monthly','quarterly','annually','once_off','per_participant')),
  wholesale_cost_cents   int         not null default 0,
  retail_value_cents     int         not null default 0,
  is_visible_to_customer boolean     not null default true,
  customer_description   text,
  internal_notes         text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (plan_id, janet_service_id)
);

create index if not exists tier_inclusions_plan_id_idx on billing.tier_inclusions(plan_id);

alter table billing.tier_inclusions enable row level security;

create policy "admin full access" on billing.tier_inclusions
  using     ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

drop trigger if exists tier_inclusions_set_updated_at on billing.tier_inclusions;
create trigger tier_inclusions_set_updated_at
  before update on billing.tier_inclusions
  for each row execute function public.set_updated_at();
