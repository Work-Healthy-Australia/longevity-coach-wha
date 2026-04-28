'use client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useChatStore } from '@/lib/stores/chat-store';
import './alex-fab.css';

export function AlexFAB() {
  const { alex, toggleAlex, closeAlex } = useChatStore();
  const pathname = usePathname();
  const [input, setInput] = useState('');

  const { messages, sendMessage, status } = useChat({
    messages: [
      {
        id: 'intro',
        role: 'assistant' as const,
        parts: [{ type: 'text' as const, text: "Hi! I'm Alex. How can I help you today?" }],
      },
    ],
    transport: new DefaultChatTransport({
      api: '/api/chat/alex',
      body: { currentPath: pathname },
    }),
  });

  return (
    <>
      {alex.isOpen && (
        <div className="alex-panel">
          <div className="alex-panel-header">
            <span className="alex-panel-title">Alex · Support</span>
            <button className="alex-panel-close" onClick={closeAlex} type="button" aria-label="Close">
              ✕
            </button>
          </div>

          <div className="alex-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`alex-msg alex-msg-${msg.role}`}>
                <div className="alex-bubble">
                  {msg.parts.map((part, i) =>
                    part.type === 'text' ? <span key={i}>{part.text}</span> : null,
                  )}
                  {status === 'streaming' &&
                    msg === messages[messages.length - 1] &&
                    msg.role === 'assistant' &&
                    '▋'}
                </div>
              </div>
            ))}
            {status === 'submitted' && (
                <div className="alex-msg alex-msg-assistant">
                  <div className="alex-bubble alex-typing">
                    <span /><span /><span />
                  </div>
                </div>
              )}
          </div>

          <form
            className="alex-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim() || status !== 'ready') return;
              sendMessage({ text: input });
              setInput('');
            }}
          >
            <input
              className="alex-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={status !== 'ready'}
              placeholder="Ask Alex anything…"
              autoComplete="off"
            />
            <button
              className="alex-send"
              type="submit"
              disabled={status !== 'ready' || !input.trim()}
            >
              {status !== 'ready' ? '…' : 'Send'}
            </button>
          </form>
        </div>
      )}

      <button
        className="alex-fab"
        onClick={toggleAlex}
        type="button"
        aria-label={alex.isOpen ? 'Close Alex support' : 'Open Alex support'}
      >
        {alex.isOpen ? '✕' : '?'}
        {!alex.isOpen && alex.unread > 0 && (
          <span className="alex-badge">{alex.unread}</span>
        )}
      </button>
    </>
  );
}
