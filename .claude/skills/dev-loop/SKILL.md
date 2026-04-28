---
name: dev-loop
description: Full accurate development loop for Longevity Coach: assess → research → plan → review plan → delegate to subagents (each does plan → execute → test → handoff) → collect handoffs → QA report → document change under docs/engineering/changes/. Use for any non-trivial feature, fix, or architectural change.
---

This skill runs the full development loop from a vague instruction or user story to a documented, tested, merged change. It is the standard way to ship work on this project.

---

## Overview

```
ASSESS
  └── RESEARCH
        └── PLAN
              └── REVIEW PLAN
                    └── SUBAGENT DELEGATION (parallel or sequential)
                          Each subagent: PLAN → EXECUTE → TEST → HANDOFF
                    └── COLLECT HANDOFFS
                          └── QA REPORT
                                └── DOCUMENT CHANGE
```

---

## Phase 1 — Assess

**Goal:** Understand exactly what needs to be done and why before touching any code.

Steps:
1. Read the user's request carefully. Identify the phase it belongs to in `docs/product/01-product-timeline.md`.
2. Check `docs/features/` for an existing spec. If a spec exists, read it. If not and the work is non-trivial, write a brief proposal first.
3. State in one sentence: *"We are building X, which is part of Phase Y, and the outcome is Z."*
4. Flag any ambiguity or missing information and resolve it with the user before continuing.

**Do not proceed to Research until the scope is unambiguous.**

---

## Phase 2 — Research

**Goal:** Build a complete picture of the codebase and constraints before writing the plan.

Steps:
1. Read all relevant `.claude/rules/` files for the domains this change touches.
2. Read the relevant phase doc from `docs/product/` to understand which user stories are in scope.
3. Explore the affected code areas — server actions, DB schema, route groups, existing lib modules.
4. Check `supabase/migrations/` for the current migration number and schema state.
5. Check `lib/supabase/database.types.ts` to understand what types already exist.
6. Note all constraints from the rules files that apply to this change.

**Output of this phase:** A written summary of findings (3–10 bullet points) that the plan will be built on.

---

## Phase 3 — Plan

**Goal:** Produce a detailed, task-by-task implementation plan that can be executed by subagents.

Write the plan to:
```
docs/engineering/changes/<change-name>/PLAN.md
```

Name the change folder using kebab-case with the date prefix: `YYYY-MM-DD-<description>` (e.g. `2026-04-28-risk-engine-port`).

**Plan structure:**

```markdown
# Plan: <change name>
Date: YYYY-MM-DD
Phase: <product phase>
Status: Draft

## Objective
One paragraph: what is being built, why, and what done looks like.

## Scope
- In scope: bullet list
- Out of scope: bullet list

## Data model changes
List any new tables, columns, or JSONB keys. For each: is it PII? typed column? JSONB? Who writes to it?

## Tasks
### Task 1 — <name>
Files affected: list
What to build: detailed description
Acceptance criteria: bullet list (testable)
Rules to apply: list relevant .claude/rules/ files

### Task 2 — ...
```

Each task must be self-contained enough for a subagent to execute without reading the full plan.

---

## Phase 4 — Review Plan

**Goal:** Validate the plan is sound before any code is written.

Dispatch a plan-reviewer subagent with:
- The full text of `PLAN.md`
- The relevant `.claude/rules/` files
- The relevant `docs/product/` phase document

The reviewer must confirm:
- [ ] Every task has clear acceptance criteria
- [ ] No task assumes knowledge not provided in its description
- [ ] Data model decisions satisfy `.claude/rules/data-management.md` (PII boundary, single source of truth, typed vs JSONB)
- [ ] Build order is correct (migrations before server actions before UI)
- [ ] No tasks build ahead of the current product phase without sign-off
- [ ] Security requirements from `.claude/rules/security.md` are addressed

**Do not start implementation until the plan reviewer gives a written approval.**

If the reviewer finds issues, revise the plan and re-review.

---

## Phase 5 — Subagent Delegation

**Goal:** Implement each plan task using an isolated subagent that cannot pollute the coordinator's context.

Dispatch tasks **sequentially** unless they are truly independent (no shared files, no migration dependency). When in doubt, run sequentially.

### Each subagent receives

Provide **all** of the following in the subagent prompt — do not ask the subagent to read files:

