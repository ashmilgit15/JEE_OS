'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/store';
import { handleStoreAction } from '@/utils/handleStoreAction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  GraduationCap, Plus, Trash, MessageSquare, PanelLeft, X, 
  Send, 
  Sparkles, 
  User, 
  BookOpen, 
  Lightbulb, 
  HelpCircle,
  ChevronDown,
  Globe,
  Loader2,
  CheckCircle2
} from 'lucide-react';

import katex from 'katex';
import DOMPurify from 'isomorphic-dompurify';
import { createClient } from '@/utils/supabase/client';
import { getDeviceId, getContextSummaryFromState, formatContextSummary, saveMessage } from '@/utils/supabase/conversations';
import { getDOMSummary } from '@/utils/domSummarizer';
import { MemoryStore } from '@/utils/ai/memory';
import { retrieveRelevantChunks } from '@/app/resources/page';


interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

interface Message {
  id: string;
  role: 'user' | 'tutor';
  content: string;
  logs?: string[];
  steps?: string[];
  searchResults?: Array<{ title: string; url: string; content: string }>;
  timestamp: Date;
}

const quickPrompts = [
  { label: 'Explain a concept', icon: BookOpen, prompt: 'Explain the concept of' },
  { label: 'Solve a doubt', icon: HelpCircle, prompt: 'I have a doubt about' },
  { label: 'Practice questions', icon: Sparkles, prompt: 'Generate practice questions on' },
  { label: 'Tips & tricks', icon: Lightbulb, prompt: 'What are some tips for solving' },
];

// Helper to parse stream line robustly, handling multiple or malformed JSON blocks
function parseStreamEvents(line: string): any[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  try {
    return [JSON.parse(trimmed)];
  } catch {
    // Attempt to extract multiple JSON objects using brace counting
    try {
      const objects: any[] = [];
      let braceCount = 0;
      let startIdx = -1;

      for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === '{') {
          if (braceCount === 0) startIdx = i;
          braceCount++;
        } else if (trimmed[i] === '}') {
          braceCount--;
          if (braceCount === 0 && startIdx !== -1) {
            const potentialJSON = trimmed.substring(startIdx, i + 1);
            try {
              objects.push(JSON.parse(potentialJSON));
            } catch {
              // Ignore invalid sub-blocks
            }
            startIdx = -1;
          }
        }
      }

      if (objects.length > 0) {
        return objects;
      }
    } catch {
      // Ignore fallback failure
    }
    return [];
  }
}

// Safe math expression evaluator for graphing. Uses Function constructor with
// `with(Math)` so common functions (sin, cos, sqrt, etc.) and constants (pi, e)
// are available without exposing the global scope.
export function evaluateMathExpression(expr: string, x: number): number | null {
  try {
    // Normalize LaTeX-style math to JS expressions. The LLM sometimes writes
    // "graph of $x = y$" — the captured expression is "y" but we graph y as
    // a function of x, so we treat the variable `y` in the expression as if
    // it were `x` (since "x = y" means y and x are interchangeable on this
    // line — the curve plotted is the same).
    // Also handle unicode superscripts like x² which the LLM sometimes uses.
    let processed = expr
      .replace(/\^/g, '**')
      .replace(/²/g, '**2')
      .replace(/³/g, '**3');
      
    if (processed.trim() === 'y' || /(^|[^a-zA-Z])y($|[^a-zA-Z])/.test(processed)) {
      // Replace any standalone `y` (not preceded/followed by another letter)
      // with `x`. This handles "y", "y + 1", "sin(y)", etc.
      processed = processed.replace(/\by\b/g, 'x');
    }

    // Normalize LaTeX-style math to JS expressions
    const normalized = processed
      .replace(/\\pi\b/g, 'PI')
      .replace(/\\cdot\b/g, '*')
      .replace(/\\times\b/g, '*')
      .replace(/\\div\b/g, '/')
      .replace(/\\sqrt\s*\{([^}]+)\}/g, 'Math.sqrt($1)')
      .replace(/\\sin\b/g, 'Math.sin')
      .replace(/\\cos\b/g, 'Math.cos')
      .replace(/\\tan\b/g, 'Math.tan')
      .replace(/\\log\b/g, 'Math.log10')
      .replace(/\\ln\b/g, 'Math.log')
      .replace(/\\exp\b/g, 'Math.exp')
      .replace(/\\abs\s*\{([^}]+)\}/g, 'Math.abs($1)')
      .replace(/PI/g, 'Math.PI');

     
    const fn = new Function('x', `with (Math) { return (${normalized}); }`);
    const result = fn(x);
    if (typeof result !== 'number' || !isFinite(result) || isNaN(result)) return null;
    return result;
  } catch {
    return null;
  }
}

// Render an SVG plot of a math function. Handles polynomial, trig, log, exp,
// and most common JEE-level expressions.
export function FunctionGraph({ expression, label }: { expression: string; label?: string }) {
  const W = 320;
  const H = 240;
  const PAD = 24;
  const X_MIN = -5;
  const X_MAX = 5;
  const STEP = (X_MAX - X_MIN) / W;

  // Sample the function across the X range
  const points: { x: number; y: number; onScreen: boolean }[] = [];
  for (let px = 0; px < W; px++) {
    const x = X_MIN + px * STEP;
    const y = evaluateMathExpression(expression, x);
    if (y === null) continue;
    // Map math coords to screen coords
    const sy = H / 2 - (y / 5) * (H / 2 - PAD); // 5 units up and down visible
    points.push({ x: px, y: sy, onScreen: sy >= 0 && sy <= H });
  }

  // Build SVG path, breaking on discontinuities (NaN, off-screen jumps)
  const segments: string[] = [];
  let currentSegment: string[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!p.onScreen) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment.join(' '));
        currentSegment = [];
      }
      continue;
    }
    if (currentSegment.length === 0) {
      currentSegment.push(`M ${p.x},${p.y.toFixed(2)}`);
    } else {
      currentSegment.push(`L ${p.x},${p.y.toFixed(2)}`);
    }
  }
  if (currentSegment.length > 0) segments.push(currentSegment.join(' '));

  // Axis positions (centered)
  const cx = W / 2;
  const cy = H / 2;

  return (
    <div className="my-3 rounded-lg border border-border/50 bg-card/40 p-3 inline-block">
      {label && <div className="text-xs font-semibold text-foreground mb-2">{label}</div>}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full max-w-[320px] h-auto"
        style={{ background: 'transparent' }}
        role="img"
        aria-label={(label || `y = ${expression}`).replace(/^Graph of /, '')}
      >
        {/* Grid */}
        <g stroke="currentColor" strokeOpacity="0.1" strokeWidth="1">
          {[-4, -3, -2, -1, 1, 2, 3, 4].map(i => (
            <line key={`vx${i}`} x1={cx + i * (W - 2 * PAD) / 10} y1={PAD} x2={cx + i * (W - 2 * PAD) / 10} y2={H - PAD} />
          ))}
          {[-4, -3, -2, -1, 1, 2, 3, 4].map(i => (
            <line key={`hy${i}`} x1={PAD} y1={cy + i * (H - 2 * PAD) / 10} x2={W - PAD} y2={cy + i * (H - 2 * PAD) / 10} />
          ))}
        </g>
        {/* Axes */}
        <g stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5">
          <line x1={PAD} y1={cy} x2={W - PAD} y2={cy} />
          <line x1={cx} y1={PAD} x2={cx} y2={H - PAD} />
          {/* Arrowheads */}
          <polygon points={`${W - PAD},${cy} ${W - PAD - 6},${cy - 3} ${W - PAD - 6},${cy + 3}`} fill="currentColor" fillOpacity="0.5" />
          <polygon points={`${cx},${PAD} ${cx - 3},${PAD + 6} ${cx + 3},${PAD + 6}`} fill="currentColor" fillOpacity="0.5" />
        </g>
        {/* Function plot */}
        {segments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="rgb(96, 165, 250)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {/* Axis labels */}
        <text x={W - PAD + 4} y={cy - 6} fontSize="11" fill="currentColor" fillOpacity="0.7" fontStyle="italic">x</text>
        <text x={cx + 6} y={PAD + 4} fontSize="11" fill="currentColor" fillOpacity="0.7" fontStyle="italic">y</text>
        <text x={cx - 10} y={cy + 12} fontSize="9" fill="currentColor" fillOpacity="0.5">O</text>
      </svg>
      <div className="text-[10px] text-muted-foreground font-mono mt-1.5">y = {expression}</div>
    </div>
  );
}

