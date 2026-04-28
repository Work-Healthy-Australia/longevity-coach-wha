---
name: new-feature
description: Step-by-step workflow for starting any new product feature in the Longevity Coach project. Covers roadmap validation, data model decisions, build order, and completion checklist.
---

Use this workflow when starting any new product feature.

## Step 1 — Check the roadmap

Open `docs/product/01-product-timeline.md` and confirm the feature belongs to the current active phase. If it is from a future phase, get product owner sign-off before proceeding.

## Step 2 — Check for an existing feature spec

Look in `docs/features/` for a proposal document for this feature. If one exists, read it before writing any code.

If no spec exists and the feature is non-trivial (more than one day of work), write a brief proposal in `docs/features/<feature-name>/feature-proposal.md` first and confirm scope before building.

## Step 3 — Identify database changes

Read `.claude/rules/data-management.md`. For each new piece of data:
- Is it PII? → `profiles` table only
- Is it queryable? → typed column
- Is it opaque/schema-less? → JSONB in the appropriate table
- Which component owns writes to this table?

If a new table or column is needed, write the migration before writing application code. Use the `new-migration` skill.

## Step 4 — Identify the execution model

If the feature involves AI:
- Real-time user conversation → agent model
- Expensive computation, pre-computed results → pipeline worker model
- Read `.claude/rules/ai-agents.md` before writing any AI code

## Step 5 — Build in this order

1. Database migration (if needed)
2. Supabase type regeneration
3. Server action / API route
4. UI component
5. Route registration in `proxy.ts` (if a new protected route)
6. Tests

## Step 6 — Before marking complete

- [ ] `pnpm build` passes with no TypeScript errors
- [ ] `pnpm test` passes
- [ ] New protected routes are registered in `proxy.ts`
- [ ] Any new PII handling reviewed against `.claude/rules/security.md`
- [ ] `.env.example` updated if new env vars are introduced
- [ ] Relevant epic in `docs/product/` marked complete if the user story is done
