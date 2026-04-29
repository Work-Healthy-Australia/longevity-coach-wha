'use client';
// ai-elements: @vercel/ai-elements not published; using react-markdown via shared AssistantBubble.
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import { useState, useEffect, useRef } from 'react';
import { AssistantBubble } from '@/app/(app)/_components/chat-message';

export function JanetChat({ initialMessages = [] }: { initialMessages?: UIMessage[] }) {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    messages: initialMessages,
  });
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastIdx = messages.length - 1;

  // Scroll to bottom when a new message arrives or the typing indicator appears
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, status]);

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
