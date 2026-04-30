-- pgvector extension — vector similarity search
-- Used by: public.health_knowledge (vector(2560) column + HNSW index)
-- Formalized in migration 0055; assumed by migration 0016.

create extension if not exists vector with schema extensions;
