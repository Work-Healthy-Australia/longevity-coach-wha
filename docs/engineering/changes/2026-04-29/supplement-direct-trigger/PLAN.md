# Plan: Supplement Direct Trigger + Janet Auto-Behavior + Live Refresh
Date: 2026-04-29
Phase: Phase 2 — Intelligence
Status: Approved

## Objective

Three improvements to the supplement protocol UX:

1. **Direct trigger button** — a "Generate / Refresh protocol" button on the report page lets patients trigger supplement generation without Janet.
2. **Live completion push** — when generation finishes, the supplement card refreshes automatically and Janet posts a summary message into the chat thread without any user action.
3. **Janet auto-behavior** — Janet auto-triggers generation when the protocol is missing or stale (>1 day), and reads from context directly when the protocol is fresh.

## Staleness threshold

**1 day** — per product owner direction. Any protocol older than 24 hours is considered stale and will be auto-refreshed.

## Architecture decisions

### Live refresh mechanism
Polling every 5 seconds from `SupplementRefreshButton` after trigger. On completion detected:
- `router.refresh()` refreshes the supplement card (re-renders server component)
- `supplementProtocolReady` CustomEvent dispatched on `window`
- `JanetChat` listens for the event, fetches the pre-written Janet message from DB, appends via `setMessages`

### Janet push message
Generated **deterministically** from `output.supplements` inside `supplement-protocol.ts` at the end of the pipeline run — no extra LLM call. Written to `agents.agent_conversations` as a Janet assistant message. Client reads it via a thin authenticated GET endpoint.

This keeps expensive LLM calls inside pipeline workers (async, server-side) and never triggered from user requests — consistent with ai-agents.md rules.

### `setMessages` confirmed available
`@ai-sdk/react`'s `useChat` returns `setMessages: (messages | ((prev) => messages)) => void`. Confirmed from installed type definitions.

## Scope

In scope:
- `triggerSupplementProtocol` server action
- `SupplementRefreshButton` client component with polling + live refresh
- `GET /api/report/supplement-status` poll endpoint
- `GET /api/report/supplement-message` message fetch endpoint
- `lib/ai/pipelines/supplement-protocol.ts` — write deterministic Janet summary to `agent_conversations` after plan insert
- `JanetChat` updated: accepts `userId` prop, listens for custom event, appends Janet message via `setMessages`
- `summariseContext()` updated with 1-day staleness tag
- Janet system prompt updated via migration (three supplement behavior rules)
- `supplement-advisor-tool.ts` description tightened

Out of scope:
- Clinician portal Janet variant
- Supplement plan history UI
- WebSockets, SSE, Supabase Realtime

## Data model changes

None. No new columns or tables. Janet push message is written to the existing `agents.agent_conversations` table.

---

## Waves

### Wave 1 — Direct trigger button with live refresh

**What James can see after this wave merges:** A "Generate my protocol" or "Refresh protocol" button appears in the supplement card. Clicking it fires the pipeline. The button polls until done. When done: the supplement card refreshes in-place and Janet automatically posts a summary message in the chat thread.

---

#### Task 1.1 — Server action: `triggerSupplementProtocol`

**File:** `app/(app)/report/actions.ts` (create)

