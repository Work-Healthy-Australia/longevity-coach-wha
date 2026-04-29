-- Canonical schema: billing.b2b_plan_product_inclusions
-- Last updated: migration 0052_pricing_admin_foundation

create table if not exists billing.b2b_plan_product_inclusions (
  id                   uuid        primary key default gen_random_uuid(),
  b2b_plan_id          uuid        not null references billing.b2b_plans(id) on delete cascade,
  allocation_id        uuid        not null references billing.b2b_plan_tier_allocations(id) on delete cascade,
  product_id           uuid        not null references billing.products(id),
  quantity             int         not null default 1 check (quantity >= 1),
  frequency            text        not null default 'annually'
                       check (frequency in ('monthly','quarterly','annually','once_off','per_participant')),
  wholesale_cost_cents int         not null default 0,
  client_price_cents   int         not null default 0,
  is_visible_to_client boolean     not null default true,
  client_description   text,
  internal_notes       text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (b2b_plan_id, allocation_id, product_id)
);

create index if not exists b2b_prod_incl_plan_idx  on billing.b2b_plan_product_inclusions(b2b_plan_id);
create index if not exists b2b_prod_incl_alloc_idx on billing.b2b_plan_product_inclusions(allocation_id);

alter table billing.b2b_plan_product_inclusions enable row level security;

create policy "admin full access" on billing.b2b_plan_product_inclusions
  using     ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

drop trigger if exists b2b_plan_product_inclusions_set_updated_at on billing.b2b_plan_product_inclusions;
create trigger b2b_plan_product_inclusions_set_updated_at
  before update on billing.b2b_plan_product_inclusions
  for each row execute function public.set_updated_at();
