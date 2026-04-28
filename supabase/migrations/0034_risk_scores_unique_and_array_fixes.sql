-- Fixes for risk_scores to support runtime upsert and array output.
--
-- 1. Unique constraint on user_uuid so that upsert(onConflict: 'user_uuid') resolves
--    correctly. Without a unique constraint PostgreSQL rejects the ON CONFLICT clause.
--
-- 2. next_recommended_tests promoted to text[] to match EngineOutput.next_recommended_tests.
--    Existing text rows are wrapped into a single-element array.

-- Unique constraint
ALTER TABLE public.risk_scores
  DROP CONSTRAINT IF EXISTS risk_scores_user_uuid_key;

ALTER TABLE public.risk_scores
  ADD CONSTRAINT risk_scores_user_uuid_key UNIQUE (user_uuid);

-- next_recommended_tests: text → text[]
-- IF it is still text, convert; IF already text[], this is a no-op guard via a function.
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'risk_scores'
        AND column_name = 'next_recommended_tests') = 'text' THEN
    ALTER TABLE public.risk_scores
      ALTER COLUMN next_recommended_tests TYPE text[]
      USING CASE
        WHEN next_recommended_tests IS NULL THEN NULL
        ELSE ARRAY[next_recommended_tests]
      END;
  END IF;
END $$;