```ts
'use server';
import { createClient } from '@/lib/supabase/server';

export async function triggerSupplementProtocol(): Promise<{ status: 'generating' | 'error'; message: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Not authenticated' };

  const base = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.PIPELINE_SECRET;

  if (base && secret) {
    fetch(`${base}/api/pipelines/supplement-protocol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-pipeline-secret': secret },
      body: JSON.stringify({ userId: user.id }),
    }).catch((err: unknown) =>
      console.warn('[supplement-protocol action] fire-and-forget failed:', err)
    );
  }

  return {
    status: 'generating',
    message: 'Generating your protocol — this takes about a minute.',
  };
}
```

Rules: auth check first (security.md); fire-and-forget (do NOT await fetch); silently no-op if env vars absent (CLAUDE.md).

Acceptance criteria:
- [ ] Returns `{ status: 'generating' }` immediately without awaiting pipeline
- [ ] Returns `{ status: 'error', message: 'Not authenticated' }` with no user session
- [ ] Skips fetch silently if env vars absent
- [ ] `pnpm build` passes

---

#### Task 1.2 — Pipeline: write Janet push message to `agent_conversations`

**File:** `lib/ai/pipelines/supplement-protocol.ts` (modify)

After the successful `supplement_plans` insert (after the `if (error) throw` line at the end of `runSupplementProtocolPipeline`), add a non-fatal, fire-and-forget write of a deterministic Janet summary to `agents.agent_conversations`.

**Do not** make any additional LLM calls. Format the message from `output.supplements` directly.

Add after the insert error check:

```ts
// Non-blocking: write a pre-formatted Janet summary to conversation history
// so the client can pick it up after detecting the new supplement plan.
const criticalAndHigh = output.supplements.filter(
  (s) => s.priority === 'critical' || s.priority === 'high',
);
const topItems = criticalAndHigh.slice(0, 3);
const bulletLines = topItems.length > 0
  ? topItems.map((s) => `• **${s.name}** (${s.dosage}) — ${s.rationale}`).join('\n')
  : output.supplements.slice(0, 3).map((s) => `• **${s.name}** (${s.dosage}) — ${s.rationale}`).join('\n');

const pushMessage =
  `Your supplement protocol has just been generated — ${output.supplements.length} supplements tailored to your risk profile.` +
  (topItems.length > 0
    ? `\n\nYour top priorities:\n${bulletLines}`
    : `\n\nHere are your first three supplements:\n${bulletLines}`) +
  `\n\nOpen your report to see timing, dosage, and rationale for all supplements. Ask me anything about why a specific supplement was chosen for you.`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(admin as any).schema('agents').from('agent_conversations').insert({
  user_uuid: userId,
  agent: 'janet',
  role: 'assistant',
  content: pushMessage,
}).then(({ error: msgErr }: { error: unknown }) => {
  if (msgErr) console.warn('[supplement-advisor pipeline] Failed to write push message:', msgErr);
});
```

Key rules:
- No await on the insert — this is truly fire-and-forget; a failure here must never affect the pipeline's return path
- No additional LLM calls
- Uses the existing `admin` client already in scope
- Uses `(admin as any).schema('agents')` consistent with the existing pattern in this codebase (see `lib/ai/agents/janet.ts`)

Acceptance criteria:
- [ ] Push message is written to `agents.agent_conversations` with `role='assistant'`, `agent='janet'` after successful plan insert
- [ ] Pipeline failure (exception from the plan insert) prevents the push message write — correct, the push is after the throw
- [ ] Push message write failure does NOT affect pipeline return — it's unawaited and logged only
- [ ] Push message content includes supplement count and top priority items from `output.supplements`
- [ ] No new LLM calls added to the pipeline
- [ ] `pnpm build` passes

---

#### Task 1.3 — Poll endpoint: `GET /api/report/supplement-status`

**File:** `app/api/report/supplement-status/route.ts` (create)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ready: false }, { status: 401 });

  const since = req.nextUrl.searchParams.get('since');
  if (!since) return NextResponse.json({ ready: false }, { status: 400 });

  const { data } = await supabase
    .from('supplement_plans')
    .select('created_at')
    .eq('patient_uuid', user.id)
    .eq('status', 'active')
    .gt('created_at', since)
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ ready: !!data, createdAt: data?.created_at ?? null });
}
```

Acceptance criteria:
- [ ] Returns `{ ready: true, createdAt }` when a new active plan exists after `since`
- [ ] Returns `{ ready: false }` when no qualifying plan
- [ ] Returns 401 with no user session; 400 with missing `since` param
- [ ] `pnpm build` passes

---

#### Task 1.4 — Message fetch endpoint: `GET /api/report/supplement-message`

**File:** `app/api/report/supplement-message/route.ts` (create)