- Full text of their task from the plan (copy-pasted, not a file path)
- Full text of relevant `.claude/rules/` files for their domain
- Codebase map from `CLAUDE.md` (relevant sections only)
- Current migration number and any new migrations from earlier tasks
- Any handoff notes from previous tasks that affect this one

### Each subagent follows this internal loop

```
PLAN      Read task. Ask clarifying questions before writing any code.
EXECUTE   Write migrations first, then server logic, then UI.
TEST      pnpm build must pass. pnpm test must pass. Add new tests if needed.
HANDOFF   Return: status (DONE / DONE_WITH_CONCERNS / BLOCKED), files changed,
          test results, any deferred items, migration number if applicable.
```

### After each subagent completes

Run two reviews before moving to the next task:

**Review 1 — Spec compliance** (dispatch a spec-reviewer subagent):
- Does the implementation match the task's acceptance criteria exactly?
- Nothing missing. Nothing extra.
- If issues found: implementer subagent fixes them. Re-review.

**Review 2 — Code quality** (dispatch a code-quality-reviewer subagent):
- Project rules satisfied (see `multi-agent-dev` skill checklist)
- No PII outside `profiles`. No derived data stored. RLS on new tables.
- `pnpm build` and `pnpm test` confirmed passing.
- If issues found: implementer subagent fixes them. Re-review.

Only mark a task complete in TodoWrite when both reviews are ✅.

---

## Phase 6 — Collect Handoffs

**Goal:** Synthesise what was built across all tasks before writing the documentation.

For each completed task, record:
- Files created or modified
- Migration applied (number and description)
- Tests added
- Any deferred items or open concerns flagged by the subagent
- Any deviations from the original plan and why

---

## Phase 7 — QA Report

**Goal:** Independent quality gate across the full change, not just per-task.

Dispatch a final QA subagent with:
- The full `PLAN.md`
- All handoff summaries from Phase 6
- Instruction to run `pnpm build` and `pnpm test` and report results

The QA subagent writes `docs/engineering/changes/<change-name>/QA_REPORT.md`:

```markdown
# QA Report: <change name>
Date: YYYY-MM-DD
Reviewer: QA subagent

## Build status
pnpm build: PASS / FAIL
pnpm test: PASS (N tests) / FAIL

## Test results
| Suite | Tests | Pass | Fail | Skipped |
...

## Findings
### Confirmed working
...
### Deferred items
...
### Known limitations
...

## Verdict
APPROVED / BLOCKED (reason)
```

Do not proceed to documentation if the verdict is BLOCKED. Fix the issues first.

---

## Phase 8 — Document Change

**Goal:** Leave a permanent, navigable record of what changed and why.

Write the following three files into the change folder:

### `docs/engineering/changes/<change-name>/CHANGELOG.md`

```markdown
# Changelog: <change name>
Date: YYYY-MM-DD
Phase: <product phase>

## What was built
Bullet list of features, routes, server actions, and migrations added.

## What changed
Bullet list of modified files and the nature of each change.

## Migrations applied
- NNNN_description.sql — what it does

## Deviations from plan
Any tasks that were cut, changed in scope, or implemented differently than planned, and why.

## Known gaps / deferred items
Anything deliberately left out with a note on when it should be addressed.
```

### `docs/engineering/changes/<change-name>/EXECUTIVE_SUMMARY.md`

```markdown
# Executive Summary: <change name>
Date: YYYY-MM-DD
Audience: Product owner, clinical advisor

## What was delivered
One paragraph. Plain English. No technical terms. Describe what members or staff can now do that they could not do before.

## What phase this advances
Which epics from docs/product/ are now complete or partially complete.

## What comes next
The next logical step in the roadmap, and any decisions needed from the product owner before work can continue.

## Risks or open items
Anything that requires a decision, monitoring, or follow-up action.
```

### Update `docs/product/` phase documents

For each user story that is now fully implemented, update the relevant phase document to mark it complete.

---

## Change folder final structure

```
docs/engineering/changes/<change-name>/
  PLAN.md              Written in Phase 3, revised through Phase 4
  CHANGELOG.md         Written in Phase 8
  QA_REPORT.md         Written in Phase 7
  EXECUTIVE_SUMMARY.md Written in Phase 8
```

---

## Rules that apply throughout

- Never start implementation before the plan reviewer approves
- Never mark a task done before both spec and quality reviews pass
- Never store PII outside `profiles`
- Never proceed to documentation if QA verdict is BLOCKED
- The EXECUTIVE_SUMMARY must be readable by a non-technical product owner — no code, no jargon
