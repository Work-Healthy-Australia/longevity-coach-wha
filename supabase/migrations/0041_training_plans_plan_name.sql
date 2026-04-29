alter table public.training_plans
  add column if not exists plan_name text,
  add column if not exists plan_start_date date;

create unique index if not exists training_plans_patient_month_uidx
  on public.training_plans (patient_uuid, plan_start_date)
  where plan_start_date is not null;