Fetches the Janet push message written by the pipeline. This is a pure DB read — no LLM call.

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ text: null }, { status: 401 });

  const since = req.nextUrl.searchParams.get('since');
  if (!since) return NextResponse.json({ text: null }, { status: 400 });

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .schema('agents')
    .from('agent_conversations')
    .select('content')
    .eq('user_uuid', user.id)
    .eq('agent', 'janet')
    .eq('role', 'assistant')
    .gt('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ text: data?.content ?? null });
}
```

Note: uses the admin client to read from `agents` schema, consistent with how `report/page.tsx` already reads `agent_conversations` via `(admin as any).schema('agents')`.

Acceptance criteria:
- [ ] Returns `{ text: string }` with the most recent Janet assistant message after `since`
- [ ] Returns `{ text: null }` if no message found yet (client will retry on next poll or ignore)
- [ ] Returns 401 with no user session; 400 with missing `since`
- [ ] No LLM calls — pure DB read
- [ ] `pnpm build` passes

---

#### Task 1.5 — `SupplementRefreshButton` with polling

**File:** `app/(app)/report/_components/supplement-refresh-button.tsx` (create)

```tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { triggerSupplementProtocol } from '../actions';

type State = 'idle' | 'pending' | 'done' | 'timeout' | 'error';

