---
name: epic-status
description: Create or update docs/product/epics.md and docs/product/epic-status.md. Use when someone says "update epics", "sync epic status", "create epics", "update epic-status.md", "how accurate are our epics", or asks to create/refresh the product epic docs from codebase reality.
---

# epic-status skill

Maintains two paired product docs:
- `docs/product/epics.md` — stable strategy layer (thesis / bundle / mechanism / success criterion)
- `docs/product/epic-status.md` — live status layer (pipeline stages, % estimates, shipped/outstanding/bugs)

---

## Step 1 — Detect mode

Check whether `docs/product/epics.md` exists in the current project.

- **Does not exist** → CREATE mode
- **Exists** → UPDATE mode

User can override: if they said "create" → CREATE mode. If they said "update" → UPDATE mode.

---

## UPDATE mode

### What you update

- `docs/product/epic-status.md` — **always** on every run
- `docs/product/epics.md` — **only if the user explicitly asked** ("update the epics too", `--epics` flag, or similar). Never touch epics.md unless asked.

### Phase 1 — Gather evidence

Run all of these in parallel:

**1. Read all change docs (primary source)**

```bash
find docs/engineering/changes -name "CHANGELOG.md" | sort
```

Read every CHANGELOG.md found. For each file, extract:
- **Epic tag** — look for `"Epic N"` or `"(The [Name])"` in the header
- **What was built** → evidence for Shipped items
- **Known gaps / deferred items** → evidence for Outstanding items
- **Bug mentions** → any BUG-NNN references, opened or closed

**2. Check git log (secondary source)**

```bash
git log --oneline -40
```

For commits that don't have a matching CHANGELOG entry, map them to epics by keyword:

| Keywords | Epic |
|---|---|
| `janet`, `chat`, `coach`, `compression`, `tool_use`, `rag` | Epic 6 |
| `lab`, `biomarker`, `labs`, `trends`, `alerts` | Epic 8 |
| `risk`, `atlas`, `scorer` | Epic 3 |
| `supplement`, `sage`, `protocol` | Epic 4 |
| `check-in`, `checkin`, `streak`, `daily` | Epic 7 |
| `nova`, `knowledge`, `digest`, `pubmed` | Epic 10 |
| `upload`, `janet.*upload`, `dedup`, `hash` | Epic 2 |
| `admin`, `invite`, `distribution` | Epic 12 |
| `rls`, `trust`, `export`, `consent`, `pgtap` | Epic 11 |
| `pdf`, `report` | Epic 5 |
| `front.door`, `auth`, `stripe`, `signup`, `welcome` | Epic 1 |
| `care.team`, `clinician` | Epic 9 |
| `platform`, `ci`, `gitleaks`, `migration` | Epic 14 |

**3. Spot-check key file paths**

For each epic, verify 3–5 of the most important paths claimed as shipped actually exist on disk. Use `ls` or `find`. Flag any path that is missing.

### Phase 2 — Build the diff

Read the current `docs/product/epic-status.md`.

For each epic, produce a structured diff:

```
Epic N — [Name]
  SHIP:   [items to move from Outstanding → Shipped, with evidence source]
  DEFER:  [items to add/keep in Outstanding]
  BUGS:   [bugs to open or close]
  STAGE:  [proposed new pipeline glyph string]
  PCT:    [proposed new % estimate]
  MISMATCH: [any path claimed as shipped but not found on disk]
```

Rules for pipeline stages:
- `●` Planned — always true once epics.md exists
- `●` Feature Complete — every item in the Bundle has a CHANGELOG or git evidence
- `◐` / `●` Unit Tested — grep `tests/unit/` for test files related to this epic; `●` if ≥1 test file exists with passing evidence, `◐` if partial
- `○` Regression Tested — only `●` if a Playwright or end-to-end test suite is confirmed for this epic
- `○` User Reviewed — only `●` if explicitly noted in a CHANGELOG or doc

Rules for % estimate:
- Use your judgement based on ratio of Shipped vs (Shipped + Outstanding) items, weighted by importance
- Do not invent precision — round to nearest 5%

### Phase 3 — Confirm before writing

Present the full diff to the user in a readable summary:

