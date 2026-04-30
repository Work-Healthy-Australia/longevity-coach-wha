'use client';
// ai-elements: @vercel/ai-elements not published; using react-markdown via shared AssistantBubble.
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, useRef } from 'react';
import { AssistantBubble } from '@/app/(app)/_components/chat-message';
import { createClient } from '@/lib/supabase/client';

// Pipeline-completion message prefixes. Used to distinguish push-on-arrival
// pipeline messages from Janet's own streaming replies (which are also written
// to agent_conversations after each turn).
const PIPELINE_COMPLETION_PREFIXES = [
  'Your 7-day meal plan is ready',
  'Your supplement protocol has just been generated',
];

function matchesPipelineMessage(content: string): 'mealplan' | 'supplement' | null {
  if (content.startsWith('Your 7-day meal plan is ready')) return 'mealplan';
  if (content.startsWith('Your supplement protocol has just been generated')) return 'supplement';
  return null;
}

export function JanetChat({ initialMessages = [], userId }: { initialMessages?: UIMessage[]; userId: string }) {
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    messages: initialMessages,
  });
  const [input, setInput] = useState('');
  type TaskEvent = { ts: string; text: string };
  type PendingTask = { id: string; label: string; since: string; events: TaskEvent[] };
  // Supplement tasks are pushed via a `window` event from a sibling component
  // (external subscription → state is the right tool).
  const [supplementTasks, setSupplementTasks] = useState<PendingTask[]>([]);
  // Meal-plan tasks are derived from `messages`. When a Realtime push arrives,
  // we bump `mealplanResolvedAt` instead of mutating a list — any tool call
  // whose `since` is older than this timestamp is treated as resolved. Pure
  // derivation in render avoids the cascading-render anti-pattern.
  const [mealplanResolvedAt, setMealplanResolvedAt] = useState<string | null>(null);
  const consumedRowIdsRef = useRef<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const lastIdx = messages.length - 1;

  // Derive meal-plan pending tasks during render — every assistant message
  // with a `tool-request_meal_plan` part that hasn't been dismissed yet.
  const mealplanTasks: PendingTask[] = useMemo(() => {
    const tasks: PendingTask[] = [];
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        const partType = (part as { type?: string }).type ?? '';
        if (partType !== 'tool-request_meal_plan') continue;
        const output = (part as { output?: { since?: string } }).output;
        const since = output?.since;
        if (!since) continue;
        if (mealplanResolvedAt && since <= mealplanResolvedAt) continue;
        const id = `mealplan-${msg.id}`;
        tasks.push({
          id,
          label: 'Generating your 7-day meal plan',
          since,
          events: [{ ts: since, text: 'Pipeline started — chef agent invoked' }],
        });
      }
    }
    return tasks;
  }, [messages, mealplanResolvedAt]);

  const pendingTasks: PendingTask[] = useMemo(
    () => [...mealplanTasks, ...supplementTasks],
    [mealplanTasks, supplementTasks],
  );

  // Push-based resolution: subscribe to Supabase Realtime for assistant message
  // INSERTs in agents.agent_conversations. Pipeline-completion messages have
  // distinct prefixes, so we can ignore Janet's own streamed replies (which
  // are also persisted there but already render via useChat).
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    function handlePipelineRow(row: { id?: string; content: string; agent: string; role: string; created_at?: string }) {
      if (row.role !== 'assistant' || row.agent !== 'janet') return;
      const kind = matchesPipelineMessage(row.content);
      if (!kind) return;
      // Dedupe: same row may arrive via Realtime AND the safety-net catch-up fetch.
      const dedupKey = row.id ?? `${kind}-${row.created_at ?? ''}-${row.content.slice(0, 40)}`;
      if (consumedRowIdsRef.current.has(dedupKey)) return;
      consumedRowIdsRef.current.add(dedupKey);

      if (kind === 'mealplan') {
        // Bump the resolution timestamp — every meal-plan tool call whose
        // `since` is older than this will drop out of the derived list on
        // the next render. No need to enumerate specific task ids.
        setMealplanResolvedAt(row.created_at ?? new Date().toISOString());
      } else {
        setSupplementTasks((prev) => prev.filter((t) => !t.id.startsWith('supplement-')));
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `push-${kind}-${Date.now()}`,
          role: 'assistant' as const,
          parts: [{ type: 'text' as const, text: row.content }],
        },
      ]);
      if (kind === 'mealplan') router.refresh();
    }

    // Ensure the realtime websocket carries the user's JWT before subscribing.
    // Without this, the channel can attach as `anon` on a cold load (auth state
    // hydration races the useEffect), and the RLS policy
    // `agent_conv_patient_select` (auth.uid() = user_uuid) silently drops every
    // postgres_changes payload — symptom: SUBSCRIBED status, zero events.
    (async () => {
      await supabase.auth.getSession();
      if (cancelled) return;

      channel = supabase
        .channel(`janet-conv-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'agents',
            table: 'agent_conversations',
            filter: `user_uuid=eq.${userId}`,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            console.log('[janet-chat realtime] payload', payload);
            handlePipelineRow(payload.new);
          },
        )
        .subscribe(async (status, err) => {
          console.log('[janet-chat realtime] subscribe status', status, err ?? '');
          // Race-condition safety net: on successful subscribe, do a one-shot
          // catch-up fetch for any pipeline-completion message inserted between
          // the user's tool call and the WebSocket joining. We deliberately
          // ignore `subscribedAt` here so a remount AFTER the pipeline has
          // already committed (e.g. user navigated away and back) still
          // resolves — `consumedRowIdsRef` keys on row.id to dedupe.
          if (status !== 'SUBSCRIBED') return;
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data } = await (supabase as any)
              .schema('agents')
              .from('agent_conversations')
              .select('id, content, agent, role, created_at')
              .eq('user_uuid', userId)
              .eq('agent', 'janet')
              .eq('role', 'assistant')
              .or(
                PIPELINE_COMPLETION_PREFIXES.map((p) => `content.ilike.${p}%`).join(','),
              )
              .order('created_at', { ascending: false })
              .limit(PIPELINE_COMPLETION_PREFIXES.length);
            // Re-sort ascending so messages render in chronological order.
            const rows = (data ?? []).slice().reverse();
            for (const row of rows) handlePipelineRow(row);
          } catch {
            // catch-up is best-effort
          }
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, router, setMessages]);

  // Scroll to bottom when a new message arrives, a pending task appears, or typing indicator shows
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, status, pendingTasks.length]);

  useEffect(() => {
    function handleTaskStarted(e: Event) {
      const since = (e as CustomEvent<{ since: string }>).detail?.since;
      if (!since) return;
      const id = `supplement-${since}`;
      setSupplementTasks((prev) =>
        prev.some((t) => t.id === id)
          ? prev
          : [
              ...prev,
              {
                id,
                label: 'Generating your supplement protocol',
                since,
                events: [{ ts: since, text: 'Pipeline started — supplement advisor invoked' }],
              },
            ],
      );
    }

    // Resolution (dismiss pending + push Janet message) is handled by the
    // Realtime subscription above — supplementProtocolReady event no longer
    // needed for that path.

    window.addEventListener('supplementTaskStarted', handleTaskStarted);
    return () => {
      window.removeEventListener('supplementTaskStarted', handleTaskStarted);
    };
  }, []);

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>Janet is ready to help. Ask anything about your health results.</p>
            <div className="chat-starters">
              {[
                'What does my biological age mean?',
                'Which supplement should I prioritise first?',
                "What's my biggest modifiable risk factor?",
              ].map((q) => (
                <button
                  key={q}
                  className="chat-starter"
                  onClick={() => setInput(q)}
                  type="button"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
            {msg.role === 'assistant' && <div className="chat-avatar">J</div>}
            <div className="chat-bubble">
              {msg.parts.map((part, i) =>
                part.type === 'text' ? (
                  msg.role === 'assistant' ? (
                    <AssistantBubble
                      key={i}
                      text={part.text}
                      isStreaming={status === 'streaming' && idx === lastIdx}
                    />
                  ) : (
                    <span key={i}>{part.text}</span>
                  )
                ) : null,
              )}
            </div>
          </div>
        ))}

        {pendingTasks.map((task) => (
          <details key={task.id} className="chat-task-line">
            <summary className="chat-task-line-summary">
              <span className="chat-task-line-caret" aria-hidden>▸</span>
              <span className="chat-task-line-label">{task.label}</span>
              <span className="chat-task-line-dots"><span /><span /><span /></span>
            </summary>
            <ul className="chat-task-line-events">
              {task.events.length === 0 ? (
                <li className="chat-task-line-empty">Waiting for updates…</li>
              ) : (
                task.events.map((ev, i) => (
                  <li key={i}>
                    <time>{new Date(ev.ts).toLocaleTimeString()}</time>
                    <span>{ev.text}</span>
                  </li>
                ))
              )}
            </ul>
          </details>
        ))}

        {status === 'submitted' && (
          <div className="chat-message chat-message-assistant">
            <div className="chat-avatar">J</div>
            <div className="chat-bubble chat-bubble-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || status !== 'ready') return;
          sendMessage({ text: input });
          setInput('');
        }}
        className="chat-form"
      >
        <input
          type="text"
          className="chat-input"
          placeholder="Ask Janet anything…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={status !== 'ready'}
          autoComplete="off"
        />
        <button
          type="submit"
          className="chat-send"
          disabled={status !== 'ready' || !input.trim()}
        >
          {status !== 'ready' ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
