// Tavily-backed search for the AI chat route.
//
// Two flavours:
//  - executeTavilySearch: general web search (basic depth, includes an answer).
//  - executeTextbookSearch: domain-targeted JEE textbook/PDF search.
//
// Plus the query classifiers and result-validation helpers that decide whether
// a query is textbook-shaped and whether a returned result is worth surfacing.
// Extracted from api/chat/route.ts so the route can stay a thin orchestrator.

export const TAVILY_API_URL = 'https://api.tavily.com/search';

export const TEXTBOOK_DOMAINS = [
  'ncert.nic.in',
  'ncert.nic.in/textbook',
  'learncbse.in',
  'examside.com',
  'jeemain.guru',
  'vedantu.com',
  'byjus.com',
  'pdfdrive.com',
  'freebookcentre.net',
  'physicsandmathstutor.com',
  'exammate.in',
  'jeebooks.in',
  'jeepdf.com',
  'jeestudysource.com',
  'iitjeebooks.com',
  'jeepdfdownload.com',
  'jeepdfnotes.com',
];

export async function executeTavilySearch(query: string, apiKey: string) {
  const MAX_RETRIES = 1;
  const TIMEOUT_MS = 10000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(TAVILY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'basic',
          include_answer: true,
          max_results: 3,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Tavily API error: status ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      console.error('Tavily search execution failed:', err);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
}

// Textbook-specific Tavily search with domain targeting
export async function executeTextbookSearch(query: string, apiKey: string) {
  const MAX_RETRIES = 1;
  const TIMEOUT_MS = 10000;

  // Clean the query down to a focused search intent
  const cleanQuery = buildTextbookSearchQuery(query);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(TAVILY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: cleanQuery,
          search_depth: 'advanced',
          max_results: 5,
          include_domains: TEXTBOOK_DOMAINS,
          include_answer: false,
          include_raw_content: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Tavily textbook search error: status ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      console.error('Tavily textbook search failed:', err);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
}

export function isTextbookQuery(query: string): boolean {
  const lower = query.toLowerCase();

  // Specific textbook names
  const specificBooks = [
    'hc verma', 'dc pandey', 'ie irodov', 'irodov', 'resnick halliday',
    'concepts of physics', 'ms chauhan', 'op tandon', 'p bahadur',
    'rd sharma', 'rs aggarwal', 'sl loney', 'cengage', 'arihant',
    'grb', 'tmh', 'wiley', 'pearson', 'sl loney', 'halliday'
  ];

  const hasSpecificBook = specificBooks.some(b => lower.includes(b));
  const hasBookIndicator = /\b(pdf|book|textbook|download|edition|reference|solutions|guide|modules|notes|free\s+download)\b/i.test(query);

  // A query is a textbook query if:
  // 1. It explicitly asks for a book/file indicator AND mentions at least one of (ncert, jee main, jee advanced, or specific books/subjects).
  // 2. Or if it mentions a specific book name directly.
  const hasAcademicContext = /\b(ncert|jee|iit|physics|chemistry|maths|mathematics|calculus|algebra|mechanics)\b/i.test(query);

  return (hasSpecificBook || (hasBookIndicator && hasAcademicContext));
}

export function safeHostname(url: string): string {
  try {
    return `Resource from ${new URL(url).hostname}`;
  } catch {
    return 'Study Resource';
  }
}

// Strip a user's natural-language query down to a clean textbook search intent.
// Removes command phrases like "use web search and ask me questions from",
// directives like "I want", and focuses on the actual subject/grade/exercise
// keywords that a search engine can use. Without this, Tavily gets the full
// user message as a query and returns irrelevant results.
export function buildTextbookSearchQuery(rawQuery: string): string {
  const lower = rawQuery.toLowerCase();

  // Extract the subject if mentioned
  let subject = '';
  if (/\b(physics)\b/.test(lower)) subject = 'physics';
  else if (/\b(chemistry)\b/.test(lower)) subject = 'chemistry';
  else if (/\b(maths|mathematics|math)\b/.test(lower)) subject = 'mathematics';

  // Extract the class/grade
  const classMatch = lower.match(/\bclass\s*(?:1[12]|xii|x|xi|11|12|10|9|8)?\b/);
  const classLabel = classMatch ? classMatch[0] : '';

  // Extract the chapter / exercise reference
  const chapterMatch = lower.match(/\bchapter\s*\d+/i);
  const exerciseMatch = lower.match(/\bexercise\s*[\d.]+/i);

  // Extract any remaining topic words (skip common stopwords and command verbs)
  const STOPWORDS = new Set([
    'use', 'web', 'search', 'and', 'ask', 'me', 'questions', 'from', 'in', 'on', 'of',
    'a', 'an', 'the', 'to', 'please', 'find', 'get', 'give', 'show', 'tell', 'want',
    'need', 'i', 'you', 'can', 'could', 'would', 'should', 'do', 'does', 'is', 'are',
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'with', 'for', 'by',
    'this', 'that', 'these', 'those', 'about', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again',
    'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
    'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just',
    'don', 'should', 'now', 'help', 'my', 'your',
  ]);

  const tokens = lower
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));

  // Build a focused query. Order matters — search engines weight earlier terms.
  const parts: string[] = [];
  if (classLabel) parts.push(classLabel);
  parts.push('NCERT');
  if (subject) parts.push(subject);
  if (chapterMatch) parts.push(chapterMatch[0].toLowerCase());
  if (exerciseMatch) parts.push(exerciseMatch[0].toLowerCase());

  // Add remaining meaningful tokens (capped to 6) — but skip things we already added
  const alreadyAdded = new Set(parts.map(p => p.toLowerCase()));
  for (const t of tokens) {
    if (parts.length >= 10) break;
    if (alreadyAdded.has(t)) continue;
    parts.push(t);
    alreadyAdded.add(t);
  }

  parts.push('PDF free download');
  return parts.filter(Boolean).join(' ');
}

