"use client";

import { useRef, useState, useTransition } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function JanetChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    setStreaming(true);
    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        startTransition(() => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: updated[updated.length - 1].content + chunk,
            };
            return updated;
          });
        });
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>Janet is ready to help. Ask anything about your health results.</p>
            <div className="chat-starters">
              {[
                "What does my biological age mean?",
                "Which supplement should I prioritise first?",
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

        {messages.map((msg, i) => (
          <div key={i} className={`chat-message chat-message-${msg.role}`}>
            {msg.role === "assistant" && (
              <div className="chat-avatar">J</div>
            )}
            <div className="chat-bubble">
              {msg.content || (streaming && i === messages.length - 1 ? "▋" : "")}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="chat-form">
        <input
          type="text"
          className="chat-input"
          placeholder="Ask Janet anything…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
          autoComplete="off"
        />
        <button
          type="submit"
          className="chat-send"
          disabled={streaming || !input.trim()}
        >
          {streaming ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
