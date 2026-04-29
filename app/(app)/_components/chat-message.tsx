'use client';
// ai-elements: @vercel/ai-elements not published; react-markdown is the correct approach here.
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

export const REMARK_PLUGINS = [remarkGfm, remarkBreaks];

export const MD_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  a:          ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="md-a">{children}</a>,
  code:       ({ children }) => <code className="md-code">{children}</code>,
  pre:        ({ children }) => <pre className="md-pre">{children}</pre>,
  p:          ({ children }) => <p className="md-p">{children}</p>,
  ul:         ({ children }) => <ul className="md-ul">{children}</ul>,
  ol:         ({ children }) => <ol className="md-ol">{children}</ol>,
  li:         ({ children }) => <li className="md-li">{children}</li>,
  blockquote: ({ children }) => <blockquote className="md-blockquote">{children}</blockquote>,
  // Flatten headings — too large for chat bubbles
  h1: ({ children }) => <p className="md-heading">{children}</p>,
  h2: ({ children }) => <p className="md-heading">{children}</p>,
  h3: ({ children }) => <p className="md-heading">{children}</p>,
};

/**
 * Renders an assistant message with streaming animation + markdown.
 *
 * While streaming: accumulates token chunks as individually animated spans
 * so the text unfolds visually as it arrives.
 *
 * Once streaming ends: renders the complete text through ReactMarkdown so
 * the final output is properly formatted. Keeping these two phases separate
 * avoids partial-parse artefacts from feeding incomplete markdown to the parser.
 */
// Drip rate: one word every N ms, regardless of LLM chunk delivery cadence.
const WORD_INTERVAL_MS = 45;

export function AssistantBubble({
  text,
  isStreaming,
}: {
  text: string;
  isStreaming: boolean;
}) {
  // words already rendered on screen
  const [displayed, setDisplayed] = useState<string[]>([]);
  // pending word queue — filled as LLM delivers chunks
  const queueRef = useRef<string[]>([]);
  const consumedRef = useRef('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Feed new text from LLM into the word queue
  useEffect(() => {
    if (!isStreaming) return;
    const next = text.slice(consumedRef.current.length);
    if (!next) return;
    consumedRef.current = text;
    // Split on whitespace boundaries, keeping the delimiter with the preceding token
    const words = next.match(/\S+\s*/g) ?? [next];
    queueRef.current.push(...words);
  }, [text, isStreaming]);

  // Start/stop the drip timer with streaming state
  useEffect(() => {
    if (isStreaming) {
      intervalRef.current = setInterval(() => {
        const word = queueRef.current.shift();
        if (word !== undefined) {
          setDisplayed((d) => [...d, word]);
        }
      }, WORD_INTERVAL_MS);
    } else {
      // Streaming ended — clear interval, flush any queued words immediately
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      const remaining = queueRef.current.splice(0);
      if (remaining.length) {
        setDisplayed((d) => [...d, ...remaining]);
      }
      // Reset for next message
      setTimeout(() => {
        setDisplayed([]);
        consumedRef.current = '';
      }, 0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isStreaming]);

  if (!isStreaming) {
    return (
      <div className="md-body">
        <ReactMarkdown components={MD_COMPONENTS} remarkPlugins={REMARK_PLUGINS}>
          {text}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <span>
      {displayed.map((word, i) => (
        <span key={i} className="chat-chunk">{word}</span>
      ))}
    </span>
  );
}
