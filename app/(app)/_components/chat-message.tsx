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
export function AssistantBubble({
  text,
  isStreaming,
}: {
  text: string;
  isStreaming: boolean;
}) {
  const [chunks, setChunks] = useState<string[]>([]);
  const prevRef = useRef('');

  useEffect(() => {
    if (!isStreaming) {
      setChunks([]);
      prevRef.current = '';
      return;
    }
    const next = text.slice(prevRef.current.length);
    if (next) {
      prevRef.current = text;
      setChunks((c) => [...c, next]);
    }
  }, [text, isStreaming]);

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
      {chunks.map((chunk, i) => (
        <span key={i} className="chat-chunk">{chunk}</span>
      ))}
    </span>
  );
}
