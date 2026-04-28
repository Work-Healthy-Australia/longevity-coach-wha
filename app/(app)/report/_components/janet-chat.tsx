'use client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

export function JanetChat() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });
  const [input, setInput] = useState('');

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

        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
            {msg.role === 'assistant' && <div className="chat-avatar">J</div>}
            <div className="chat-bubble">
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