```
── Epic 1: The Front Door ──────────────────
  No changes.

── Epic 6: The Coach ───────────────────────
  SHIP:   Conversation-summary compression (CHANGELOG 2026-04-28-conversation-compression)
          Atlas tool_use sub-agent (CHANGELOG 2026-04-28-janet-tool-use)
          Sage tool_use sub-agent (CHANGELOG 2026-04-28-janet-tool-use)
  STAGE:  ●●◐○○ (unchanged)
  PCT:    90% (was 80%)

── Epic 8: The Living Record ───────────────
  SHIP:   /labs page (CHANGELOG 2026-04-28-b4-lab-results-ui)
          /trends page (CHANGELOG 2026-04-28-b5-daily-trends)
          Member alerts surface (CHANGELOG 2026-04-28-b7-member-alerts)
  PCT:    55% (was 40%)
  ...
```

Then ask:

> "Does this look right? I'll write the updated epic-status.md when you confirm. You can also flag any item to skip."

Wait for confirmation. If the user flags items to skip, exclude them.

### Phase 4 — Write

Apply confirmed changes to `docs/product/epic-status.md`. Preserve all existing prose, formatting, and sections. Only change:
- Items moved between Shipped ↔ Outstanding
- Pipeline glyph strings
- % estimates
- Bug entries
- The "Last updated" date at the top

If the user also requested epics.md updates (`--epics` or explicit ask): present proposed strategy-level changes separately, labelled "strategy edits", and get a second confirmation before writing.

---

## CREATE mode

### Detect sub-mode

Ask:

> "Starting fresh or cloning the structure from an existing project?
> (A) Fresh — I'll describe my epics from scratch
> (B) Clone — use an existing project's epics.md as the structural template"

### Fresh path

1. Ask: project name, one-line description
2. Ask: how many epics (rough count is fine)
3. For each epic, ask in sequence:
   - "Thesis — one sentence: what does this epic prove or deliver?"
   - "Bundle — list the features in this epic (one per line)"
   - "Mechanism — how does it work technically? (2–4 sentences)"
   - "Success criterion — how do you know you got it right? (measurable)"
4. After all epics are collected, generate both files (see File format below)

### Clone path

1. Ask for the reference project path, or default to the longevity-coach-wha format
2. Read the reference `epics.md` to extract the structural template (sections, formatting, pipeline legend, summary table shape)
3. Ask the user to provide content for each epic in the new project
4. Generate both files using the reference structure

### File format for both files

**epics.md must include:**
- Header with project name and "Last updated" date
- Companion doc links
- "The frame" section explaining the epic model
- One section per epic: `## Epic N — [Name]`, thesis, bundle list, mechanism, success criterion
- "How epics relate to phases" table at the bottom

**epic-status.md must include:**
- Header with "Last updated" date
- Companion doc links
- "Pipeline stages" table with the five stages and their meanings
- Symbol key: `●` passed · `◐` partial · `○` not yet · `↻` regressed
- Summary table: # | Epic | Pipeline | Estimate | Open bugs | Closed bugs
- Per-epic detail block for each epic: pipeline glyph line, estimate, Shipped list, Outstanding list, Open bugs, Closed bugs
- "How this file gets updated" footer

All new epics start at `○○○○○`, 0%, no bugs.

---

## Fallback: no docs/engineering/changes/ directory

If the `docs/engineering/changes/` directory does not exist or is empty:

1. Escalate to git log: `git log --oneline -60` — map commits to epics by keyword table above
2. If git log is also sparse, run a targeted codebase scan:
   - `find app -name "*.tsx" | wc -l` — rough feature completeness signal
   - `find tests -name "*.test.ts" | head -40` — test coverage signal
   - `find supabase/migrations -name "*.sql" | sort` — migration history
3. Use these signals to estimate pipeline stages conservatively
4. Tell the user which source was used and note the lower confidence level

---

## Principles

- **Never mark shipped without evidence.** If you can't point to a CHANGELOG, a commit, or a file on disk, it stays Outstanding.
- **Never silently edit epics.md.** Strategy docs change slowly and intentionally — always require explicit user instruction.
- **Confirm before writing.** Always show the full diff and wait for a yes before touching any file.
- **Flag mismatches explicitly.** If a CHANGELOG claims a path that doesn't exist on disk, surface it — don't silently ignore it.
- **Preserve prose.** When updating epic-status.md, only change what the evidence justifies. Don't rewrite surrounding text.
