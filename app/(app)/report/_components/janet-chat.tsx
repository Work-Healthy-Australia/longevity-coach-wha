'use client';
// ai-elements: @vercel/ai-elements not published; using react-markdown via shared AssistantBubble.
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { AssistantBubble } from '@/app/(app)/_components/chat-message';

export function JanetChat({ initialMessages = [], userId }: { initialMessages?: UIMessage[]; userId: string }) {
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    messages: initialMessages,
  });
  const [input, setInput] = useState('');
  type TaskEvent = { ts: string; text: string };
  type PendingTask = { id: string; label: string; since: string; events: TaskEvent[] };
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const seenToolCallsRef = useRef<Set<string>>(new Set());
  const mealPlanPollersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const lastIdx = messages.length - 1;

  function appendTaskEvent(taskId: string, text: string) {
    setPendingTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, events: [...t.events, { ts: new Date().toISOString(), text }] }
          : t,
      ),
    );
  }

  function stopMealPlanPolling(taskId: string) {
    const handle = mealPlanPollersRef.current.get(taskId);
    if (handle) {
      clearInterval(handle);
      mealPlanPollersRef.current.delete(taskId);
    }
  }

  // Detect meal-plan tool calls in the assistant stream, then poll
  // /api/report/meal-plan-status until the row appears.
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        const partType = (part as { type?: string }).type ?? '';
        if (partType !== 'tool-request_meal_plan') continue;
        if (seenToolCallsRef.current.has(msg.id)) continue;

        const output = (part as { output?: { since?: string } }).output;
        const since = output?.since;
        if (!since) continue; // wait for tool result with since to arrive

        seenToolCallsRef.current.add(msg.id);
        const id = `mealplan-${msg.id}`;
        setPendingTasks((prev) =>
          prev.some((t) => t.id === id)
            ? prev
            : [
                ...prev,
                {
                  id,
                  label: 'Generating your 7-day meal plan',
                  since,
                  events: [{ ts: since, text: 'Pipeline started — chef agent invoked' }],
                },
              ],
        );

        let attempts = 0;
        const MAX = 36; // 3 min at 5s
        const handle = setInterval(async () => {
          attempts++;
          if (attempts > MAX) {
            stopMealPlanPolling(id);
            appendTaskEvent(id, 'Timed out waiting for completion — try refreshing.');
            return;
          }
          try {
            const res = await fetch(`/api/report/meal-plan-status?since=${encodeURIComponent(since)}`);
            if (!res.ok) return;
            const data = (await res.json()) as { ready: boolean };
            if (!data.ready) return;
            stopMealPlanPolling(id);
            setPendingTasks((prev) => prev.filter((t) => t.id !== id));

            // Fetch the full plan summary written by the pipeline; fall back to
            // a short ready-message if the message row hasn't landed yet.
            let pushText =
              'Your 7-day meal plan and shopping list are ready in your report. Ask me about any specific meal, swap, or ingredient.';
            try {
              const msgRes = await fetch(`/api/report/meal-plan-message?since=${encodeURIComponent(since)}`);
              if (msgRes.ok) {
                const { text } = (await msgRes.json()) as { text: string | null };
                if (text) pushText = text;
              }
            } catch {
              // keep fallback text
            }

            setMessages((prev) => [
              ...prev,
              {
                id: `push-mealplan-${Date.now()}`,
                role: 'assistant' as const,
                parts: [{ type: 'text' as const, text: pushText }],
              },
            ]);
            router.refresh();
          } catch {
            // network blip — keep polling
          }
        }, 5000);
        mealPlanPollersRef.current.set(id, handle);
      }
    }
  }, [messages, router, setMessages]);

  useEffect(() => () => {
    for (const handle of mealPlanPollersRef.current.values()) clearInterval(handle);
    mealPlanPollersRef.current.clear();
  }, []);

  // Scroll to bottom when a new message arrives, a pending task appears, or typing indicator shows
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, status, pendingTasks.length]);

  useEffect(() => {
    function handleTaskStarted(e: Event) {
      const since = (e as CustomEvent<{ since: string }>).detail?.since;
      if (!since) return;
      const id = `supplement-${since}`;
      setPendingTasks((prev) =>
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

    async function handleProtocolReady(e: Event) {
      const since = (e as CustomEvent<{ since: string }>).detail?.since;
      if (!since) return;

      setPendingTasks((prev) => prev.filter((t) => t.id !== `supplement-${since}`));

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

    window.addEventListener('supplementTaskStarted', handleTaskStarted);
    window.addEventListener('supplementProtocolReady', handleProtocolReady);
    return () => {
      window.removeEventListener('supplementTaskStarted', handleTaskStarted);
      window.removeEventListener('supplementProtocolReady', handleProtocolReady);
    };
  }, [setMessages]);

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
