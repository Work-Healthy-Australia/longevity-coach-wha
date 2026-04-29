# Plan: epic-status Skill
Date: 2026-04-29
Phase: Cross-cutting (tooling — no phase gating)
Status: Design complete — pending implementation

## Objective

Build a Claude skill (`epic-status`) that creates and maintains two paired product docs:
- `docs/product/epics.md` — stable strategy layer (thesis / bundle / mechanism / success criterion per epic)
- `docs/product/epic-status.md` — live status layer (pipeline stages, % estimates, shipped/outstanding/bugs)

The skill eliminates manual doc drift by reading ground-truth sources (CHANGELOGs, git log, file existence) and writing accurate updates without human curation.

## Scope

**In scope:**
- `SKILL.md` at `~/.claude/skills/epic-status/` (global) and `.claude/skills/epic-status/` (project copy)
- Two modes: CREATE (no existing epics) and UPDATE (existing epics.md found)
- UPDATE reads sources in priority order: CHANGELOG.md files → git log → file existence → full scan
- CREATE supports fresh projects and reference-clone from an existing epics.md structure
- Guard rails: never marks shipped without evidence; proposes all changes before writing

**Out of scope:**
- Automated scheduling / CI integration
- Multi-repo epic tracking

## Skill identity

| Property | Value |
|---|---|
| Name | `epic-status` |
| Location (global) | `~/.claude/skills/epic-status/SKILL.md` |
| Location (project) | `.claude/skills/epic-status/SKILL.md` |
| Trigger phrases | "update epics", "sync epic status", "create epics", "update epic-status.md", "how accurate are our epics" |

## Modes

### Mode detection (automatic)

| Condition | Mode |
|---|---|
| `docs/product/epics.md` does not exist | CREATE |
| `docs/product/epics.md` exists | UPDATE |

User can override with explicit argument: `create` or `update`.

## UPDATE mode

### Source pipeline (priority order)

| Priority | Source | What it provides |
|---|---|---|
| 1 | `docs/engineering/changes/*/CHANGELOG.md` | Ground truth: exactly what shipped, what was deferred, bug mentions |
| 2 | `git log --oneline -40` | Catches hotfixes and commits without a change doc |
| 3 | File existence spot-checks | Verifies 3–5 key paths per epic actually exist on disk |
| 4 | Full codebase scan | Fallback only — triggered when change docs are absent or >30 days stale |

### Keyword mapping (git commits without change doc)

| Keywords | Epic |
|---|---|
| `janet`, `chat`, `coach` | Epic 6 |
| `lab_results`, `labs`, `biomarker` | Epic 8 |
| `risk`, `atlas` | Epic 3 |
| `supplement`, `sage` | Epic 4 |
| `check-in`, `streak`, `daily` | Epic 7 |

### Per-epic update actions

1. Move items Outstanding → Shipped when CHANGELOG provides evidence
2. Move items Shipped → Outstanding if file existence check fails (flags mismatch)
3. Update pipeline stage glyphs (`●◐○↻`)
4. Adjust % estimate
5. Add/close bugs if CHANGELOG mentions them

### Guard rails

- Never marks a stage `●` without at least one CHANGELOG entry or verified file on disk
- Flags any CHANGELOG claim where the referenced file path does not exist
- Lists all proposed changes before writing — user confirms

## CREATE mode

### Fresh project (no existing epics)

1. Ask: project name, one-line description, approximate number of epics
2. For each epic collect: thesis, bundle, mechanism, success criterion
3. Generate `epics.md` + `epic-status.md` (all `○○○○○`, 0%)

### Clone from reference

1. Ask for reference path (defaults to longevity-coach-wha structure)
2. Use reference as structural template
3. User provides new epic content; skill handles formatting

## File structure

```
~/.claude/skills/epic-status/
  SKILL.md

.claude/skills/epic-status/          ← project copy, checked into repo
  SKILL.md
```

## Success criteria

- UPDATE produces zero false positives (nothing marked shipped that isn't)
- UPDATE produces zero false negatives (nothing shipped stays in Outstanding)
- All changes proposed before writing — user can reject any individual item
- CREATE produces valid epics.md + epic-status.md matching the established format
- epics.md is never modified without explicit user instruction
