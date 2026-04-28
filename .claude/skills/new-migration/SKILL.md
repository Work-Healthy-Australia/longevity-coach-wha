---
name: new-migration
description: Step-by-step workflow for adding a Supabase database migration in the Longevity Coach project. Covers naming, idempotency, RLS, type regeneration, and documentation.
---

Use this workflow whenever adding or modifying database schema.

## Step 1 — Read the rules first

Read `.claude/rules/data-management.md` and `.claude/rules/database.md` before writing any SQL.

Key questions to answer before writing a single line:
- Does this column belong on `profiles` (PII), as a typed column (queryable), or JSONB (opaque)?
- Which schema does this table belong in: `public`, `biomarkers`, or `billing`?
- Who is the primary writer for this table?

## Step 2 — Name and number the file

```
supabase/migrations/NNNN_short_description.sql
```

Check `supabase/migrations/` to find the current highest number. NNNN must be the next sequential number.

## Step 3 — Write idempotent SQL

Every statement must use `IF NOT EXISTS`, `IF EXISTS`, or `ON CONFLICT DO NOTHING` so the migration can be replayed safely.

```sql
-- Correct
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;

-- Wrong — will fail on re-run
ALTER TABLE profiles ADD COLUMN welcome_email_sent_at timestamptz;
```

## Step 4 — Include RLS on every new table

Every new table needs all three:

1. `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;`
2. A SELECT policy scoped to the owning user: `USING (auth.uid() = user_uuid)`
3. An INSERT policy if users write directly; no UPDATE/DELETE for service-written tables

## Step 5 — Test locally

```bash
supabase db reset        # replay all migrations from scratch
supabase db diff         # verify the generated diff matches your intent
```

Fix any issues before committing.

## Step 6 — Regenerate TypeScript types

```bash
supabase gen types typescript --local > lib/supabase/database.types.ts
```

Commit the updated `database.types.ts` alongside the migration file. Never let the types drift from the schema.

## Step 7 — Update schema documentation

If the migration adds a new table or materially changes the schema, update `docs/architecture/database-schema.md` to reflect it.
