-- Migration 0016: pgvector knowledge base for Janet RAG
--
-- PREREQUISITE: Enable the pgvector extension BEFORE applying this migration.
--   Supabase Dashboard → Database → Extensions → vector → Enable
--
-- health_updates was created in migration 0015.
-- This migration adds health_knowledge (vector embeddings) and hybrid_search_health().
--
-- Writer: Nova research pipeline (service_role only). Content is generic — not user-specific.
-- health_knowledge is service_role read-only (queried via hybrid_search_health() function).

-- ============================================================================
-- health_updates — structured research digests
-- ============================================================================

-- ============================================================================
-- health_knowledge — pgvector knowledge chunks
-- ============================================================================

create table if not exists public.health_knowledge (
  id         uuid        primary key default gen_random_uuid(),
  content    text        not null,
  embedding  vector(2560),
  metadata   jsonb,
  -- metadata shape: { source: url, category: string, evidence_level: string,
  --                   digest_id: uuid, published_at: date }
  fts        tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now()
);

-- HNSW index for fast approximate nearest-neighbour search
-- m=16 and ef_construction=64: good recall/speed tradeoff, low build time
create index if not exists health_knowledge_hnsw_idx
  on public.health_knowledge using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- GIN index for full-text keyword search
create index if not exists health_knowledge_fts_idx
  on public.health_knowledge using gin (fts);

create index if not exists health_knowledge_created_idx
  on public.health_knowledge(created_at);

alter table public.health_knowledge enable row level security;

drop policy if exists "health_knowledge_service_all"  on public.health_knowledge;
drop policy if exists "health_knowledge_admin_select" on public.health_knowledge;

-- Only service_role can read/write health_knowledge directly.
-- All application access goes through hybrid_search_health() function below.
create policy "health_knowledge_service_all" on public.health_knowledge
  for all using (auth.role() = 'service_role');

create policy "health_knowledge_admin_select" on public.health_knowledge
  for select using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

-- ============================================================================
-- hybrid_search_health — RRF fusion (semantic + keyword)
-- ============================================================================
-- Called by Janet PatientContext.load() inside Promise.all.
-- Target: < 30 ms (runs in parallel with other DB reads, zero sequential overhead).
-- Security: SECURITY DEFINER so authenticated users can call it without
-- direct access to health_knowledge rows.

create or replace function public.hybrid_search_health(
  query_text  text,
  query_vec   vector(2560),
  match_count int     default 5,
  sem_weight  float   default 1.0,
  kw_weight   float   default 1.0
)
returns table (id uuid, content text, metadata jsonb, score float)
language sql
security definer
set search_path = public
as $$
  with semantic as (
    select id,
           row_number() over (order by embedding <=> query_vec) as rank
    from public.health_knowledge
    limit match_count * 2
  ),
  keyword as (
    select id,
           row_number() over (
             order by ts_rank_cd(fts, plainto_tsquery(query_text)) desc
           ) as rank
    from public.health_knowledge
    where fts @@ plainto_tsquery(query_text)
    limit match_count * 2
  ),
  fused as (
    select coalesce(s.id, k.id) as id,
           (coalesce(sem_weight / (60 + s.rank), 0.0) +
            coalesce(kw_weight  / (60 + k.rank), 0.0)) as score
    from semantic s full outer join keyword k on s.id = k.id
  )
  select hk.id, hk.content, hk.metadata, f.score
  from fused f join public.health_knowledge hk on hk.id = f.id
  order by f.score desc
  limit match_count;
$$;