// Extract function expressions from the LLM's text where it references a graph.
// Returns the cleaned text (with graph placeholders removed) and the list of
// expressions to render. Patterns handled (with various qualifiers and
// punctuation between "graph" and the equation):
//   "graph of y = x"
//   "graph of f(x) = x^2"
//   "graph of y = sin(x)"
//   "graph of the parabola y = x^2"
//   "graph of the line y = 2x + 1"
//   "graph of $y = x^2$"  (math-delimited)
//   "Here is the graph: y = x^2"
//   "y = x graph"
//   "plot y = sin(x)"
//   "sketch y = x" / "draw the curve y = x"
export function extractGraphReferences(text: string, userQuery?: string): { cleanText: string; graphs: { expression: string; label: string }[] } {
  const graphs: { expression: string; label: string }[] = [];

  // Common math-shape qualifier words the LLM may insert between "graph of"
  // and the equation. Keep this list short to avoid over-matching.
  const QUALIFIER = '(?:line|equation|function|curve|relation|parabola|graph|hyperbola|ellipse|circle|wave|sine|cosine|tangent|polynomial|quadratic|linear|sinusoid|asymptote|surface|plane|inequality|region|trig)';

  const patterns: { re: RegExp; extractExpr: (m: RegExpMatchArray) => string; labelFor: (expr: string) => string }[] = [
    {
      // "graph of the line $x = y$" / "graph of the parabola $y = x^2$" / "graph of the function $f(x) = x$"
      re: new RegExp(`\\bgraph\\s+of\\s+(?:(?:the|a|an)\\s+)?${QUALIFIER}\\s+\\$\\s*(?:y|f\\s*\\(\\s*x\\s*\\)|x)\\s*=\\s*([^$]+?)\\s*\\$`, 'gi'),
      extractExpr: (m) => m[1].trim(),
      labelFor: (expr) => `Graph of y = ${expr}`,
    },
    {
      // "graph of the line y = x" / "graph of the parabola y = x^2"
      re: new RegExp(`\\bgraph\\s+of\\s+(?:(?:the|a|an)\\s+)?${QUALIFIER}\\s+(?:y|f\\s*\\(\\s*x\\s*\\)|x)\\s*=\\s*([^.\\n$:]+?)(?=[.,;:\\n]|$)`, 'gi'),
      extractExpr: (m) => m[1].trim(),
      labelFor: (expr) => `Graph of y = ${expr}`,
    },
    {
      // "graph of $y = x$" / "graph of $f(x) = x^2$" (math-delimited, no qualifier)
      re: /\bgraph\s+of\s+\$\s*(?:y|f\s*\(\s*x\s*\)|x)\s*=\s*([^$]+?)\s*\$/gi,
      extractExpr: (m) => m[1].trim(),
      labelFor: (expr) => `Graph of y = ${expr}`,
    },
    {
      // "graph of y = x" / "graph of f(x) = x^2" / "graph of x = y" (plain, no qualifier)
      re: /\bgraph\s+of\s+(?:y|f\s*\(\s*x\s*\)|x)\s*=\s*([^.\n$:]+?)(?=[.,;:\n]|$)/gi,
      extractExpr: (m) => m[1].trim(),
      labelFor: (expr) => `Graph of y = ${expr}`,
    },
    {
      // "showing the line $y = x$" / "shows the equation $y = x^2$" / "visualize the function $f(x) = x$"
      re: new RegExp(`\\b(?:show(?:ing|s)?|visualiz(?:ing|e)|display(?:ing)?|plotting|draw(?:ing)?|render(?:ing)?|depict(?:ing)?|paint(?:ing)?|illustrat(?:ing|e)|sketch(?:ing)?)\\s+(?:the\\s+)?(?:${QUALIFIER})?\\s*\\$\\s*(?:y|f\\s*\\(\\s*x\\s*\\)|x)\\s*=\\s*([^$]+?)\\s*\\$`, 'gi'),
      extractExpr: (m) => m[1].trim(),
      labelFor: (expr) => `Graph of y = ${expr}`,
    },
    {
      // "Here is the graph: y = x^2" / "Graph: y = sin(x)" / "Graph — y = x^2"
      // Matches a colon or dash followed by the equation (no dollar signs needed).
      re: /\b(?:graph|plot|figure|diagram)\s*[:\-–—]\s*(?:y|f\s*\(\s*x\s*\)|x)\s*=\s*([^.\n$:]+?)(?=[.,;:\n]|$)/gi,
      extractExpr: (m) => m[1].trim(),
      labelFor: (expr) => `Graph of y = ${expr}`,
    },
    {
      // "plot of y = x" / "plot y = sin(x)"
      re: /\bplot\s+(?:of\s+)?(?:y|f\s*\(\s*x\s*\)|x)\s*=\s*([^.\n$:]+?)(?=[.,;:\n]|$)/gi,
      extractExpr: (m) => m[1].trim(),
      labelFor: (expr) => `Plot of y = ${expr}`,
    },
    {
      // "y = x graph" / "f(x) = x^2 graph" (equation-first)
      re: /\b(?:y|f\s*\(\s*x\s*\)|x)\s*=\s*([^.\n$:]+?)\s+graph\b/gi,
      extractExpr: (m) => m[1].trim(),
      labelFor: (expr) => `Graph of y = ${expr}`,
    },
    {
      // "sketch y = x" / "draw the curve y = x" / "draw y = x"
      re: /\b(?:sketch|draw(?:\s+the)?)\s+(?:\w+\s+)?(?:y|f\s*\(\s*x\s*\)|x)\s*=\s*([^.\n$:]+?)(?=[.,;:\n]|$)/gi,
      extractExpr: (m) => m[1].trim(),
      labelFor: (expr) => `Graph of y = ${expr}`,
    },
  ];

  let cleanText = text;
  for (const { re, extractExpr, labelFor } of patterns) {
    cleanText = cleanText.replace(re, (match, ...groups) => {
      // Last arg is the full match array (in replace callback with capture groups,
      // groups are the captured values; offset/string are last). We need to
      // pass a RegExpMatchArray to extractExpr — reconstruct from the match
      // string and groups so we don't re-run the regex (which has g flag and
      // can return undefined for some groups).
      const arr = [match, ...groups.slice(0, -2)] as unknown as RegExpMatchArray;
      const expr = extractExpr(arr).trim();
      // Sanity check: expression should be short and contain math-like chars.
      // We also include unicode superscripts like ² and ³ which LLMs sometimes use.
      if (expr.length > 60 || !/[xX0-9a-zA-Z\\\^\*\+\-\/\(\) ²³]/.test(expr)) return match;
      // Reject bare placeholders like "f(x)" — these are not graphable.
      // The LLM uses "f(x) = ..." when describing a generic function; the
      // actual expression is whatever follows the "=" sign. If we got just
      // "f(x)" (a single identifier in parens), it means the regex matched
      // the variable name instead of the actual expression.
      if (/^f\s*\(\s*x\s*\)$/i.test(expr)) return match;
      graphs.push({ expression: expr, label: labelFor(expr) });
      return `\n\n[GRAPH_${graphs.length - 1}]\n\n`;
    });
  }

  // Fallback: If the LLM response contained no recognizable graph expression
  // (e.g., it just output an ASCII art block), but the user EXPLICITLY asked
  // to draw a specific graph in their query, extract it from the user's query.
  if (graphs.length === 0 && userQuery) {
    for (const { re, extractExpr, labelFor } of patterns) {
      re.lastIndex = 0;
      const match = re.exec(userQuery);
      if (match) {
        const expr = extractExpr(match).trim();
        if (expr.length > 60 || !/[xX0-9a-zA-Z\\\^\*\+\-\/\(\) ²³]/.test(expr)) continue;
        if (/^f\s*\(\s*x\s*\)$/i.test(expr)) continue;
        graphs.push({ expression: expr, label: labelFor(expr) });
        // Append the placeholder to the clean text so it gets rendered
        cleanText += `\n\n[GRAPH_${graphs.length - 1}]\n\n`;
        break;
      }
    }
  }

  return { cleanText, graphs };
}

