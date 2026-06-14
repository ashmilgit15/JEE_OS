import React from 'react';
import katex from 'katex';
import DOMPurify from 'isomorphic-dompurify';

// Render a string with inline ($...$) and display ($$...$$) LaTeX math via
// KaTeX, returning plain text segments interleaved with rendered spans.
// Shared by the coach page, tests page and FloatingAICopilot.
//
// opts.sanitize runs the math source through DOMPurify before KaTeX. Note that
// DOMPurify treats the input as HTML, so expressions containing `<` (e.g.
// "x < y") can be altered — only enable it for untrusted sources.
export function renderInlineMath(text: string, opts?: { sanitize?: boolean }): React.ReactNode {
  if (typeof text !== 'string') return text;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const regex = /\$\$(.+?)\$\$|\$(.+?)\$/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const mathContent = match[1] || match[2];
    const displayMode = !!match[1];
    try {
      const cleanMath = opts?.sanitize ? DOMPurify.sanitize(mathContent) : mathContent;
      const html = katex.renderToString(cleanMath, { displayMode, throwOnError: false });
      parts.push(<span key={key++} dangerouslySetInnerHTML={{ __html: html }} />);
    } catch {
      parts.push(match[0]);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  if (parts.length === 0) return text;
  if (parts.length === 1 && typeof parts[0] === 'string') return parts[0];
  return <>{parts}</>;
}