export function isAllowedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return TEXTBOOK_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

export function hasRecognizableSubjectToken(title: string): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();

  // The title must contain a SPECIFIC identifier — not just a generic "NCERT" tag.
  // Generic titles like "kemh105.pdf" or just "PDF" pass the obvious "ncert" check
  // but provide no useful context to the student.
  const SPECIFIC = [
    // Author names
    'hc verma', 'dc pandey', 'ie irodov', 'resnick', 'halliday',
    'cengage', 'arihant', 'grb', 'tmh', 'wiley', 'pearson', 'p bahadur',
    'op tandon', 'ms chauhan', 'rd sharma', 'rs aggarwal', 'sl loney',
    // Book names
    'concept of physics', 'physical chemistry', 'organic chemistry', 'inorganic chemistry',
    'master resource book', 'problems in general physics',
    // Class / grade — strong signal of useful specificity
    'class xi', 'class xii', 'class 9', 'class 10', 'class 11', 'class 12',
    'grade 9', 'grade 10', 'grade 11', 'grade 12',
    // Chapter or exercise reference
    'chapter ', 'exercise ',
    // Subject matter combined with NCERT (not just bare "NCERT" tag)
    'ncert solutions', 'ncert exemplar',
  ];

  // Drop "kemh###.pdf" style generic filenames — these are raw textbook PDFs with
  // no class/chapter/exercise info in the title.
  if (/^[a-z]{2,4}\d{2,4}\.pdf\s*$/i.test(title.trim())) return false;

  return SPECIFIC.some(t => lower.includes(t));
}

export function buildResourceFromResult(result: any, query: string): any {
  // Validation: drop results whose URL is not in the allowed domain list
  if (!result.url || !isAllowedDomain(result.url)) {
    return null;
  }

  // Validation: drop results with no recognizable subject token in the title
  // (prevents garbage like "kemh105.pdf" or "PDF" with no class/chapter info)
  if (!result.title || !hasRecognizableSubjectToken(result.title)) {
    return null;
  }

  const subject = query.toLowerCase().includes('physics') ? 'physics'
    : query.toLowerCase().includes('chemistry') ? 'chemistry'
    : query.toLowerCase().includes('math') ? 'mathematics'
    : 'general';

  const cleaned = result.title?.replace(/^\[?PDF\]?[-:\s]*/i, '').replace(/free\s*download.*$/i, '').trim();
  const rawName = (cleaned && cleaned.length > 2) ? cleaned : null;
  const name = (rawName && rawName.length > 2 && !/^[\s\[\]\-:.]+$|^\[[\]:\-\s]{0,5}\]?$/i.test(rawName))
    ? rawName
    : result.url ? safeHostname(result.url)
    : 'Study Resource';
  return {
    id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    type: 'pdf',
    subject,
    description: result.content?.substring(0, 150) || '',
    url: result.url,
    addedDate: new Date().toISOString().split('T')[0],
    source: 'ai_search',
  };
}