// Merge a "fragmented" run of lines where the LLM streamed each character or
// short token on its own line. A run is considered fragmented when 3+ consecutive
// non-blank lines are all ≤ 5 characters and don't end with clear sentence-ending
// punctuation. This handles the common pattern where the LLM outputs math like
// "x\n∈\nN" or "3\n(\nx\n−\n1\n)" with blank lines around it.
//
// Code blocks (```...```) and intentional markdown structure (lists, headings,
// numbered items) are preserved untouched. Closing brackets `)`, `]`, `}` are
// treated as part of the fragmented run (they're common in math) rather than
// as sentence terminators.
function mergeFragmentedLines(text: string): string {
  // Step 1: extract code blocks so we don't merge inside them
  const codeBlockPlaceholders: string[] = [];
  const processed = text.replace(/```[\s\S]*?```/g, (match) => {
    codeBlockPlaceholders.push(match);
    return `\u0000CODEBLOCK_${codeBlockPlaceholders.length - 1}\u0000`;
  });

  const lines = processed.split('\n');
  const result: string[] = [];
  let buffer: string[] = [];
  // Only treat `.`, `!`, `?` as sentence terminators — these are unambiguous
  // sentence endings. Brackets `)`, `]`, `}` are common in math.
  const HARD_SENTENCE_END = /[.!?]$/;
  const SHORT_LIMIT = 5;
  const isShortFragment = (line: string) => {
    const t = line.trim();
    if (t.length === 0) return false;
    if (t.length > SHORT_LIMIT) return false;
    if (HARD_SENTENCE_END.test(t)) return false;
    // Skip lines that look like intentional markdown structure
    if (/^(\s*[-*+]|\s*#+\s|\s*```|\s*\||\s*\d+[.)]\s)/.test(t)) return false;
    // Skip placeholder lines
    if (/\u0000CODEBLOCK_\d+\u0000/.test(t)) return false;
    if (/^\[GRAPH_\d+\]$/.test(t)) return false;
    return true;
  };
  for (const line of lines) {
    if (isShortFragment(line)) {
      buffer.push(line.trim());
    } else {
      if (buffer.length >= 3) {
        result.push(buffer.join(' '));
        buffer = [];
      } else {
        result.push(...buffer);
        buffer = [];
      }
      result.push(line);
    }
  }
  if (buffer.length > 0) result.push(buffer.join(' '));

  // Step 2: restore code blocks
  return result.join('\n').replace(/\u0000CODEBLOCK_(\d+)\u0000/g, (_, idx) => codeBlockPlaceholders[parseInt(idx, 10)]);
}

// Custom Markdown & Citation Parser
function parseMarkdown(text: string, searchResults?: any[], userQuery?: string) {
  if (!text) return null;

  // Repair LaTeX typos (such as \yec -> \vec, dyec -> d\vec, miyec -> m\vec, and yec -> vec)
  let repairedText = text
    .replace(/\\yec/g, '\\vec')
    .replace(/dyec/g, 'd\\vec')
    .replace(/miyec/g, 'm\\vec')
    .replace(/yec/g, 'vec');

  // Extract function graph references BEFORE merging fragmented lines — the
  // placeholders are short tokens that should be preserved as their own paragraphs.
  const { cleanText, graphs } = extractGraphReferences(repairedText, userQuery);
  repairedText = cleanText;

  // Normalize escaped dollar signs \$...\$ → $...$ so the standard math parser
  // picks them up. Some LLMs (especially Gemini) emit \$ when confused about
  // whether they're in a LaTeX document or a markdown chat — treat those as
  // inline math delimiters the same as bare $...$.
  repairedText = repairedText.replace(/\\\$/g, '$');

  // Pre-merge lines that were broken across newlines by the LLM's streaming
  // tokenizer or markdown formatting. This keeps math like $24x < 100$ on a
  // single logical line so the per-line math detector works correctly. The
  // merge is conservative: it only joins lines that look like a single
  // paragraph was split (no double newline, no list marker, no heading).
  repairedText = repairedText.replace(/([^\\])\n(?!\n|#|\s*[-*]\s|```|\|)/g, '$1 ');

  // Second pass: detect and merge "fragmented" sections where the LLM streamed
  // each character or short token on its own line. Triggered when 3+ consecutive
  // non-blank lines are all very short (≤ 5 chars) and don't end with sentence
  // punctuation — this matches the broken-math pattern where the model outputs
  // e.g. "x\n∈\nN" with blank lines around it.
  repairedText = mergeFragmentedLines(repairedText);

  const lines = repairedText.split('\n');
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeContent = '';
  let inList = false;
  let listItems: string[] = [];

  const renderTextWithStyles = (lineText: string) => {
    const tokens: { type: 'text' | 'bold' | 'code' | 'citation' | 'math' | 'display-math'; content: string; index?: number }[] = [];
    let i = 0;
    while (i < lineText.length) {
      if (lineText.startsWith('**', i)) {
        const endBold = lineText.indexOf('**', i + 2);
        if (endBold !== -1) {
          tokens.push({ type: 'bold', content: lineText.slice(i + 2, endBold) });
          i = endBold + 2;
          continue;
        }
      }
      if (lineText.startsWith('`', i)) {
        const endCode = lineText.indexOf('`', i + 1);
        if (endCode !== -1) {
          tokens.push({ type: 'code', content: lineText.slice(i + 1, endCode) });
          i = endCode + 1;
          continue;
        }
      }
      
      if (lineText.startsWith('$$', i)) {
        const endDisplay = lineText.indexOf('$$', i + 2);
        if (endDisplay !== -1) {
          tokens.push({ type: 'display-math', content: lineText.slice(i + 2, endDisplay) });
          i = endDisplay + 2;
          continue;
        }
      }
      if (lineText.startsWith('$', i) && !lineText.startsWith('$$', i)) {
        const endInline = lineText.indexOf('$', i + 1);
        if (endInline !== -1) {
          tokens.push({ type: 'math', content: lineText.slice(i + 1, endInline) });
          i = endInline + 1;
          continue;
        }
      }

      const citationMatch = lineText.slice(i).match(/^\[(\d+)\]/);
      if (citationMatch) {
        const num = parseInt(citationMatch[1], 10);
        tokens.push({ type: 'citation', content: `[${num}]`, index: num });
        i += citationMatch[0].length;
        continue;
      }
      
      const lastToken = tokens[tokens.length - 1];
      if (lastToken && lastToken.type === 'text') {
        lastToken.content += lineText[i];
      } else {
        tokens.push({ type: 'text', content: lineText[i] });
      }
      i++;
    }

    return (
      <>
        {tokens.map((tok, idx) => {
          if (tok.type === 'bold') return <strong key={idx} className="font-semibold text-foreground">{renderTextWithStyles(tok.content)}</strong>;
          if (tok.type === 'code') return <code key={idx} className="px-1 py-0.5 rounded bg-muted font-mono text-xs text-amber-300">{tok.content}</code>;
          if (tok.type === 'citation') {
            const result = searchResults?.[tok.index! - 1];
            if (result) {
              return (
                <a
                  key={idx}
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-primary/20 hover:bg-primary/30 text-[10px] font-bold h-[18px] w-[18px] text-primary mx-0.5 transition-colors border border-primary/30 align-super"
                  title={result.title}
                >
                  {tok.index}
                </a>
              );
            }
            return <sup key={idx} className="text-primary font-bold text-xs">{tok.content}</sup>;
          }
          if (tok.type === 'math') {
            try {
              const cleanMath = DOMPurify.sanitize(tok.content);
              const html = katex.renderToString(cleanMath, { displayMode: false, throwOnError: false });
              return <span key={idx} className="inline-math" dangerouslySetInnerHTML={{ __html: html }} />;
            } catch {
              return <span key={idx} className="text-amber-400 italic">${tok.content}$</span>;
            }
          }
          if (tok.type === 'display-math') {
            try {
              const cleanMath = DOMPurify.sanitize(tok.content);
              const html = katex.renderToString(cleanMath, { displayMode: true, throwOnError: false });
              return <span key={idx} className="my-3 flex justify-center" style={{ display: 'block' }} dangerouslySetInnerHTML={{ __html: html }} />;
            } catch {
              return <span key={idx} className="text-amber-400 italic text-center block">$${tok.content}$$</span>;
            }
          }
          return tok.content;
        })}
      </>
    );
  };

  const flushList = (key: number) => {
    if (listItems.length === 0) return null;
    const items = [...listItems];
    listItems = [];
    return (
      <ul key={`ul-${key}`} className="list-disc pl-5 my-2 space-y-1.5 text-sm text-muted-foreground">
        {items.map((item, idx) => (
          <li key={idx}>{renderTextWithStyles(item)}</li>
        ))}
      </ul>
    );
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();

    // Handle [GRAPH_N] placeholders by rendering the actual SVG graph
    const graphMatch = trimmed.match(/^\[GRAPH_(\d+)\]$/);
    if (graphMatch) {
      const graphIdx = parseInt(graphMatch[1], 10);
      const graph = graphs[graphIdx];
      if (graph) {
        if (inList) { elements.push(flushList(idx)); inList = false; }
        elements.push(<FunctionGraph key={`graph-${idx}`} expression={graph.expression} label={graph.label} />);
        continue;
      }
    }

    // Markdown table: a line starting with | and the next line being a separator
    // (| :---: | :---: |). Group consecutive table lines and render as <table>.
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && idx + 1 < lines.length) {
      const sepLine = lines[idx + 1].trim();
      if (/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(sepLine)) {
        const headerCells = trimmed.split('|').slice(1, -1).map((c) => c.trim());
        const rows: string[][] = [];
        let i = idx + 2;
        for (; i < lines.length; i++) {
          const t = lines[i].trim();
          if (!t.startsWith('|') || !t.endsWith('|')) break;
          if (/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(t)) continue;
          rows.push(t.split('|').slice(1, -1).map((c) => c.trim()));
        }
        if (inList) { elements.push(flushList(idx)); inList = false; }
        elements.push(
          <div key={`tbl-${idx}`} className="my-3 overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-xs">
              <thead className="bg-card/60">
                <tr>{headerCells.map((c, ci) => <th key={ci} className="px-3 py-2 text-left font-semibold text-foreground border-b border-border/50">{renderTextWithStyles(c)}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr key={ri} className="border-t border-border/30">{r.map((c, ci) => <td key={ci} className="px-3 py-1.5 text-muted-foreground">{renderTextWithStyles(c)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        idx = i - 1;
        continue;
      }
    }

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // Skip empty code blocks (the LLM sometimes emits bare ```...``` with
        // no content, which renders as a confusing dark rectangle).
        const trimmedContent = codeContent.trim();
        if (trimmedContent.length > 0) {
          // ASCII-art graphs (the LLM sometimes uses code blocks to "draw" a
          // graph) are noisy when we've already extracted a real function. Detect
          // the pattern: contains `--->`/`---<` axis lines, `/` or `\` strokes,
          // and origin markers like (0,0) or O. If it looks like ASCII art AND
          // we have at least one graph already extracted, skip it.
          const isAsciiGraph = /[-]{3,}>|[-]{3,}<|\(\s*0\s*,\s*0\s*\)|^\s*\|?\s*O\s*\|?$/m.test(codeContent)
            && /[\/\\^]/.test(codeContent)
            && graphs.length > 0;
          if (!isAsciiGraph) {
            elements.push(
              <pre key={`code-${idx}`} className="p-4 rounded-lg bg-zinc-900 border border-border/50 overflow-x-auto my-3 text-xs font-mono text-zinc-300">
                <code>{codeContent}</code>
              </pre>
            );
          }
        }
        codeContent = '';
        inCodeBlock = false;
      } else {
        if (inList) {
          elements.push(flushList(idx));
          inList = false;
        }
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += line + '\n';
      continue;
    }

    if (trimmed.startsWith('## ')) {
      if (inList) { elements.push(flushList(idx)); inList = false; }
      elements.push(<h2 key={idx} className="text-base font-semibold text-foreground mt-4 mb-2">{renderTextWithStyles(trimmed.slice(3))}</h2>);
      continue;
    }

    if (trimmed.startsWith('### ')) {
      if (inList) { elements.push(flushList(idx)); inList = false; }
      elements.push(<h3 key={idx} className="text-sm font-semibold text-foreground mt-3 mb-1">{renderTextWithStyles(trimmed.slice(4))}</h3>);
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      if (inList) { elements.push(flushList(idx)); inList = false; }
      elements.push(<h4 key={idx} className="text-sm font-semibold text-foreground/90 mt-2 mb-1">{renderTextWithStyles(trimmed.slice(5))}</h4>);
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      inList = true;
      listItems.push(trimmed.slice(2));
      continue;
    }

    if (trimmed === '') {
      if (inList) {
        elements.push(flushList(idx));
        inList = false;
      }
      elements.push(<br key={idx} />);
      continue;
    }

    if (inList) {
      elements.push(flushList(idx));
      inList = false;
    }
    elements.push(<p key={idx} className="my-1.5 text-sm leading-relaxed text-muted-foreground" style={{ whiteSpace: 'pre-wrap' }}>{renderTextWithStyles(line)}</p>);
  }

  if (inList) {
    elements.push(flushList(lines.length));
  }

  return elements;
}

export default function TutorPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { 
    state, 
    dispatch, 
    completeTopicWithRevisions, 
    logStudy, 
    getTopicById,
    generateDailyPlan 
  } = useStore();

  const [messages, setMessages] = useState<Message[]>([]);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('jee-os-tutor-sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) {
          // Convert date strings to Date objects
          const hydrated = parsed.map((s: any) => ({
            ...s,
            messages: s.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
          }));
          setSessions(hydrated);
          setCurrentSessionId(hydrated[0].id);
          setMessages(hydrated[0].messages);
        }
      } catch {}
    } else {
      createNewSession();
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0 && currentSessionId) {
      const updatedSessions = sessions.map(s => 
        s.id === currentSessionId ? { ...s, messages, updatedAt: Date.now() } : s
      );
      localStorage.setItem('jee-os-tutor-sessions', JSON.stringify(updatedSessions));
      // Only update local state if we actually changed something to avoid infinite loops
      // setSessions(updatedSessions); 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, currentSessionId]);

  function createNewSession() {
    const newSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      updatedAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setMessages([]);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }

  const switchSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setCurrentSessionId(id);
      setMessages(session.messages);
      if (window.innerWidth < 768) setSidebarOpen(false);
    }
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (currentSessionId === id) {
      if (newSessions.length > 0) {
        setCurrentSessionId(newSessions[0].id);
        setMessages(newSessions[0].messages);
      } else {
        createNewSession();
      }
    }
    localStorage.setItem('jee-os-tutor-sessions', JSON.stringify(newSessions));
  };

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [pendingActions, setPendingActions] = useState<{
    id: string;
    messageId: string;
    action: string;
    args: any;
    description: string;
    confirmed: boolean;
  }[]>([]);

  const describeAction = (action: string, args: any): string => {
    switch (action) {
      case 'update_topic_status':
        return `Mark "${args.topicName || args.topicId}" as ${args.status}`;
      case 'generate_flashcards':
        return `Generate ${args.flashcards?.length || 0} flashcards for ${args.subject}`;
      case 'log_study':
        return `Log ${args.duration} minutes of study for "${args.description || args.topicId}"`;
      case 'update_profile':
        return `Update profile: ${Object.keys(args).join(', ')}`;
      case 'create_plan_task':
        return `Create task: "${args.title || 'New task'}"`;
      case 'navigate':
        return `Navigate to ${args.path}`;
      case 'schedule_revision':
        return `Schedule revision for "${args.topicName}"`;
      case 'add_insight':
        return `Add coach insight: "${args.message}"`;
      default:
        return `Execute action: ${action}`;
    }
  };

  const dismissAction = useCallback((actionId: string) => {
    setPendingActions(prev => prev.filter(a => a.id !== actionId));
  }, []);

  // --- Client-side action execution (defined before confirmAction to avoid TDZ) ---
  const handleLocalStoreAction = (action: string, args: any) => {
    try {
      console.log(`[Tutor Action Dispatcher] Executing client action: ${action}`, args);
      handleStoreAction(action, args, { dispatch, getTopicById, completeTopicWithRevisions, logStudy, state, generateDailyPlan, router });
    } catch (e) {
      console.error('Failed to execute client-side store action:', action, args, e);
    }
  };

  const confirmAction = useCallback((actionId: string) => {
    const action = pendingActions.find(a => a.id === actionId);
    if (!action || action.confirmed) return;
    handleLocalStoreAction(action.action, action.args);
    setPendingActions(prev => prev.map(a => a.id === actionId ? { ...a, confirmed: true } : a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingActions]);

  useEffect(() => {
    if (mounted) {
      const greetingContent = `Hello${state.profile.name ? ` ${state.profile.name}` : ''}! 👋 I'm your AI Tutor.
- **Explaining concepts** from Physics, Chemistry, and Mathematics
- **Solving doubts** with step-by-step solutions
- **Generating practice questions** tailored to your level
- **Providing tips and tricks** for JEE-level problem solving

You can also ask me to perform tasks, like:
- *"Mark Rotational Motion as completed"*
- *"Log 1.5 hours of study on Atomic Structure"*
- *"Add a revision task for Limits and Continuity at 4 PM"*

What would you like to learn today?`;

      setMessages(prev => {
        if (prev.length === 0) {
          return [
            {
              id: '1',
              role: 'tutor',
              content: greetingContent,
              timestamp: new Date(),
            },
          ];
        } else if (prev.length === 1 && prev[0].id === '1') {
          return [
            {
              ...prev[0],
              content: greetingContent,
            },
          ];
        }
        return prev;
      });
    }
  }, [mounted, state.profile.name]);

  

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs text-muted-foreground">Loading tutor...</p>
        </div>
      </div>
    );
  }

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    const tutorMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
      id: tutorMsgId,
      role: 'tutor',
      content: '',
      logs: [],
      steps: [],
      searchResults: [],
      timestamp: new Date(),
    }]);

    try {
      const systemPrompt = `You are an expert AI Tutor for JEE (Joint Entrance Examination) Main and Advanced, specializing in Physics, Chemistry, and Mathematics.
The student you are tutoring is named ${state.profile.name || 'Student'}, target year ${state.profile.targetYear}, in Class ${state.profile.class}, attending ${state.profile.coaching || 'self-study'} coaching, with a preferred study style of: ${state.profile.studyStyle}.
Their strong topics are: ${state.profile.strongTopics.join(', ') || 'None logged yet'}.
Their weak topics are: ${state.profile.weakTopics.join(', ') || 'None logged yet'}.

Response style:
- Be concise. For greetings ("hi", "hello", "hey") and short chit-chat, reply in 1-3 sentences with a brief intro and ask what they want to learn. Do NOT dump feature lists, study tips, or unsolicited graphs on a greeting.
- Only produce a graph, ASCII diagram, or long worked example when the student explicitly asks for one (e.g. "draw the graph of y = x", "show me how to solve this"). A casual "hi" or short question does not need any diagram.
- Never repeat the same content twice in one reply. If you already explained a concept or showed a graph, do not restate it in a different section.
- Use LaTeX formulas inside $...$ or $$...$$ when explaining math/physics formulas.

Tooling and search:
- The system has a web search tool (Tavily). For queries that need real-time or current information, the system runs a search automatically and injects results into this prompt under ONE of these headings:
    - \`### 📚 Textbook Search Results\` — for textbook/PDF lookups
    - \`### 🌐 Web Search Results\` — for general web lookups (news, current events, real-time info)
- If a heading is present, treat the results as ground truth, reference them confidently, and cite the sources.
- If the student asks for the exact text of a specific textbook exercise (e.g., "Exercise 5.1 from NCERT"), do NOT invent questions. Tell them: "I can't fetch the exact exercise text from NCERT directly, but I can add the PDF to your Material Library so you can copy the questions, or I can generate practice questions on the same topic for you. Which would you prefer?"
- Stay strictly on the topic the student asked. Do not invent sections, sub-topics, or task-completion announcements (like "Updating Your Analytics Tracker" or tips for unrelated chapters) that the student did not request.
- IMPORTANT: Do NOT call any tools (especially navigate, log_study, or update_topic_status) unless the user EXPLICITLY requests an action. For simple greetings (e.g., 'hi', 'hello'), just respond conversationally and ask how you can help. Use your available tools natively ONLY when the user gives a clear command.`;

      const chatHistory = messages
        .filter(m => m.id !== '1') // Skip initial greeting card
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        }));
      chatHistory.push({ role: 'user', content: text });

      
      if (messages.length === 0 || (messages.length === 1 && messages[0].id === '1')) {
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, title: text.slice(0, 30) + (text.length > 30 ? '...' : '') } : s));
      }

      const deviceId = getDeviceId();
      const contextSummaryState = getContextSummaryFromState(state, pathname);
      const contextSummary = formatContextSummary(contextSummaryState);
      const pageContent = getDOMSummary(pathname);
      const memory = new MemoryStore(deviceId);
      const memoryContext = await memory.getContextString(text, 8);
      const ragContext = retrieveRelevantChunks(text, state.resources || []);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatHistory,
          systemPrompt,
          deviceId,
          agentType: 'tutor',
          contextSummary,
          pageContent,
          memoryContext,
          ragContext,
        }),
      });

      // Save user message to Supabase
      try {
        const supabase = createClient();
        await saveMessage(supabase, deviceId, 'tutor', 'user', text);
      } catch (e) {
        console.warn('Failed to save user message:', e);
      }

      if (!response.ok || !response.body) {
        throw new Error('Chat completions request failed or returned empty body.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';
      let currentLogs: string[] = [];
      let currentSteps: string[] = [];
      let currentResults: any[] = [];
      let clientActionEmitted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep trailing segment

        for (const line of lines) {
          const events = parseStreamEvents(line);
          for (const event of events) {
            try {
              switch (event.type) {
                case 'text':
                  assistantText += event.content;
                  setMessages(prev => prev.map(m => m.id === tutorMsgId ? { ...m, content: assistantText } : m));
                  break;

                case 'status':
                  currentLogs = [...currentLogs, event.message];
                  setMessages(prev => prev.map(m => m.id === tutorMsgId ? { ...m, logs: currentLogs } : m));
                  break;

                case 'step_start': {
                  const stepLabel = event.step === 'textbook_search' ? 'Textbook search'
                    : event.step === 'web_search' ? 'Web search'
                    : event.step === 'llm_call' ? 'LLM call'
                    : event.step === 'tool_action' ? 'Tool action'
                    : event.step;
                  currentSteps = [...currentSteps, `▶ ${stepLabel}`];
                  setMessages(prev => prev.map(m => m.id === tutorMsgId ? { ...m, steps: currentSteps } : m));
                  break;
                }

                case 'step_end': {
                  const stepLabel = event.step === 'textbook_search' ? 'Textbook search'
                    : event.step === 'web_search' ? 'Web search'
                    : event.step === 'llm_call' ? 'LLM call'
                    : event.step === 'tool_action' ? 'Tool action'
                    : event.step;
                  const lastIdx = currentSteps.lastIndexOf(`▶ ${stepLabel}`);
                  if (lastIdx !== -1) {
                    currentSteps = currentSteps.map((s, i) => i === lastIdx ? `✓ ${stepLabel}` : s);
                  } else {
                    currentSteps = [...currentSteps, `✓ ${stepLabel}`];
                  }
                  setMessages(prev => prev.map(m => m.id === tutorMsgId ? { ...m, steps: currentSteps } : m));
                  break;
                }

                case 'tool_start':
                  currentLogs = [...currentLogs, `🔍 Running: ${event.name}...`];
                  setMessages(prev => prev.map(m => m.id === tutorMsgId ? { ...m, logs: currentLogs } : m));
                  break;

                case 'tool_end':
                  currentLogs = [...currentLogs, `✅ Completed: ${event.name}`];
                  if (event.name === 'tavily_search' && event.result?.results) {
                    currentResults = event.result.results;
                  }
                  setMessages(prev => prev.map(m => m.id === tutorMsgId ? { ...m, logs: currentLogs, searchResults: currentResults } : m));
                  break;

                case 'client_action': {
                  clientActionEmitted = true;
                  const actionId = `pa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                  const desc = describeAction(event.action, event.args);
                  const wantsConfirmation = event.action !== 'navigate';

                  // If this is a test navigation and we have cached dynamic questions,
                  // inject the dqKey into args so the test page picks them up.
                  if (event.action === 'generate_mock_test') {
                    try {
                      const pendingDqKey = sessionStorage.getItem('pendingDqKey');
                      if (pendingDqKey) {
                        event.args = { ...event.args, dqKey: pendingDqKey };
                        sessionStorage.removeItem('pendingDqKey');
                      }
                    } catch {
                      // sessionStorage may not be available; fall through
                    }
                  }

                  if (wantsConfirmation) {
                    setPendingActions(prev => [...prev, { id: actionId, messageId: tutorMsgId, action: event.action, args: event.args, description: desc, confirmed: false }]);
                    currentLogs = [...currentLogs, `💡 AI Suggested: ${desc} (awaiting confirmation)`];
                  } else {
                    handleLocalStoreAction(event.action, event.args);
                    setPendingActions(prev => [...prev, { id: actionId, messageId: tutorMsgId, action: event.action, args: event.args, description: desc, confirmed: true }]);
                    currentLogs = [...currentLogs, `✅ Done: ${desc}`];
                  }
                  setMessages(prev => prev.map(m => m.id === tutorMsgId ? { ...m, logs: currentLogs } : m));
                  break;
                }

                case 'remember':
                  try {
                    const memStore = new MemoryStore(deviceId);
                    await memStore.add(event.observation, 'observation', 'ai_tutor', event.tags || []);
                    currentLogs = [...currentLogs, `🧠 Logged observation: "${event.observation.substring(0, 40)}..."`];
                    setMessages(prev => prev.map(m => m.id === tutorMsgId ? { ...m, logs: currentLogs } : m));
                  } catch (e) {
                    console.warn('Failed to save remember event in Tutor:', e);
                  }
                  break;

                case 'resource_result':
                  if (event.payload) {
                    dispatch({ type: 'ADD_RESOURCE', payload: event.payload });
                    currentLogs = [...currentLogs, `📚 Resource added: ${event.payload.name}`];
                    setMessages(prev => prev.map(m => m.id === tutorMsgId ? { ...m, logs: currentLogs } : m));
                  }
                  break;

                case 'dynamic_questions': {
                  if (Array.isArray(event.questions) && event.questions.length > 0) {
                    const dqKey = `dq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                    try {
                      sessionStorage.setItem(dqKey, JSON.stringify({
                        questions: event.questions,
                        title: event.title,
                        chapterId: event.chapterId,
                        chapterName: event.chapterName,
                        subject: event.subject,
                        source: event.source,
                      }));
                      sessionStorage.setItem('pendingDqKey', dqKey);
                      currentLogs = [...currentLogs, `📥 Cached ${event.questions.length} extracted question(s) from ${event.source || 'source'}`];
                      setMessages(prev => prev.map(m => m.id === tutorMsgId ? { ...m, logs: currentLogs } : m));
                    } catch (e) {
                      console.warn('Failed to cache dynamic questions:', e);
                    }
                  }
                  break;
                }

                case 'error':
                  currentLogs = [...currentLogs, `❌ Error: ${event.message}`];
                  setMessages(prev => prev.map(m => m.id === tutorMsgId ? { ...m, logs: currentLogs } : m));
                  break;
              }
            } catch {
              // Ignore event processing errors
            }
          }
        }
      }

      // Safety net: if streaming ended but we got no content at all, show a fallback
      // (skip when a client_action was emitted — the user will see the confirmation card)
      if (!assistantText && !clientActionEmitted) {
        const logsFallback = currentLogs.length > 0
          ? `I received your request but couldn't generate a response. Please try again with a different phrasing.`
          : `I'm having trouble generating a response right now. Please try again.`;
        setMessages(prev => prev.map(m => m.id === tutorMsgId ? {
          ...m,
          content: logsFallback,
          logs: [...(m.logs || []), '⚠️ Response was empty — fallback message shown']
        } : m));
      } else if (!assistantText && clientActionEmitted) {
        // Surface a short status hint so the chat bubble isn't empty.
        setMessages(prev => prev.map(m => m.id === tutorMsgId ? {
          ...m,
          content: `Done.`,
          logs: [...(m.logs || []), '✅ Tool action executed (no additional text)']
        } : m));
      }

      // Save assistant message to Supabase
      if (assistantText) {
        try {
          const supabase = createClient();
          await saveMessage(supabase, deviceId, 'tutor', 'assistant', assistantText);
        } catch (e) {
          console.warn('Failed to save assistant message:', e);
        }
      }

      // Run Hermes reflection synchronously (client-driven)
      if (assistantText) {
        try {
          const context = formatContextSummary(getContextSummaryFromState(state, pathname));
          const reflectRes = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'reflect',
              query: text,
              response: assistantText,
              context: context
            })
          });
          if (reflectRes.ok) {
            const reflectData = await reflectRes.json();
            const memStore = new MemoryStore(deviceId);
            if (reflectData.userPersonaInsight && reflectData.userPersonaInsight.length > 10) {
              await memStore.add(reflectData.userPersonaInsight, 'preference', 'ai_tutor', ['hermes', 'persona'], 0.85);
            }
            if (Array.isArray(reflectData.adaptationNotes)) {
              for (const note of reflectData.adaptationNotes) {
                if (note.length > 10) {
                  await memStore.add(note, 'observation', 'ai_tutor', ['hermes', 'adaptation'], 0.7);
                }
              }
            }
          }
        } catch (reflectErr) {
          console.warn('Hermes reflection call failed:', reflectErr);
        }
      }
    } catch (err) {
      console.warn('AI Tutor stream processing failed:', err);
      // Fallback
      setMessages(prev => prev.map(m => m.id === tutorMsgId ? {
        ...m,
        content: `Sorry, I ran into an error while trying to process that request. Let's try again!`,
        logs: [...(m.logs || []), '❌ Connection Interrupted']
      } : m));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt + ' ');
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] md:h-screen w-full bg-background relative overflow-hidden">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border/50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <h2 className="font-semibold text-sm">Chats</h2>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="md:hidden">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-2">
          <Button onClick={createNewSession} className="w-full gap-2 justify-start" variant="outline">
            <Plus className="h-4 w-4" /> New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map(s => (
            <div key={s.id} onClick={() => switchSession(s.id)} className={`group flex items-center justify-between p-2 rounded-md cursor-pointer text-sm ${currentSessionId === s.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}>
              <div className="flex items-center gap-2 truncate">
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="truncate">{s.title}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0" onClick={(e) => deleteSession(s.id, e)}>
                <Trash className="h-3 w-3 text-red-400" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      
      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 h-full min-w-0">
      {/* Header */}
      <div className="border-b border-border/50 px-4 sm:px-6 py-3 sm:py-4 bg-card/20 backdrop-blur-sm shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setSidebarOpen(true)}>
            <PanelLeft className="h-5 w-5" />
          </Button>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 shrink-0">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight truncate">{sessions.find(s => s.id === currentSessionId)?.title || 'AI Tutor Coach'}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span className="truncate">Real-time Web Search & Spaced Repetition Agent Enabled</span>
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`flex gap-3.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'tutor' && (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className="max-w-[85%] flex flex-col gap-1.5">
                {/* Visual Tool Logs Accordion */}
                {message.role === 'tutor' && message.logs && message.logs.length > 0 && (
                  <div className="rounded-lg border border-border/40 bg-card/30 p-2.5 text-xs text-muted-foreground max-w-[400px]">
                    <details className="group" open={message.id === messages[messages.length - 1].id}>
                      <summary className="flex cursor-pointer items-center justify-between font-medium hover:text-foreground">
                        <span className="flex items-center gap-1.5">
                          {isStreaming && message.id === messages[messages.length - 1].id ? (
                            <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                          <span>
                            {isStreaming && message.id === messages[messages.length - 1].id
                              ? `Agent: ${message.logs[message.logs.length - 1]}`
                              : `Agent Log: Executed ${(message.steps?.length || 0)} step${(message.steps?.length || 0) === 1 ? '' : 's'}`}
                          </span>
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-2.5 space-y-1.5 pl-4 border-l border-primary/30 font-mono text-[10px] text-muted-foreground/90">
                        {message.steps && message.steps.length > 0 && (
                          <div className="mb-1.5 pb-1.5 border-b border-primary/20">
                            {message.steps.map((step, idx) => (
                              <div key={`step-${idx}`} className="flex items-center gap-1.5 py-0.5 text-emerald-400/90">
                                <span>{step}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {message.logs.map((log, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 py-0.5">
                            <span>{log}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}

                {/* Perplexity-style Citations list */}
                {message.role === 'tutor' && message.searchResults && message.searchResults.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                      <Globe className="h-3.5 w-3.5 text-primary" />
                      <span>Sources Found</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-border max-w-full">
                      {message.searchResults.map((result, idx) => (
                        <a
                          key={idx}
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col min-w-[160px] max-w-[220px] flex-shrink-0 rounded-lg border border-border/50 bg-card/50 p-2.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          <span className="font-semibold line-clamp-1 text-foreground/90">{result.title}</span>
                          <span className="text-[10px] text-muted-foreground mt-1 truncate font-mono">
                            {(() => { try { return new URL(result.url).hostname; } catch { return 'external source'; } })()}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  className={`rounded-xl px-4 py-3.5 text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                      : 'bg-card border border-border/50 shadow-sm'
                  }`}
                >
                  <div className="prose prose-invert prose-sm max-w-none" translate="no">
                    {message.role === 'tutor' 
                      ? (() => {
                          let lastQuery = '';
                          for (let i = index - 1; i >= 0; i--) {
                            if (messages[i].role === 'user') {
                              lastQuery = messages[i].content;
                              break;
                            }
                          }
                          return parseMarkdown(message.content, message.searchResults, lastQuery);
                        })()
                      : message.content
                    }
                  </div>
                </div>

                {/* AI Suggestion Confirmation Card */}
                {message.role === 'tutor' && pendingActions.some(a => a.messageId === message.id) && (
                  <div className="space-y-2">
                    {pendingActions.filter(a => a.messageId === message.id && !a.confirmed).map(action => (
                      <div key={action.id} className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-2 max-w-[400px]">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                          <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider">🤖 Suggested Action</span>
                        </div>
                        <p className="text-xs text-zinc-200 mb-2.5">{action.description}</p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => confirmAction(action.id)} 
                            className="px-3.5 py-1.5 sm:px-2.5 sm:py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors cursor-pointer"
                          >
                            ✅ Confirm
                          </button>
                          <button 
                            onClick={() => dismissAction(action.id)} 
                            className="px-3.5 py-1.5 sm:px-2.5 sm:py-1 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors cursor-pointer"
                          >
                            ✕ Dismiss
                          </button>
                        </div>
                      </div>
                    ))}

                    {pendingActions.filter(a => a.messageId === message.id && a.confirmed).map(action => (
                      <div key={action.id} className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 mt-2 flex items-center gap-2 max-w-[400px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 text-xs font-medium">Confirmed: {action.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {message.role === 'user' && (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary border border-border">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {isStreaming && messages[messages.length - 1]?.content === '' && (
            <div className="flex gap-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <div className="rounded-xl bg-card border border-border/50 px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  <span className="text-xs text-muted-foreground italic mr-2">Tutor is thinking</span>
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="border-t border-border/50 px-4 sm:px-6 py-3 sm:py-4 bg-card/10 backdrop-blur-sm shrink-0 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap gap-2 mb-3.5">
            {quickPrompts.map((qp) => (
              <button
                key={qp.label}
                onClick={() => handleQuickPrompt(qp.prompt)}
                disabled={isStreaming}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card/65 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground hover:scale-102 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <qp.icon className="h-3 w-3 text-primary/80" />
                {qp.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask me anything, or type a command (e.g. 'Mark Rotational Motion as completed')..."
              className="flex-1 bg-card border-border/50 h-11 focus-visible:ring-primary"
              disabled={isStreaming}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="shrink-0 h-11 w-11 shadow-md hover:scale-103 transition-transform"
            >
              <Send className="h-[18px] w-[18px]" />
            </Button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
