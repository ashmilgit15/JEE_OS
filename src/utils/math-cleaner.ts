// Math Cleaner & Scraped Question Extractor Utility
// Optimized for JEE OS math rendering & RAG question quality

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  
  // Greek letters (convert to LaTeX equivalents)
  '&alpha;': '\\alpha',
  '&beta;': '\\beta',
  '&gamma;': '\\gamma',
  '&delta;': '\\delta',
  '&epsilon;': '\\epsilon',
  '&zeta;': '\\zeta',
  '&eta;': '\\eta',
  '&theta;': '\\theta',
  '&iota;': '\\iota',
  '&kappa;': '\\kappa',
  '&lambda;': '\\lambda',
  '&mu;': '\\mu',
  '&nu;': '\\nu',
  '&xi;': '\\xi',
  '&omicron;': 'o',
  '&pi;': '\\pi',
  '&rho;': '\\rho',
  '&sigma;': '\\sigma',
  '&tau;': '\\tau',
  '&upsilon;': '\\upsilon',
  '&phi;': '\\phi',
  '&chi;': '\\chi',
  '&psi;': '\\psi',
  '&omega;': '\\omega',
  '&Delta;': '\\Delta',
  '&Sigma;': '\\Sigma',
  '&Omega;': '\\Omega',
  '&Phi;': '\\Phi',
  '&Theta;': '\\Theta',

  // Math symbols
  '&deg;': '^{\\circ}',
  '&radic;': '\\sqrt',
  '&infin;': '\\infty',
  '&plusmn;': '\\pm',
  '&times;': '\\times',
  '&div;': '\\div',
  '&ne;': '\\neq',
  '&le;': '\\leq',
  '&ge;': '\\geq',
  '&sim;': '\\sim',
  '&cong;': '\\cong',
  '&ap;': '\\approx',
  '&approx;': '\\approx',
  '&prop;': '\\propto',
  '&in;': '\\in',
  '&notin;': '\\notin',
  '&sub;': '\\subset',
  '&sube;': '\\subseteq',
  '&sup;': '\\supset',
  '&supe;': '\\supseteq',
  '&cup;': '\\cup',
  '&cap;': '\\cap',
  '&int;': '\\int',
  '&sum;': '\\sum',
  '&prod;': '\\prod',
  '&part;': '\\part',
  '&nabla;': '\\nabla',
  '&rarr;': '\\rightarrow',
  '&larr;': '\\leftarrow',
  '&harr;': '\\leftrightarrow',
  '&rArr;': '\\Rightarrow',
  '&lArr;': '\\Leftarrow',
  '&hArr;': '\\Leftrightarrow',
};

function decodeNumericEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return '';
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return '';
      }
    });
}

export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  let cleaned = decodeNumericEntities(str);
  for (const [entity, replacement] of Object.entries(HTML_ENTITIES)) {
    cleaned = cleaned.replaceAll(entity, replacement);
  }
  return cleaned;
}

export function cleanMathText(text: string): string {
  if (!text) return '';
  
  // 1. Decode entities
  let cleaned = decodeHtmlEntities(text);
  
  // 2. Standardize LaTeX block/inline brackets
  cleaned = cleaned.replace(/\\\[/g, '$$').replace(/\\\]/g, '$$');
  cleaned = cleaned.replace(/\\\(/g, '$').replace(/\\\)/g, '$');
  
  // 3. Remove newline representations and collapse spaces
  cleaned = cleaned.replace(/\\n/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.trim();

  // 4. Traverse outside-math text to auto-wrap LaTeX commands
  const parts = cleaned.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      let segment = parts[i];
      
      // Auto-wrap LaTeX backslash commands (e.g., \theta, \pi, \pm) if not inside math delimiters
      segment = segment.replace(/(\\[a-zA-Z]+(?:\{[^{}]*\}|_[a-zA-Z0-9]+|\^[a-zA-Z0-9]+|)*)/g, '$$1$');
      
      // Auto-wrap standalone variables with indices/exponents (e.g., x^2, y_i, K_p, K_c, E_total)
      segment = segment.replace(/\b([a-zA-Z](?:_\{[^{}]+\}|_[a-zA-Z0-9]+|\^\{[^{}]+\}|\^[a-zA-Z0-9]+)+)\b/g, '$$1$');
      
      // Auto-wrap simple equations (e.g., x = 3, y > 0, v \ge 2)
      segment = segment.replace(/\b([a-zA-Z]\s*(?:[=<>]|\\geq|\\leq|\\neq)\s*-?[0-9a-zA-Z/]+)\b/g, '$$1$');
      
      // Fix double wrapping issues (e.g. $$x^2$ -> $x^2$)
      segment = segment.replace(/\$\$([^\$]+)\$\$/g, '$1');
      segment = segment.replace(/\$\$([^\$]+)\$/g, '$$1$');
      segment = segment.replace(/\$([^\$]+)\$\$/g, '$$1$');
      
      parts[i] = segment;
    }
  }
  
  return parts.join('');
}