export function SupplementRefreshButton({ hasProtocol }: { hasProtocol: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => () => stopPolling(), []);

  function startPolling(since: string) {
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 5 min at 5s interval

    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > MAX_ATTEMPTS) {
        stopPolling();
        setState('timeout');
        setMessage('Taking longer than expected — refresh the page to check.');
        return;
      }
      try {
        const res = await fetch(`/api/report/supplement-status?since=${encodeURIComponent(since)}`);
        if (!res.ok) return; // network blip — keep polling
        const data = await res.json() as { ready: boolean };
        if (data.ready) {
          stopPolling();
          setState('done');
          setMessage('Your supplement protocol is ready!');
          router.refresh();
          window.dispatchEvent(new CustomEvent('supplementProtocolReady', { detail: { since } }));
        }
      } catch {
        // network blip — keep polling
      }
    }, 5000);
  }

  async function handleClick() {
    setState('pending');
    const since = new Date().toISOString();

    const result = await triggerSupplementProtocol();
    if (result.status === 'error') {
      setState('error');
      setMessage(result.message);
      return;
    }
    setMessage(result.message);
    startPolling(since);
  }

  const label =
    state === 'pending' ? 'Generating…' :
    hasProtocol ? 'Refresh protocol' :
    'Generate my protocol';

  return (
    <div>
      <button
        type="button"
        className="btn-secondary"
        onClick={handleClick}
        disabled={state === 'pending' || state === 'done'}
      >
        {label}
      </button>
      {message && (
        <p className={`supplement-refresh-msg${state === 'error' || state === 'timeout' ? ' supplement-refresh-error' : ''}`}>
          {message}
        </p>
      )}
    </div>
  );
}
```

Note: the `supplementProtocolReady` CustomEvent carries `detail: { since }` so `JanetChat` can use the same timestamp to fetch the pre-written message.

CSS additions to `report.css` (only add if not already defined):
- `.supplement-refresh-msg`: `font-size: 0.85rem; margin-top: 6px; color: var(--text-muted);`
- `.supplement-refresh-error`: same + override with red/danger color
- `.btn-secondary`: lighter button — check existing CSS first

Acceptance criteria:
- [ ] Labels correct for each state
- [ ] Polls every 5s; stops on success or timeout (60 attempts = 5 min)
- [ ] On success: `router.refresh()` + dispatches `supplementProtocolReady` with `since` in detail
- [ ] Interval cleaned up on unmount
- [ ] `pnpm build` passes

---

#### Task 1.6 — Update `JanetChat` to handle push event

**File:** `app/(app)/report/_components/janet-chat.tsx` (modify)

Changes:
1. Add `userId: string` to props (used for future tasks; not needed in this task's logic since auth is handled server-side)
2. Destructure `setMessages` from `useChat` in addition to existing destructures
3. Add a `useEffect` that listens for `supplementProtocolReady` and injects the Janet message

```tsx
// Updated prop type
export function JanetChat({ initialMessages = [], userId }: { initialMessages?: UIMessage[]; userId: string }) {
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    messages: initialMessages,
  });

  // ... existing state and effects unchanged ...

  useEffect(() => {
    async function handleProtocolReady(e: Event) {
      const since = (e as CustomEvent<{ since: string }>).detail?.since;
      if (!since) return;

      try {
        const res = await fetch(`/api/report/supplement-message?since=${encodeURIComponent(since)}`);
        if (!res.ok) return;
        const { text } = await res.json() as { text: string | null };
        if (!text) return;

        setMessages((prev) => [
          ...prev,
          {
            id: `push-supplement-${Date.now()}`,
            role: 'assistant' as const,
            parts: [{ type: 'text' as const, text }],
          },
        ]);
      } catch {
        // Non-fatal: push message is a nice-to-have, not critical
      }
    }

    window.addEventListener('supplementProtocolReady', handleProtocolReady);
    return () => window.removeEventListener('supplementProtocolReady', handleProtocolReady);
  }, [setMessages]);

  // ... rest of component unchanged ...
}
```

Acceptance criteria:
- [ ] `JanetChat` accepts `userId: string` prop
- [ ] `setMessages` destructured from `useChat`
- [ ] On `supplementProtocolReady` event: fetches pre-written message from DB, appends as assistant message with no corresponding user message
- [ ] Event listener cleaned up on unmount
- [ ] Non-fatal: fetch failure leaves chat unchanged
- [ ] `pnpm build` passes

---

#### Task 1.7 — Wire into report page

**File:** `app/(app)/report/page.tsx` (modify)

1. Import `SupplementRefreshButton`
2. Pass `userId={user.id}` to `<JanetChat>`
3. Add `<SupplementRefreshButton hasProtocol={supplements.length > 0} />` to the supplement card header div (between the badge and the PDF download link)
4. Update empty-state text: change "Your supplement protocol is being generated. It will appear here shortly after your assessment is processed." to "Your supplement protocol hasn't been generated yet. Click 'Generate my protocol' above to get started."

Acceptance criteria:
- [ ] Button visible in supplement card header for all users
- [ ] `JanetChat` receives `userId` prop
- [ ] Empty-state copy updated
- [ ] `pnpm build` passes

---

### Wave 2 — Janet auto-behavior

**What James can see after this wave merges:** When a patient with no supplement protocol (or one older than 1 day) sends their first message to Janet, Janet proactively fires the pipeline and tells them. When the protocol is fresh, Janet answers supplement questions straight from her loaded context — no extra pipeline call, faster response.

---

#### Task 2.1 — Staleness tag in `summariseContext()`

**File:** `lib/ai/patient-context.ts` (modify)

In `summariseContext()`, find the supplement protocol block (around line 382) and replace with an age-aware version using a **1-day** threshold:

Replace:
```ts
if (ctx.supplementPlan?.items.length) {
  const critical = ctx.supplementPlan.items.filter((s) => s.priority === "critical");
  const high = ctx.supplementPlan.items.filter((s) => s.priority === "high");
  lines.push(
    `Supplement protocol: ${ctx.supplementPlan.items.length} supplements (${critical.length} critical, ${high.length} high priority)`,
  );
} else {
  lines.push(`Supplement protocol: not yet generated`);
}
```

With:
```ts
if (ctx.supplementPlan?.items.length) {
  const critical = ctx.supplementPlan.items.filter((s) => s.priority === "critical");
  const high = ctx.supplementPlan.items.filter((s) => s.priority === "high");
  const daysSince = Math.floor(
    (Date.now() - new Date(ctx.supplementPlan.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  const staleTag = daysSince > 1
    ? ` ⚠ STALE (${daysSince} days old — threshold: 1 day)`
    : ` ✓ fresh (generated today)`;
  lines.push(
    `Supplement protocol: ${ctx.supplementPlan.items.length} supplements (${critical.length} critical, ${high.length} high priority) — generated ${daysSince} day${daysSince === 1 ? '' : 's'} ago${staleTag}`,
  );
} else {
  lines.push(`Supplement protocol: not yet generated`);
}
```

Acceptance criteria:
- [ ] `⚠ STALE` tag appears when plan is >1 day old
- [ ] `✓ fresh (generated today)` appears when plan is ≤1 day old
- [ ] "not yet generated" unchanged when no plan
- [ ] No changes to `PatientContext` interface or DB queries
- [ ] `pnpm build` and `pnpm test` pass

---

#### Task 2.2 — Janet system prompt: supplement behavior rules (migration)

**File:** `supabase/migrations/0055_janet_supplement_autobehavior.sql` (create)

Use the same INSERT...ON CONFLICT pattern as `0052_upsert_supplement_advisor_agent.sql`, but for Janet: a conditional UPDATE that appends three rules only if not already present.

```sql
-- Append supplement protocol behavior rules to Janet's system prompt.
-- Guard: NOT LIKE prevents double-application on re-run.
UPDATE agents.agent_definitions
SET
  system_prompt = system_prompt || E'\n\n## Supplement protocol behavior\n\n'
    || E'**Rule 1 — Auto-trigger when missing or stale (first message only):**\n'
    || E'Check your patient context supplement protocol line. If it says "not yet generated" OR contains "\\u26a0 STALE", AND there are no prior assistant messages in the conversation history provided to you, call the `request_supplement_protocol` tool immediately at the start of your response. Do not wait for the patient to ask. Briefly acknowledge what they said, then inform them their supplement protocol is being refreshed in the background.\n\n'
    || E'**Rule 2 — Read from context when fresh:**\n'
    || E'If the supplement protocol is tagged "\\u2713 fresh" in your context, answer ALL supplement questions directly from the protocol data in your Patient context section. Do NOT call `supplement_advisor_summary` for routine questions such as "what supplements am I on?", "why do I take X?", "what does my protocol look like?", or "summarise my supplements". Reserve `supplement_advisor_summary` only for requests that explicitly require deep analytical synthesis beyond what the protocol data in your context already shows.\n\n'
    || E'**Rule 3 — One auto-trigger per session:**\n'
    || E'Call `request_supplement_protocol` at most once per conversation for auto-refresh purposes. If it has already been triggered in this session, do not call it again. If the patient asks about their protocol while generation is still pending, inform them it is being generated and will be ready shortly.',
  updated_at = now()
WHERE slug = 'janet'
  AND system_prompt NOT LIKE '%## Supplement protocol behavior%';
```

Acceptance criteria:
- [ ] Migration named `0055_janet_supplement_autobehavior.sql`
- [ ] Idempotent: second run is a no-op due to `NOT LIKE` guard
- [ ] All three rules appended to Janet's system prompt
- [ ] No data loss to existing prompt content
- [ ] `pnpm build` passes

---

#### Task 2.3 — Tighten `supplement-advisor-tool` description

**File:** `lib/ai/tools/supplement-advisor-tool.ts` (modify)

Replace the `description` field with:

```
"Runs a dedicated specialist pipeline to provide deep analytical synthesis of this patient's supplement protocol. Call this ONLY for requests that explicitly require a level of analytical depth beyond what the protocol data visible in your context already provides — e.g. full mechanism explanations, cross-domain interaction analysis, or comparison of protocol options. For routine questions ('what supplements am I on?', 'why do I take X?', 'summarise my protocol'), read from the supplement data already in your Patient context instead of calling this tool."
```

Acceptance criteria:
- [ ] Description updated as above
- [ ] No changes to execute logic
- [ ] `pnpm build` passes

---

## Task execution order

**Wave 1** (sequential — each file imported by the next):
1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7

**Wave 2** (2.1 and 2.3 parallel, then 2.2):
- 2.1 and 2.3 can run concurrently
- 2.2 runs after 2.1 (SQL text references the `⚠ STALE` tag format added in 2.1)
