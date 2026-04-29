'use client';
// ai-elements: @vercel/ai-elements not published; using react-markdown via shared AssistantBubble.
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useChatStore } from '@/lib/stores/chat-store';
import { AssistantBubble } from './chat-message';
import './support-fab.css';

export function SupportFAB() {
  const { support, toggleSupport, closeSupport } = useChatStore();
  const pathname = usePathname();
  const [input, setInput] = useState('');

  const { messages, sendMessage, status } = useChat({
    messages: [
      {
        id: 'intro',
        role: 'assistant' as const,
        parts: [{ type: 'text' as const, text: "Hi! How can I help you?" }],
      },
    ],
    transport: new DefaultChatTransport({
      api: '/api/chat/support',
      body: { currentPath: pathname },
    }),
  });

  const lastIdx = messages.length - 1;

  return (
    <>
      {support.isOpen && (
        <div className="support-panel">
          <div className="support-panel-header">
            <span className="support-panel-title">Support</span>
            <button className="support-panel-close" onClick={closeSupport} type="button" aria-label="Close">
              ✕
            </button>
          </div>

          <div className="support-messages">
            {messages.map((msg, idx) => (
              <div key={msg.id} className={`support-msg support-msg-${msg.role}`}>
                <div className="support-bubble">
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
              <div className="support-msg support-msg-assistant">
                <div className="support-bubble support-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>

          <form
            className="support-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim() || status !== 'ready') return;
              sendMessage({ text: input });
              setInput('');
            }}
          >
            <input
              className="support-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={status !== 'ready'}
              placeholder="Ask anything…"
              autoComplete="off"
            />
            <button
              className="support-send"
              type="submit"
              disabled={status !== 'ready' || !input.trim()}
            >
              {status !== 'ready' ? '…' : 'Send'}
            </button>
          </form>
        </div>
      )}

      <button
        className="support-fab"
        onClick={toggleSupport}
        type="button"
        aria-label={support.isOpen ? 'Close support chat' : 'Open support chat'}
      >
        {support.isOpen ? '✕' : '?'}
        {!support.isOpen && support.unread > 0 && (
          <span className="support-badge">{support.unread}</span>
        )}
      </button>
    </>
  );
}
