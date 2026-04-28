-- Migration 0021: fix hybrid_search_health to accept NULL query_vec (BM25-only fallback)
-- When query_vec is NULL: pure BM25 keyword search.
-- When query_vec is provided and rows have non-null embeddings: hybrid RRF fusion.

create or replace function public.hybrid_search_health(
  query_text  text,
  query_vec   vector(2560) DEFAULT NULL,
  match_count int          DEFAULT 5,
  sem_weight  float        DEFAULT 1.0,
  kw_weight   float        DEFAULT 1.0
)
returns table (id uuid, content text, metadata jsonb, score float)
language plpgsql
security definer
set search_path = public
as $$
begin
  if query_vec is null then
    -- BM25-only: no embedding required (works immediately with seeded content)
    return query
      select hk.id, hk.content, hk.metadata,
             ts_rank_cd(hk.fts, plainto_tsquery(query_text))::float as score
      from public.health_knowledge hk
      where hk.fts @@ plainto_tsquery(query_text)
      order by score desc
      limit match_count;
  else
    -- Hybrid RRF: semantic + keyword fusion
    return query
      with semantic as (
        select hk.id,
               row_number() over (order by hk.embedding <=> query_vec) as rank
        from public.health_knowledge hk
        where hk.embedding is not null
        limit match_count * 2
      ),
      keyword as (
        select hk.id,
               row_number() over (
                 order by ts_rank_cd(hk.fts, plainto_tsquery(query_text)) desc
               ) as rank
        from public.health_knowledge hk
        where hk.fts @@ plainto_tsquery(query_text)
        limit match_count * 2
      ),
      fused as (
        select coalesce(s.id, k.id) as id,
               (coalesce(sem_weight / (60.0 + s.rank), 0.0) +
                coalesce(kw_weight  / (60.0 + k.rank), 0.0)) as score
        from semantic s full outer join keyword k on s.id = k.id
      )
      select hk.id, hk.content, hk.metadata, f.score
      from fused f join public.health_knowledge hk on hk.id = f.id
      order by f.score desc
      limit match_count;
  end if;
end;
$$;
