'use client';

import { parse, type MathNode } from 'mathjs';

// SVG function graphing for AI chat responses: a safe math-expression
// evaluator, the <FunctionGraph> SVG plot, and extractGraphReferences()
// which pulls "graph of y = ..." patterns out of LLM text.
// Shared by the tutor page, coach page and FloatingAICopilot.

// Safe math expression evaluator for graphing. Expressions are parsed by
// mathjs's restricted math parser instead of eval/new Function, so model or
// user input cannot execute JavaScript in the browser.
const compiledExpressions = new Map<string, MathNode | null>();
const FORBIDDEN_IDENTIFIERS = /(?:constructor|prototype|__proto__|eval|function|import|require|window|document|globalThis)/i;

function normalizeMathExpression(expr: string): string {
  let processed = expr
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\pi\b/g, 'pi')
    .replace(/\\cdot\b/g, '*')
    .replace(/\\times\b/g, '*')
    .replace(/\\div\b/g, '/')
    .replace(/\\sqrt\s*\{([^}]+)\}/g, 'sqrt($1)')
    .replace(/\\sin\b/g, 'sin')
    .replace(/\\cos\b/g, 'cos')
    .replace(/\\tan\b/g, 'tan')
    .replace(/\\log\b/g, 'log10')
    .replace(/\\ln\b/g, 'log')
    .replace(/\\exp\b/g, 'exp')
    .replace(/\\abs\s*\{([^}]+)\}/g, 'abs($1)');

  // The extraction logic treats y as the dependent variable; plot it as f(x).
  if (processed.trim() === 'y' || /(^|[^a-zA-Z])y($|[^a-zA-Z])/.test(processed)) {
    processed = processed.replace(/\by\b/g, 'x');
  }
  return processed.trim();
}

function compileMathExpression(expr: string): MathNode | null {
  if (compiledExpressions.has(expr)) return compiledExpressions.get(expr) ?? null;
  const normalized = normalizeMathExpression(expr);
  let compiled: MathNode | null = null;

  if (
    normalized.length > 0 &&
    normalized.length <= 80 &&
    !FORBIDDEN_IDENTIFIERS.test(normalized) &&
    /^[0-9a-zA-Z_+\-*/^().,\s]+$/.test(normalized)
  ) {
    try {
      compiled = parse(normalized);
    } catch {
      compiled = null;
    }
  }

  compiledExpressions.set(expr, compiled);
  return compiled;
}

export function evaluateMathExpression(expr: string, x: number): number | null {
  try {
    const compiled = compileMathExpression(expr);
    if (!compiled) return null;
    const result = compiled.evaluate({ x });
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
