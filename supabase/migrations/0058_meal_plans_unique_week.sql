-- Adds the unique constraint that the meal-plan pipeline upsert assumes.
-- Without this, `upsert(..., { onConflict: 'patient_uuid,valid_from' })` errors
-- with "ON CONFLICT specification requires a unique or exclusion constraint",
-- so the pipeline cannot persist generated plans.
--
-- Invariant: one meal plan per patient per week_start (valid_from).

-- 1. De-duplicate any pre-existing rows that would block index creation.
--    Keep the most recently updated row per (patient_uuid, valid_from);
--    delete older copies. Cascades to recipes/shopping_lists via FK.
with ranked as (
  select
    id,
    row_number() over (
      partition by patient_uuid, valid_from
      order by updated_at desc nulls last, created_at desc nulls last, id
    ) as rn
  from public.meal_plans
  where valid_from is not null
)
delete from public.meal_plans
where id in (select id from ranked where rn > 1);

-- 2. Add the unique index. Postgres treats NULLs as distinct, so rows with
--    valid_from = null remain unconstrained — that is intentional (drafts
--    without a chosen week should not collide).
create unique index if not exists meal_plans_patient_valid_from_uniq
  on public.meal_plans (patient_uuid, valid_from);
