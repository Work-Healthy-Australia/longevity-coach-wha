-- Canonical schema: billing.b2b_plan_tier_allocations
-- Last updated: migration 0052_pricing_admin_foundation

create table if not exists billing.b2b_plan_tier_allocations (
  id          uuid        primary key default gen_random_uuid(),
  b2b_plan_id uuid        not null references billing.b2b_plans(id) on delete cascade,
  plan_id     uuid        not null references billing.plans(id),
  seat_count  int         not null check (seat_count >= 1),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (b2b_plan_id, plan_id)
);

create index if not exists b2b_alloc_plan_id_idx on billing.b2b_plan_tier_allocations(b2b_plan_id);

alter table billing.b2b_plan_tier_allocations enable row level security;

create policy "admin full access" on billing.b2b_plan_tier_allocations
  using     ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

drop trigger if exists b2b_plan_tier_allocations_set_updated_at on billing.b2b_plan_tier_allocations;
create trigger b2b_plan_tier_allocations_set_updated_at
  before update on billing.b2b_plan_tier_allocations
  for each row execute function public.set_updated_at();