// Attempts to extract questions, options, and explanations from raw scraped textbook/MCQ text
export function parseScrapedQuestions(body: string): { question: string; options: string[]; correctAnswer: number; explanation: string }[] {
  const questionsList: { question: string; options: string[]; correctAnswer: number; explanation: string }[] = [];
  
  // Clean the raw text body
  const cleanedBody = cleanMathText(body);
  
  // Find paragraphs that look like questions, typically followed by options
  // Questions might start with digits: "1. What is...", "Q2. Calculate...", "Question 3: ..."
  // Options might be: (A) ... (B) ... (C) ... (D) ... or a) ... b) ... c) ... d) ...
  const qRegex = /(?:^|\.|\?)\s*(\b(?:\d+|Q\d+|Question\s*\d+)(?:[\.\):]|\s+)[^\.\n\?]+[\?\:\n][^\n]*?)(?=(?:\s*\b(?:\d+|Q\d+|Question\s*\d+)(?:[\.\):]|\s+))|$)/gi;
  
  let match;
  while ((match = qRegex.exec(cleanedBody)) !== null) {
    const block = match[1].trim();
    if (block.length < 30) continue;
    
    // Attempt to extract options
    // Match A/B/C/D patterns
    const optRegex = /(?:\(|\[|\b)([a-d1-4A-D])(?:\)|\]|\.|\:)\s*(.*?)(?=(?:\s*(?:\(|\[|\b)[a-d1-4A-D](?:\)|\]|\.|\:))|\s*Answer|$)/gi;
    const options: string[] = [];
    const optionLabels: string[] = [];
    
    let optMatch;
    let lastIndex = -1;
    let questionText = block;
    
    while ((optMatch = optRegex.exec(block)) !== null) {
      if (lastIndex === -1) {
        lastIndex = optMatch.index;
        // Truncate the question to end before the first option starts
        questionText = block.substring(0, lastIndex).trim();
      }
      optionLabels.push(optMatch[1].toLowerCase());
      options.push(optMatch[2].trim());
    }
    
    // If we successfully found exactly 4 options
    if (options.length === 4) {
      // Look for correct answer indication: "Answer: A", "Correct option: (c)", etc.
      const ansRegex = /(?:Answer|Correct|Key|Ans)\s*(?:\:|\s+)\s*(?:\(|\[|\b)?([a-d1-4A-D])(?:\)|\]|\b)?/i;
      const ansMatch = ansRegex.exec(block);
      let correctAnswer = 0; // Default to first option
      
      if (ansMatch) {
        const val = ansMatch[1].toLowerCase();
        const idx = optionLabels.indexOf(val);
        if (idx !== -1) {
          correctAnswer = idx;
        } else {
          // Fallback mapping: a/b/c/d or 1/2/3/4
          const map: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, '1': 0, '2': 1, '3': 2, '4': 3 };
          correctAnswer = map[val] ?? 0;
        }
      }
      
      // Look for explanation
      const expRegex = /(?:Explanation|Solution|Sol)\s*(?:\:|\s+)\s*(.*)$/i;
      const expMatch = expRegex.exec(block);
      const explanation = expMatch 
        ? expMatch[1].trim() 
        : "Apply basic formulas and conceptual steps to solve the problem.";
      
      questionsList.push({
        question: cleanMathText(questionText),
        options: options.map(o => cleanMathText(o)),
        correctAnswer,
        explanation: cleanMathText(explanation)
      });
    }
  }
  
  return questionsList;
}
