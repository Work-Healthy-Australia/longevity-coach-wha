"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

export function ClinicianJanetChat({ reviewId }: { reviewId: string }) {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/clinician/chat",
      body: { reviewId },
    }),
  });
  const [input, setInput] = useState("");

  return (
    <div className="cw-chat">
      <div className="cw-chat-messages">
        {messages.length === 0 && (
          <div className="cw-chat-empty">
            <p>Ask Janet about this patient&rsquo;s check-in. When you&rsquo;re ready, ask her to draft the 30-day program.</p>
            <div className="cw-chat-starters">
              {[
                "What stands out in this month's check-in?",
                "What's the biggest adherence concern?",
                "Draft the 30-day program.",
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  className="cw-chat-starter"
                  onClick={() => setInput(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`cw-chat-message ${m.role}`}>
            <div className="cw-chat-role">{m.role === "assistant" ? "Janet" : "You"}</div>
            <div className="cw-chat-bubble">
              {m.parts.map((p, i) => {
                if (p.type === "text") return <span key={i} style={{ whiteSpace: "pre-wrap" }}>{p.text}</span>;
                if (p.type === "tool-submit_30_day_program" || p.type?.toString().startsWith("tool-")) {
                  return (
                    <em key={i} style={{ color: "#1d6e3a" }}>
                      Janet drafted the 30-day program — open the program tab to review and approve.
                    </em>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {status === "submitted" && (
          <div className="cw-chat-message assistant">
            <div className="cw-chat-role">Janet</div>
            <div className="cw-chat-bubble cw-chat-typing"><span /><span /><span /></div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || status !== "ready") return;
          sendMessage({ text: input });
          setInput("");
        }}
        className="cw-chat-form"
      >
        <input
          className="cw-chat-input"
          placeholder="Ask Janet about this patient…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={status !== "ready"}
          autoComplete="off"
        />
        <button type="submit" disabled={status !== "ready" || !input.trim()}>
          {status !== "ready" ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
