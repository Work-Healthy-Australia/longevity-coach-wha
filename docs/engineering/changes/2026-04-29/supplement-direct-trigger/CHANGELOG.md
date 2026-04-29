# Changelog: Supplement Direct Trigger + Janet Auto-Behavior + Live Refresh
Date: 2026-04-29
Phase: Phase 2 — Intelligence

## What was built

- **Server action** `triggerSupplementProtocol` — fires the supplement pipeline for the authenticated user; fire-and-forget, returns immediately
- **Poll endpoint** `GET /api/report/supplement-status` — returns `{ ready, createdAt }` when a new active plan appears after a given timestamp
- **Message fetch endpoint** `GET /api/report/supplement-message` — returns the Janet push message written by the pipeline after generation completes
- **`SupplementRefreshButton` client component** — button with 5-second polling loop (max 5 min), dispatches `supplementProtocolReady` CustomEvent on success, calls `router.refresh()` to re-render the supplement card in-place
- **Janet push message** written deterministically from `output.supplements` at the end of the supplement pipeline — no additional LLM call; stored to `agents.agent_conversations`
- **`JanetChat` push event listener** — appends the pre-written Janet message into the chat thread automatically when `supplementProtocolReady` fires
- **Staleness tag** in `summariseContext()` — marks supplement protocol as `⚠ STALE` (>1 day) or `✓ fresh` (≤1 day) in Janet's patient context
- **Migration `0055_janet_supplement_autobehavior.sql`** — appends three supplement behavior rules to Janet's system prompt (auto-trigger when missing/stale, read from context when fresh, one auto-trigger per session)
- **Tightened `supplement-advisor-tool` description** — steers Janet away from the tool for routine questions and toward her loaded context

## What changed

| File | Change |
|---|---|
| `app/(app)/report/actions.ts` | Created — `triggerSupplementProtocol` server action |
| `app/api/report/supplement-status/route.ts` | Created — poll endpoint |
| `app/api/report/supplement-message/route.ts` | Created — message fetch endpoint |
| `app/(app)/report/_components/supplement-refresh-button.tsx` | Created — polling button component |
| `app/(app)/report/_components/janet-chat.tsx` | Modified — added `userId` prop, `setMessages`, push event listener |
| `app/(app)/report/page.tsx` | Modified — imports and wires `SupplementRefreshButton`, passes `userId` to `JanetChat`, updates empty-state copy |
| `app/(app)/report/report.css` | Modified — added `.btn-secondary`, `.supplement-refresh-msg`, `.supplement-refresh-error` |
| `lib/ai/pipelines/supplement-protocol.ts` | Modified — writes deterministic Janet push message after plan insert |
| `lib/ai/patient-context.ts` | Modified — staleness tag in `summariseContext()` |
| `lib/ai/tools/supplement-advisor-tool.ts` | Modified — tightened tool description |
| `supabase/migrations/0055_janet_supplement_autobehavior.sql` | Created — Janet system prompt supplement behavior rules |

## Migrations applied

- `0055_janet_supplement_autobehavior.sql` — appends three supplement protocol behavior rules to Janet's system prompt in `agents.agent_definitions`. Idempotent via `NOT LIKE` guard.

## Deviations from plan

None. All tasks implemented exactly as specified.

## Known gaps / deferred items

- WebSocket/SSE live push not implemented — polling every 5 seconds is the intentional mechanism per plan decision
- Clinician portal Janet variant not in scope
- Supplement plan history UI not in scope
