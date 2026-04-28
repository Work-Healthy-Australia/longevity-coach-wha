-- Migration 0021: deterministic supplement catalog
-- Curated, evidence-tagged catalog read by the supplement recommender.
-- Idempotent.

create table if not exists public.supplement_catalog (
  id              uuid primary key default gen_random_uuid(),
  sku             text unique not null,
  display_name    text not null,
  canonical_dose  text not null,
  timing_default  text,
  evidence_tag    text not null check (evidence_tag in ('A','B','C')),
  domain          text not null check (domain in ('cardiovascular','metabolic','neurodegenerative','oncological','musculoskeletal','general')),
  triggers_when   jsonb not null default '{}',
  contraindicates jsonb not null default '[]',
  cost_aud_month  numeric(6,2),
  supplier_sku_au text,
  notes           text,
  created_at      timestamptz not null default now()
);

alter table public.supplement_catalog enable row level security;

drop policy if exists "catalog_read_authenticated" on public.supplement_catalog;
create policy "catalog_read_authenticated" on public.supplement_catalog
  for select to authenticated using (true);
-- Service-role bypasses RLS by default; that handles the seed and admin writes.
