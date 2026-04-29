# QA Report: Supplement Direct Trigger + Janet Auto-Behavior + Live Refresh
Date: 2026-04-29
Reviewer: QA

## Build status
pnpm build: PASS
pnpm test: N/A (no new unit tests — all changes are integration-layer: server actions, API routes, pipeline writes, and UI event wiring)

## Wave 1 — Direct trigger button with live refresh

### Acceptance criteria review

#### Task 1.1 — Server action `triggerSupplementProtocol`
- [x] Returns `{ status: 'generating' }` immediately without awaiting pipeline
- [x] Returns `{ status: 'error', message: 'Not authenticated' }` with no user session
- [x] Skips fetch silently if env vars absent
- [x] `pnpm build` passes

#### Task 1.2 — Pipeline: write Janet push message to `agent_conversations`
- [x] Push message written after successful `supplement_plans` insert
- [x] Pipeline exception (thrown before insert) prevents the write — correct
- [x] Push message write failure is non-fatal (unawaited, logged only)
- [x] Content includes supplement count and top priority items
- [x] No new LLM calls added
- [x] `pnpm build` passes

#### Task 1.3 — Poll endpoint `GET /api/report/supplement-status`
- [x] Returns `{ ready: true, createdAt }` when a new active plan exists after `since`
- [x] Returns `{ ready: false }` when no qualifying plan
- [x] Returns 401 with no user session; 400 with missing `since`
- [x] `pnpm build` passes

#### Task 1.4 — Message fetch endpoint `GET /api/report/supplement-message`
- [x] Returns `{ text: string }` with most recent Janet assistant message after `since`
- [x] Returns `{ text: null }` if no message found
- [x] Returns 401 with no user session; 400 with missing `since`
- [x] No LLM calls — pure DB read
- [x] `pnpm build` passes

#### Task 1.5 — `SupplementRefreshButton` with polling
- [x] Labels correct per state: idle → "Generate my protocol" or "Refresh protocol"; pending → "Generating…"
- [x] Polls every 5s; stops on success or 60-attempt timeout (5 min)
- [x] On success: `router.refresh()` + dispatches `supplementProtocolReady` with `since` in detail
- [x] Interval cleaned up on unmount
- [x] CSS classes added to `report.css`: `.btn-secondary`, `.supplement-refresh-msg`, `.supplement-refresh-error`
- [x] `pnpm build` passes

#### Task 1.6 — `JanetChat` push event handling
- [x] Accepts `userId: string` prop
- [x] `setMessages` destructured from `useChat`
- [x] On `supplementProtocolReady` event: fetches message, appends as assistant message
- [x] Event listener cleaned up on unmount
- [x] Fetch failure leaves chat unchanged (non-fatal)
- [x] `pnpm build` passes

#### Task 1.7 — Report page wiring
- [x] `SupplementRefreshButton` visible in supplement card header for all users
- [x] `JanetChat` receives `userId` prop
- [x] Empty-state copy updated to "hasn't been generated yet. Click 'Generate my protocol' above to get started."
- [x] `pnpm build` passes

---

## Wave 2 — Janet auto-behavior

### Acceptance criteria review

#### Task 2.1 — Staleness tag in `summariseContext()`
- [x] `⚠ STALE (N days old — threshold: 1 day)` appears when plan is >1 day old
- [x] `✓ fresh (generated today)` appears when plan is ≤1 day old
- [x] "not yet generated" unchanged when no plan
- [x] No changes to `PatientContext` interface or DB queries
- [x] `pnpm build` passes

#### Task 2.2 — Migration `0055_janet_supplement_autobehavior.sql`
- [x] Migration named `0055_janet_supplement_autobehavior.sql`
- [x] Idempotent: `NOT LIKE '%## Supplement protocol behavior%'` guard prevents double-apply
- [x] All three rules appended (auto-trigger, read from context, one auto-trigger per session)
- [x] No data loss to existing prompt content
- [x] `pnpm build` passes

#### Task 2.3 — Tighten `supplement-advisor-tool` description
- [x] Description updated to discourage routine calls; reserves tool for deep analytical synthesis
- [x] No changes to execute logic
- [x] `pnpm build` passes

---

## Findings

### Confirmed working
- Build output clean: all 11 new/modified files compiled with zero TypeScript errors
- Both new API routes (`/api/report/supplement-status`, `/api/report/supplement-message`) appear in build output
- Fire-and-forget pattern in server action and pipeline push message follows project conventions
- `(admin as any).schema('agents')` pattern consistent with existing usage in `report/page.tsx` and `janet.ts`

### Deferred items
- None

### Known limitations
- Live refresh relies on 5-second polling rather than WebSockets/SSE — acceptable per plan decision and out-of-scope note
- Janet push message is deterministic (no LLM call) — by design

---

## Verdict

**APPROVED**

All acceptance criteria satisfied across both waves. `pnpm build` passes cleanly with no TypeScript errors.
