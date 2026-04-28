---
name: multi-agent-dev
description: Dispatch isolated subagents to implement tasks in parallel with two-stage review (spec compliance then code quality) per task. Use after a plan exists. Project-level wrapper of superpowers:subagent-driven-development adapted for Longevity Coach conventions.
---

This skill executes an implementation plan by dispatching a fresh subagent per task, reviewing each before moving on, then running a final review across the whole implementation.

For the full reference, invoke `superpowers:subagent-driven-development`. The instructions below add project-specific context on top of it.

---

## When to use

- You have a written plan (in `docs/engineering/changes/<change>/PLAN.md` or equivalent)
- Tasks are mostly independent of each other
- You want review gates between tasks, not just at the end

If you do not have a plan yet, use the `dev-loop` skill instead — it covers assess → research → plan → delegate → document.

---

## Project conventions for subagents

When dispatching implementer subagents on this project, always include:

**Codebase context to provide:**
- The relevant `.claude/rules/` files for the domain being touched (data-management, nextjs-conventions, database, security, ai-agents)
- The relevant phase doc from `docs/product/` if the task implements a user story
- The route group the work belongs to (`(app)`, `(auth)`, `(public)`, `(admin)`)
- Whether the task touches the PII boundary (if yes, require `lib/profiles/pii-split.ts` to be read first)

**Build order to enforce:**
1. Migration first (if schema changes) — use the `new-migration` skill rules
2. Type regeneration: `supabase gen types typescript --local > lib/supabase/database.types.ts`
3. Server action / API route
4. UI component
5. `proxy.ts` update (if new protected route)
6. Tests

**Completion gate for every task:**
- `pnpm build` must pass (no TypeScript errors)
- `pnpm test` must pass
- No PII placed outside `profiles`

---

## Spec reviewer checklist (project-specific)

In addition to general spec compliance, the spec reviewer must confirm:

- [ ] No derived data stored (age, first name, last name computed at read time)
- [ ] No PII keys inside `health_profiles.responses` JSONB
- [ ] New tables have RLS enabled
- [ ] The correct Supabase client is used (browser vs server vs admin)
- [ ] `proxy.ts` updated if a new authenticated route was added

---

## Code quality reviewer checklist (project-specific)

In addition to general quality, the code quality reviewer must confirm:

- [ ] No hard-coded Stripe price IDs or Supabase URLs
- [ ] Error paths return user-safe messages (no internal detail to client)
- [ ] Server actions validate inputs before writing to DB
- [ ] Stripe webhook route has no body-parsing middleware
- [ ] No `console.log` of patient data, tokens, or API keys

---

## After all tasks pass review

Run `superpowers:finishing-a-development-branch` and then write the handoff documents into the change folder:

```
docs/engineering/changes/<change-name>/
  PLAN.md              (already written before this skill ran)
  CHANGELOG.md         (what was actually built, diff from plan)
  QA_REPORT.md         (test results, reviewer findings, any deferred issues)
  EXECUTIVE_SUMMARY.md (one-page plain-English summary for James)
```

Or use the `dev-loop` skill — it handles documentation automatically at the end.
