-- Add pipeline tracking to existing meal_plans table
alter table public.meal_plans
  add column if not exists last_run_at     timestamptz,
  add column if not exists last_run_status text
    check (last_run_status in ('pending', 'completed', 'failed'));

-- Recipes — one row per meal per day in the weekly plan
create table if not exists public.recipes (
  id                    uuid        primary key default gen_random_uuid(),
  meal_plan_id          uuid        not null references public.meal_plans(id) on delete cascade,
  patient_uuid          uuid        not null references auth.users(id) on delete cascade,
  name                  text        not null,
  meal_type             text        not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  day_of_week           int         not null check (day_of_week between 1 and 7),
  macros                jsonb       not null,
  ingredients           jsonb       not null,
  instructions          text[]      not null default '{}',
  source_url            text,
  is_bloodwork_optimised boolean    not null default false,
  created_at            timestamptz not null default now()
);

create index if not exists recipes_meal_plan_idx on public.recipes(meal_plan_id);
create index if not exists recipes_patient_idx   on public.recipes(patient_uuid);

alter table public.recipes enable row level security;

create policy "recipes_patient_select" on public.recipes
  for select using (auth.uid() = patient_uuid);
create policy "recipes_service_insert" on public.recipes
  for insert with check (auth.role() = 'service_role');
create policy "recipes_service_delete" on public.recipes
  for delete using (auth.role() = 'service_role');

-- Shopping lists — one per meal plan (replaced on each run)
create table if not exists public.shopping_lists (
  id           uuid        primary key default gen_random_uuid(),
  meal_plan_id uuid        not null references public.meal_plans(id) on delete cascade,
  patient_uuid uuid        not null references auth.users(id) on delete cascade,
  week_start   date        not null,
  items        jsonb       not null,
  generated_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (meal_plan_id)
);

create index if not exists shopping_lists_patient_idx on public.shopping_lists(patient_uuid);

alter table public.shopping_lists enable row level security;

create policy "shopping_lists_patient_select" on public.shopping_lists
  for select using (auth.uid() = patient_uuid);
create policy "shopping_lists_service_write" on public.shopping_lists
  for all using (auth.role() = 'service_role');
