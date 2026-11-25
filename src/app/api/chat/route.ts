import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { saveMessage, loadConversationHistory } from '@/utils/supabase/conversations';
import { executeDeepResearch } from '@/utils/ai';
import { ServerMemoryStore } from '@/utils/ai/serverMemory';
import { noopMemory, type MemoryLike } from '@/utils/ai/memoryTypes';
import { toolSchemas, executeServerTool } from '@/utils/ai/tools';
import {
  executeTavilySearch,
  executeTextbookSearch,
  isTextbookQuery,
  buildResourceFromResult,
} from '@/utils/ai/search';
import { createNdjsonWriter } from '@/utils/ai/stream';
import { buildContextInjection, TOOL_INSTRUCTIONS } from '@/utils/ai/prompt';
import { checkRateLimit } from '@/utils/durable-rate-limit';
import { z } from 'zod';
import { parseScrapedQuestions } from '@/utils/math-cleaner';
import { defaultSyllabus } from '@/data/syllabus';
import { parseOrdinalTopicQuery, resolveOrdinalPosition, chapterNameMatchesQuery } from '@/utils/topicMatcher';
import { serverEnv, env } from '@/lib/env';
import { reportError } from '@/lib/observability';
import type { ChatEvent } from '@/types/chatEvents';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow sufficient time for multi-turn search runs

const HACKCLUB_API_URL = 'https://ai.hackclub.com/proxy/v1/chat/completions';
const GREETINGS = ['hi', 'hello', 'hey', 'greetings', 'sup', 'yo', 'good morning', 'good afternoon', 'good evening'];
const CAPABILITIES = ['what can you do', 'who are you', 'what are your capabilities', 'what do you do', 'help me', 'how to use', 'features', 'what is this website'];
const JEE_KEYWORDS = [
  'jee', 'neet', 'iit', 'nit', 'syllabus', 'cutoff', 'exam date', 'exam pattern',
  'previous year', 'pyq', 'ncert', 'coaching', 'nta', 'rank predictor', 'percentile',
  'physics', 'chemistry', 'maths', 'mathematics', 'formula', 'theorem', 'derivation',
  'solve', 'calculate', 'derive', 'prove', 'evaluate', 'integrate', 'differentiate',
  'equilibrium', 'reaction', 'organic', 'inorganic', 'electrostatics', 'magnetism',
  'kinematics', 'thermodynamics', 'optics', 'waves', 'modern physics', 'nuclear',
  'newton', 'coulomb', 'gauss', 'faraday', 'ohm', 'kirchhoff', 'bernoulli',
  'coordinate geometry', 'calculus', 'probability', 'matrices', 'vectors', 'trigonometry',
  'sets', 'relations', 'functions', 'inequalities', 'complex numbers', 'binomial',
  'permutations', 'combinations', 'sequences', 'series', 'limits', 'continuity',
  'differentiability', 'integration', 'area', 'differential equations',
  'straight lines', 'circles', 'parabola', 'ellipse', 'hyperbola',
  'mole concept', 'atomic structure', 'periodic table', 'chemical bonding',
  'thermodynamics chemistry', 'chemical kinetics', 'electrochemistry', 'solutions',
  'hydrocarbons', 'organic chemistry', 'goc', 'isomerism', 'p block', 'd block',
  'friction', 'newton laws', 'work energy', 'rotation', 'gravitation', 'shm',
  'tips', 'tricks', 'shortcuts', 'how to solve', 'method', 'strategy',
];
const EXPLICIT_SEARCH = ['search', 'look up', 'find online', 'realtime', 'latest update', 'current news', 'tavily', 'web search', 'research', 'google', 'bing'];

function isGeneralWebSearchQuery(query: string): boolean {
  if (isTextbookQuery(query)) return false;
  const lower = query.toLowerCase();
  
  if (GREETINGS.some(g => lower === g || lower.startsWith(g + ' ') || lower.startsWith(g + '!'))) return false;
  if (CAPABILITIES.some(c => lower.includes(c) || lower === 'help' || lower === '?')) return false;

  if (EXPLICIT_SEARCH.some(kw => lower.includes(kw))) return true;
  if (/20(2[4-9]|[3-9]\d)/.test(query)) return true;
  
  const TIME_SENSITIVE = ['latest', 'current', 'recent', 'today', 'this year', 'now', 'breaking', 'news', 'announce', 'released', 'winner', 'won', 'champion', 'finals', 'tournament'];
  if (TIME_SENSITIVE.some(kw => lower.includes(kw))) return true;

  return false;
}


// List of all JEE syllabus topics for the smart fallback parser
interface SyllabusTopic {
  id: string;
  name: string;
  chapterId: string;
  chapterName: string;
  subject: 'physics' | 'chemistry' | 'mathematics';
}

const SYLLABUS_TOPICS: SyllabusTopic[] = defaultSyllabus.flatMap(sub =>
  sub.chapters.flatMap(ch =>
    ch.topics.map(t => ({
      id: t.id,
      name: t.name,
      chapterId: ch.id,
      chapterName: ch.name,
      subject: sub.id as SyllabusTopic['subject'],
    })),
  ),
);

// Levenshtein distance for typo-tolerant matching (e.g. "stociometry" → "stoichiometry")
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }
  const maxLen = Math.max(a.length, b.length);
  const dist = levenshtein(a, b);
  return (maxLen - dist) / maxLen;
}

function findTopicByName(input: string): SyllabusTopic | null {
  const cleanInput = input.toLowerCase().trim();
  if (!cleanInput) return null;

  // Handle ordinal references like "1st chapter in chemistry"
  const ordinalMatch = cleanInput.match(/^(1st|first|2nd|second|3rd|third|\d+th)\s+chapter(?:\s+in\s+|\s+of\s+)(physics|chemistry|maths?|mathematics)$/i);
  if (ordinalMatch) {
    const ordRaw = ordinalMatch[1].toLowerCase();
    let index = 0;
    if (['1st', 'first'].includes(ordRaw)) index = 0;
    else if (['2nd', 'second'].includes(ordRaw)) index = 1;
    else if (['3rd', 'third'].includes(ordRaw)) index = 2;
    else {
      const num = parseInt(ordRaw);
      if (!isNaN(num) && num > 0) index = num - 1;
    }

    let subj = ordinalMatch[2].toLowerCase();
    if (subj.startsWith('math')) subj = 'mathematics';

    // Find all unique chapters for this subject in order
    const subjTopics = SYLLABUS_TOPICS.filter(t => t.subject === subj);
    const uniqueChapterIds = Array.from(new Set(subjTopics.map(t => t.chapterId)));

    if (index >= 0 && index < uniqueChapterIds.length) {
      const targetChapterId = uniqueChapterIds[index];
      // Return the first topic of this chapter as a representative
      const topic = subjTopics.find(t => t.chapterId === targetChapterId);
      if (topic) return topic;
    }
  }

  // Handle ordinal references for topics like "first topic of Mechanics" or "1st topic of Mechanics"
  const ordinalQuery = parseOrdinalTopicQuery(cleanInput);
  if (ordinalQuery) {
    // Prefer an exact chapter-name match before falling back to loose matching
    let chapterTopics = SYLLABUS_TOPICS.filter(t => t.chapterName.toLowerCase() === ordinalQuery.chapterQuery);
    if (chapterTopics.length === 0) {
      chapterTopics = SYLLABUS_TOPICS.filter(t => chapterNameMatchesQuery(t.chapterName, ordinalQuery.chapterQuery));
    }
    const ordinalIndex = resolveOrdinalPosition(ordinalQuery.position, chapterTopics.length);
    if (ordinalIndex >= 0) {
      return chapterTopics[ordinalIndex];
    }
  }

  // Reject inputs that are too short or are common pronouns/stop words
  // — these would fuzzy-match to random topics (e.g. "it" → "Gravitation")
  const STOP_WORDS = new Set([
    'it', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'shall', 'can', 'this', 'that', 'these', 'those', 'he', 'she',
    'they', 'we', 'you', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
    'its', 'our', 'their', 'what', 'which', 'who', 'whom', 'where', 'when', 'why',
    'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'one', 'two', 'first', 'last', 'next', 'new', 'old', 'good', 'bad',
    'topic', 'chapter', 'subject', 'section', 'unit', 'part',
  ]);
  // Single stop word or very short non-specific input → reject
  if (STOP_WORDS.has(cleanInput)) return null;
  if (cleanInput.length < 3) return null;
  // Multi-word but ALL words are stop words → reject (e.g. "the first one")
  const inputWords = cleanInput.split(/\s+/);
  if (inputWords.every(w => STOP_WORDS.has(w))) return null;

  // Exact or contains match
  let bestMatch: SyllabusTopic | null = null;
  let highestScore = 0;

  for (const topic of SYLLABUS_TOPICS) {
    const topicName = topic.name.toLowerCase();

    if (topicName === cleanInput) {
      return topic; // Perfect match
    }

    if (topicName.includes(cleanInput) || cleanInput.includes(topicName)) {
      const score = topicName.includes(cleanInput)
        ? cleanInput.length / topicName.length
        : topicName.length / cleanInput.length;
      if (score > highestScore) {
        highestScore = score;
        bestMatch = topic;
      }
    }
  }

  // Token-based fuzzy match (handles typos like "moleconcepts" → "Mole Concept")
  if (!bestMatch || highestScore < 0.6) {
    const inputTokens = cleanInput
      .split(/[\s,&]+/)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length >= 3);
    if (inputTokens.length === 0) return bestMatch;

    let bestFuzzyScore = 0;
    let bestFuzzyTopic: SyllabusTopic | null = null;

    for (const topic of SYLLABUS_TOPICS) {
      const topicTokens = topic.name.toLowerCase()
        .split(/[\s,&]+/)
        .map(w => w.replace(/[^a-z0-9]/g, ''))
        .filter(w => w.length >= 3);
      if (topicTokens.length === 0) continue;

      let matchedScore = 0;
      for (const inputToken of inputTokens) {
        let tokenBest = 0;
        for (const topicToken of topicTokens) {
          const sim = tokenSimilarity(inputToken, topicToken);
          if (sim > tokenBest) tokenBest = sim;
        }
        // Accept tokens that are >= 0.55 similar (allows ~2 edits in 5 chars)
        if (tokenBest >= 0.55) matchedScore += tokenBest;
      }

      const totalScore = matchedScore / inputTokens.length;
      if (totalScore > bestFuzzyScore) {
        bestFuzzyScore = totalScore;
        bestFuzzyTopic = topic;
      }
    }

    if (bestFuzzyTopic && bestFuzzyScore >= 0.55 && bestFuzzyScore > highestScore) {
      bestMatch = bestFuzzyTopic;
    }
  }

  return bestMatch;
}


// Extract tool intent from user query or structured markers from LLM response.
// Returns true if a client_action was emitted.
// Priority: 1) Structured markers [MARK:...] or [LOG:...] from LLM,
//           2) Regex-based intent parsing on query/assistant text.

export async function POST(req: Request) {
  try {
    // Rate Limiting (durable / distributed — see utils/durable-rate-limit.ts)
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    if (!(await checkRateLimit(ip, 30))) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await req.json();

    // Input Validation — unknown fields are stripped (no passthrough), and every
    // field consumed by the handler is whitelisted and length-capped here.
    const ChatSchema = z.object({
      messages: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system', 'tool']),
        content: z.string().max(40_000),
      })).max(100).optional(),
      systemPrompt: z.string().max(40_000).optional(),
      deviceId: z.string().max(128).optional(),
      agentType: z.string().max(64).optional(),
      action: z.string().max(64).optional(),
      query: z.string().max(8_000).optional(),
      response: z.string().max(40_000).optional(),
      context: z.string().max(16_000).optional(),
      contextSummary: z.string().max(16_000).optional(),
      pageContent: z.string().max(32_000).optional(),
      memoryContext: z.string().max(32_000).optional(),
      ragContext: z.string().max(64_000).optional(),
    });

    const parsed = ChatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const {
      messages = [],
      systemPrompt,
      deviceId,
      agentType,
      contextSummary,
      pageContent,
      memoryContext,
      action,
      query,
      response,
      context,
      ragContext
    } = parsed.data;

    const { hackClubApiKey, hackClubModel, tavilyApiKey } = serverEnv();

    if (action === 'reflect') {
      if (!hackClubApiKey) {
        return NextResponse.json({ error: 'Hack Club API Key not configured' }, { status: 400 });
      }
      // Reflection triggers an extra LLM call per chat turn — keep its own tighter bucket
      if (!(await checkRateLimit(`${ip}:reflect`, 10))) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      }
      try {
        const reflectionPrompt = `You are Hermes, a meta-cognitive reflection engine. Your sole purpose is to analyze an AI-user interaction and extract insights to make future responses better.

Analyze the following interaction and return a JSON object with these fields:
- adaptationNotes: array of strings — what should the AI adapt about its approach for this user?
- confidenceAdjustment: number from -0.3 to +0.3 — how much to adjust response confidence based on user engagement
- suggestedTools: array of strings — what tools would have been useful here?
- userPersonaInsight: string or null — a single insight about this user's learning style

Interaction:
User Query: ${String(query || '').slice(0, 500)}
AI Response: ${String(response || '').slice(0, 1000)}
User's Learning Context: ${String(context || '').slice(0, 300)}

Return ONLY valid JSON, no other text.`;

        const res = await fetch(HACKCLUB_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hackClubApiKey}` },
          body: JSON.stringify({
            model: hackClubModel,
            messages: [{ role: 'system', content: reflectionPrompt }],
            temperature: 0.3,
            max_tokens: 500,
          }),
        });

        if (!res.ok) {
          return NextResponse.json({ error: 'Reflection request failed' }, { status: 502 });
        }

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        const json = JSON.parse(text.replace(/```json|```/g, '').trim());
        return NextResponse.json(json);
      } catch (e: any) {
        console.error('Reflection route failed:', e);
        return NextResponse.json({ error: 'Reflection failed' }, { status: 500 });
      }
    }

    const encoder = new TextEncoder();
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    };

    // Extract user's latest query
    const userMessages = messages.filter((m: any) => m.role === 'user');
    const latestQuery = userMessages[userMessages.length - 1]?.content || '';

    // Requests that fan out to Tavily (textbook/web/deep research) burn paid API
    // quota — give them a tighter bucket than plain chat.
    const triggersExternalSearch = !!tavilyApiKey && (
      isTextbookQuery(latestQuery) ||
      isGeneralWebSearchQuery(latestQuery) ||
      /\[DEEP_RESEARCH:|deep research|research deeply|comprehensive research|multi.?step research/i.test(latestQuery)
    );
    if (triggersExternalSearch) {
      if (!(await checkRateLimit(`${ip}:search`, 10))) {
        return NextResponse.json({ error: 'Search rate limit exceeded, please slow down' }, { status: 429 });
      }
    }

    // Shared memory for this session. Backed by Supabase (ai_memory table) so
    // recollections persist across requests/devices. Falls back to a no-op when
    // Supabase or a device id is unavailable (local-only / anonymous mode).
    let memory: MemoryLike = noopMemory;
    if (deviceId && env.supabaseConfigured) {
      try {
        const cookieStore = await cookies();
        memory = new ServerMemoryStore(createClient(cookieStore), deviceId);
      } catch (memErr) {
        reportError(memErr, { scope: 'chat-route', tags: { phase: 'memory-init' } });
      }
    }

    // Load conversation history from Supabase for context engineering
    let conversationHistory: { role: string; content: string }[] = [];
    if (deviceId && agentType && env.supabaseConfigured) {
      try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);
        conversationHistory = await loadConversationHistory(supabase, deviceId, agentType, 15);
      } catch (e) {
        console.warn('Failed to load conversation history:', e);
      }
    }

    // Check if we should use fallback (either Hack Club API is not set or we want to guarantee success if it fails)
    const useFallback = !hackClubApiKey;

    // Stream definition — textbook search runs INSIDE the stream so we can emit status events
    const stream = new ReadableStream({
      async start(controller) {
        // Single close path: the stream must close exactly once, no matter which
        // branch (fallback, LLM, error) finishes the response. See utils/ai/stream.ts.
        const writer = createNdjsonWriter(controller, encoder);
        const sendEvent = writer.send;
        const closeStream = writer.close;
        try {

        // Check for textbook query and search inside the stream
        let textbookSearchResults: any = null;
        if (isTextbookQuery(latestQuery) && tavilyApiKey) {
          sendEvent({ type: 'step_start', step: 'textbook_search' });
          sendEvent({ type: 'status', message: 'Searching for textbooks and resources...' });
          sendEvent({ type: 'tool_start', id: 'textbook_search', name: 'textbook_search' });
          try {
            textbookSearchResults = await executeTextbookSearch(latestQuery, tavilyApiKey);
            if (textbookSearchResults?.results?.length > 0) {
              const resources = textbookSearchResults.results
                .map((r: any) => buildResourceFromResult(r, latestQuery))
                .filter((r: any): r is any => r !== null);
              sendEvent({ type: 'tool_end', id: 'textbook_search', name: 'textbook_search', result: { results: resources } });
              for (const res of resources) {
                sendEvent({ type: 'resource_result', payload: res });
              }
              sendEvent({ type: 'status', message: `Found ${resources.length} resource(s), generating response...` });
              sendEvent({ type: 'step_end', step: 'textbook_search', result: { count: resources.length } });
            } else {
              sendEvent({ type: 'tool_end', id: 'textbook_search', name: 'textbook_search', result: { results: [] } });
            }
          } catch (e) {
            console.warn('Textbook search failed (non-fatal):', e);
            sendEvent({ type: 'tool_end', id: 'textbook_search', name: 'textbook_search', result: { results: [], error: true } });
            sendEvent({ type: 'step_end', step: 'textbook_search', result: { error: true } });
          }
        }

        let webSearchResults: any = null;
        if (!textbookSearchResults && isGeneralWebSearchQuery(latestQuery) && tavilyApiKey) {
          sendEvent({ type: 'step_start', step: 'web_search' });
          sendEvent({ type: 'status', message: 'Searching the web for current information...' });
          sendEvent({ type: 'tool_start', id: 'call_search', name: 'tavily_search' });
          try {
            webSearchResults = await executeTavilySearch(latestQuery, tavilyApiKey);
            sendEvent({ type: 'tool_end', id: 'call_search', name: 'tavily_search', result: webSearchResults });
            sendEvent({ type: 'status', message: 'Synthesizing response and generating answer...' });
            sendEvent({ type: 'step_end', step: 'web_search', result: { completed: true } });
          } catch (e) {
            console.warn('General web search failed (non-fatal):', e);
            sendEvent({ type: 'tool_end', id: 'call_search', name: 'tavily_search', result: null, error: true });
            sendEvent({ type: 'step_end', step: 'web_search', result: { error: true } });
          }
        }

        if (useFallback) {
          // In fallback mode, the textbook search already happened.
          // Now run the fallback (which also checks isTextbookQuery, but we bypass searching again
          // by passing already-found results via a modified flow).
          if (textbookSearchResults?.results?.length > 0) {
            const resources = textbookSearchResults.results
              .map((r: any) => buildResourceFromResult(r, latestQuery))
              .filter((r: any): r is any => r !== null);
            let contentStr = `### 📚 Found Textbooks & Resources\n\nI searched for "${latestQuery}" and found the following resources:\n\n`;
            resources.slice(0, 5).forEach((res: any, idx: number) => {
              contentStr += `**${idx + 1}. [${res.name}](${res.url})**\n`;
              if (res.description) contentStr += `   > ${res.description.substring(0, 150)}\n`;
              contentStr += `   *Added to your Material Library — you can download it from the Resources tab.*\n\n`;
            });
            contentStr += `You can also ask me to search for more specific textbooks, reference books, or study materials by telling me what you need!`;
            sendEvent({ type: 'text', content: contentStr });
          } else if (webSearchResults?.results?.length > 0) {
              let contentStr = `### 🌐 Web Search Results

I searched the web for "${latestQuery}" and found the following:

`;
              if (webSearchResults.answer) contentStr += `${webSearchResults.answer}

`;
              contentStr += `**Sources:**
`;
              webSearchResults.results.slice(0, 3).forEach((res: any, idx: number) => {
                contentStr += `${idx + 1}. [${res.title}](${res.url})
`;
              });
              sendEvent({ type: 'text', content: contentStr });
            } else {
            await runSmartFallback(latestQuery, tavilyApiKey || '', sendEvent);
          }
          closeStream();
          return;
        }

        try {
          // Attempt actual API call
          const currentMessages: { role: string; content: string }[] = [];

          // ── Shared Memory Injection ─────────────────────────────────────
          let finalMemoryContext = memoryContext || '';
          if (!finalMemoryContext) {
            try {
              finalMemoryContext = await memory.getContextString(latestQuery, 8);
              await memory.add(
                `User asked about: ${latestQuery.slice(0, 200)}`,
                'interaction_summary',
                'system',
                [agentType || 'general'],
                0.3,
              );
            } catch (e) {
              console.warn('Memory injection failed:', e);
            }
          }

          // ── Deep Research Agent ──────────────────────────────────────────
          let deepResearchResults: any = null;
          // Reduced Tavily API calls: only trigger on explicit deep research requests or very specific complex markers.
          const isDeepResearch = /\[DEEP_RESEARCH:|deep research|research deeply|comprehensive research|multi.?step research/i.test(latestQuery);
          if (isDeepResearch && tavilyApiKey && !textbookSearchResults && !webSearchResults) {
            sendEvent({ type: 'step_start', step: 'deep_research' });
            sendEvent({ type: 'status', message: '🔬 Initiating deep research agent...' });
            try {
              deepResearchResults = await executeDeepResearch(latestQuery, tavilyApiKey, (status) => {
                sendEvent({ type: 'status', message: status });
              }, memory);
              if (deepResearchResults?.synthesis) {
                sendEvent({ type: 'status', message: `✓ Deep research complete — ${deepResearchResults.totalSources} sources synthesized` });
                sendEvent({ type: 'step_end', step: 'deep_research', result: { findings: deepResearchResults.findings.length, sources: deepResearchResults.totalSources } });
              }
            } catch (e) {
              console.warn('Deep research failed:', e);
              sendEvent({ type: 'step_end', step: 'deep_research', result: { error: true } });
            }
          }

          // Build system prompt with context engineering (see utils/ai/prompt.ts)
          let augmentedSystemPrompt = buildContextInjection(systemPrompt || '', {
            contextSummary,
            finalMemoryContext,
            pageContent,
            ragContext,
          });
          augmentedSystemPrompt += TOOL_INSTRUCTIONS;

          // Inject textbook search results if available
          if (textbookSearchResults?.results?.length > 0) {
            const resources = textbookSearchResults.results
              .map((r: any) => buildResourceFromResult(r, latestQuery))
              .filter((r: any): r is any => r !== null);
            const resourcesInfo = resources.map((r: any, i: number) =>
              `${i + 1}. **${r.name}** — ${r.description ? r.description.substring(0, 100) + '...' : ''}\n   📥 ${r.url}`
            ).join('\n');
            augmentedSystemPrompt += `\n\n---\n### 📚 Textbook Search Results\n*The system ran a textbook search for you. Here are the findings — you can reference them confidently:*\n\n${resourcesInfo}\n\nIf the student asks for the exact text of a specific exercise, point them to the PDF link above rather than inventing questions. The resources have been added to the student's Material Library automatically.`;
          }

          // Inject general web search results if available
          if (webSearchResults?.results?.length > 0) {
            let webInfo = '';
            if (webSearchResults.answer) webInfo += `**Summary:** ${webSearchResults.answer}\n\n`;
            webInfo += `**Sources:**\n` + webSearchResults.results.map((r: any, i: number) => 
              `${i + 1}. [${r.title}](${r.url})\n${r.content.substring(0, 200)}...`
            ).join('\n\n');
            augmentedSystemPrompt += `\n\n---\n### 🌐 Web Search Results\n*The system ran a web search for you. Here are the findings:*\n\n${webInfo}`;
          }

          // Inject deep research results if available
          if (deepResearchResults?.synthesis) {
            augmentedSystemPrompt += `\n\n---\n### 🔬 Deep Research Results\n*The system performed multi-step research on your query. Here is the synthesis:*\n\n${deepResearchResults.synthesis}\n`;
          }

          if (augmentedSystemPrompt) {
            currentMessages.push({ role: 'system', content: augmentedSystemPrompt });
          }

          // Prepend conversation history
          if (conversationHistory.length > 0) {
            currentMessages.push(...conversationHistory);
          }

          currentMessages.push(...messages);

          let assistantContent = '';

          const hackClubController = new AbortController();
          const hackClubTimeoutId = setTimeout(() => hackClubController.abort(), 55000);

          sendEvent({ type: 'step_start', step: 'llm_call' });
          
          // Disable tools for simple conversational greetings to prevent aggressive tool hallucination
          const isSimpleGreeting = /^(hi|hello|hey|yo|greetings|morning|afternoon|evening)\s*$/i.test(latestQuery.trim());
          
          const payload: any = {
            model: hackClubModel,
            messages: currentMessages,
            temperature: 0.5,
            stream: true,
          };
          
          const allowedToolAgents = ['tutor', 'coach', 'copilot', 'resource'];
          if (!isSimpleGreeting && agentType && allowedToolAgents.includes(agentType)) {
            payload.tools = toolSchemas;
            payload.tool_choice = 'auto';
          }

          const response = await fetch(HACKCLUB_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${hackClubApiKey}`,
            },
            body: JSON.stringify(payload),
            signal: hackClubController.signal,
          });

          clearTimeout(hackClubTimeoutId);

          // If the completions endpoint fails with Auth or Model error, fall back gracefully
          if (!response.ok) {
            console.warn(`API returned status ${response.status}. Initiating fallback...`);
            if (textbookSearchResults?.results?.length > 0) {
              const resources = textbookSearchResults.results
                .map((r: any) => buildResourceFromResult(r, latestQuery))
                .filter((r: any): r is any => r !== null);
              let contentStr = `### 📚 Found Textbooks & Resources\n\nI searched for "${latestQuery}" and found the following resources:\n\n`;
              resources.slice(0, 5).forEach((res: any, idx: number) => {
                contentStr += `**${idx + 1}. [${res.name}](${res.url})**\n`;
                if (res.description) contentStr += `   > ${res.description.substring(0, 150)}\n`;
                contentStr += `   *Added to your Material Library — you can download it from the Resources tab.*\n\n`;
              });
              contentStr += `You can also ask me to search for more specific textbooks, reference books, or study materials by telling me what you need!`;
              sendEvent({ type: 'text', content: contentStr });
            } else if (webSearchResults?.results?.length > 0) {
              let contentStr = `### 🌐 Web Search Results\n\nI searched the web for "${latestQuery}" and found the following:\n\n`;
              if (webSearchResults.answer) contentStr += `${webSearchResults.answer}\n\n`;
              contentStr += `**Sources:**\n`;
              webSearchResults.results.slice(0, 3).forEach((res: any, idx: number) => {
                contentStr += `${idx + 1}. [${res.title}](${res.url})\n`;
              });
              sendEvent({ type: 'text', content: contentStr });
            } else {
              await runSmartFallback(latestQuery, tavilyApiKey || '', sendEvent, ragContext);
            }
            closeStream();
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('Failed to read response stream');
          }

          const decoder = new TextDecoder();
          let buffer = '';

          
          const toolCallsAcc: any[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data: ')) continue;
              const jsonStr = trimmed.slice(6).trim();
              if (jsonStr === '[DONE]') continue;

              try {
                const chunk = JSON.parse(jsonStr);
                const delta = chunk.choices?.[0]?.delta;
                
                if (delta?.content) {
                  assistantContent += delta.content;
                  sendEvent({ type: 'text', content: delta.content });
                }
                
                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    if (!toolCallsAcc[tc.index]) toolCallsAcc[tc.index] = { function: { name: "", arguments: "" } };
                    if (tc.function?.name) toolCallsAcc[tc.index].function.name += tc.function.name;
                    if (tc.function?.arguments) toolCallsAcc[tc.index].function.arguments += tc.function.arguments;
                  }
                }
              } catch {
                // Ignore event processing errors
              }
            }
          }

          let toolActionEmitted = false;
          // Process Native Tool Calls
          if (toolCallsAcc.length > 0) {
            sendEvent({ type: 'step_start', step: 'tool_action' });
            for (const tc of toolCallsAcc) {
              if (!tc || !tc.function) continue;
              const name = tc.function.name;
              try {
                const args = JSON.parse(tc.function.arguments);
                
                if (name === 'remember') {
                  sendEvent({
                    type: 'remember',
                    observation: args.observation,
                    tags: args.tags || []
                  });
                  await executeServerTool(name, args, memory);
                } else if (name === 'deep_research') {
                  if (args.query) {
                    sendEvent({ type: 'status', message: `🔬 Researching: "${args.query.slice(0, 80)}..."` });
                    try {
                      const researchResults = await executeDeepResearch(args.query, tavilyApiKey || '', (status) => {
                        sendEvent({ type: 'status', message: status });
                      }, memory);
                      if (researchResults?.synthesis) {
                        sendEvent({ type: 'text', content: `🔬 **Research Results for "${args.query}":**\n\n${researchResults.synthesis}` });
                      }
                    } catch {
                      sendEvent({ type: 'status', message: '⚠️ Research failed — proceeding without web results.' });
                    }
                  }
                } else if (name === 'generate_mock_test') {
                  const subjects = normalizeGeneratedSubjects(args);
                  const primarySubject = subjects[0];
                  const validQuestions = validGeneratedQuestions(args.questions);

                  if (validQuestions.length === 0) {
                    sendEvent({
                      type: 'text',
                      content: 'I could not validate enough well-formed four-option questions for that test, so I did not launch it. Please ask again with a narrower chapter or topic.',
                    });
                  } else {
                    // Map validated AI-generated questions into the internal TestQuestion format
                    const testQs = validQuestions.map((q, i) => ({
                      id: `ai-gen-${Date.now()}-${i}`,
                      question: q.question,
                      options: q.options,
                      correctAnswer: q.correctAnswer,
                      explanation: q.explanation,
                      topicId: '',
                      chapterId: '',
                      subject: primarySubject,
                      difficulty: args.difficulty || 'medium',
                      type: 'mcq',
                      source: 'AI Tutor Generated'
                    }));

                    // Emit the dynamic questions so the frontend caches them
                    sendEvent({
                      type: 'dynamic_questions',
                      questions: testQs,
                      title: args.title || 'AI Generated Test',
                      subject: primarySubject,
                      source: 'AI Tutor Generated'
                    });

                    // Then navigate the user to the test arena with dqKey params
                    sendEvent({
                      type: 'client_action',
                      action: 'generate_mock_test',
                      args: {
                        subjects,
                        difficulty: args.difficulty || 'medium',
                        questionCount: testQs.length,
                        title: args.title || 'AI Generated Test',
                      }
                    });
                    toolActionEmitted = true;
                  }
                } else {
                  // Client action
                  // Hydrate topic info if topicName is provided
                  if (args.topicName) {
                    const topic = findTopicByName(args.topicName);
                    if (topic) {
                      args.topicId = topic.id;
                      args.chapterId = topic.chapterId;
                      args.subject = topic.subject;
                      args.chapterName = topic.chapterName;
                    }
                  }
                  
                  sendEvent({
                    type: 'client_action',
                    action: name,
                    args: args
                  });
                  toolActionEmitted = true;
                }
              } catch (e) {
                // A malformed tool-call payload must not abort the other tool
                // calls in this batch or the stream — log and continue.
                reportError(e, { scope: 'chat-route', tags: { phase: 'tool-call', tool: name } });
              }
            }
            sendEvent({ type: 'step_end', step: 'tool_action', result: { action: 'emitted' } });
          }

          sendEvent({ type: 'step_end', step: 'llm_call', result: { streamed: !!assistantContent.trim() } });

          // If the LLM produced no usable content and no tool action fired,
          // run the smart fallback so the user always gets a meaningful response.
          const cleanedAssistant = assistantContent.trim();
          if (!cleanedAssistant && !toolActionEmitted) {
            console.warn('LLM returned empty content and no tool action; running smart fallback.');
            await runSmartFallback(latestQuery, tavilyApiKey || '', sendEvent, ragContext);
          }

          closeStream();



          // Save conversation to Supabase after streaming completes
          if (deviceId && agentType && env.supabaseConfigured) {
            try {
              const cookieStore = await cookies();
              const supabase = createClient(cookieStore);
              const newUserMessages = messages.filter((m: any) => m.role === 'user');
              for (const msg of newUserMessages) {
                await saveMessage(supabase, deviceId, agentType, msg.role, msg.content);
              }
              if (assistantContent) {
                const cleanedContent = assistantContent.replace(/\[(?:MARK|LOG|NAVIGATE|CREATE_TASK|SCHEDULE_REVISION|UPDATE_PROFILE|ADD_INSIGHT|REMEMBER|DEEP_RESEARCH):[^\]]*\]/g, '').trim();
                await saveMessage(supabase, deviceId, agentType, 'assistant', cleanedContent);
              }
            } catch (e) {
              console.warn('Failed to save conversation:', e);
            }
          }
        } catch (apiError: any) {
          console.error('LLM API Error, running fallback:', apiError);
          if (textbookSearchResults?.results?.length > 0) {
            const resources = textbookSearchResults.results
              .map((r: any) => buildResourceFromResult(r, latestQuery))
              .filter((r: any): r is any => r !== null);
            let contentStr = `### 📚 Found Textbooks & Resources\n\nI searched for "${latestQuery}" and found the following resources:\n\n`;
            resources.slice(0, 5).forEach((res: any, idx: number) => {
              contentStr += `**${idx + 1}. [${res.name}](${res.url})**\n`;
              if (res.description) contentStr += `   > ${res.description.substring(0, 150)}\n`;
              contentStr += `   *Added to your Material Library — you can download it from the Resources tab.*\n\n`;
            });
            contentStr += `You can also ask me to search for more specific textbooks, reference books, or study materials by telling me what you need!`;
            sendEvent({ type: 'text', content: contentStr });
          } else if (webSearchResults?.results?.length > 0) {
              let contentStr = `### 🌐 Web Search Results

I searched the web for "${latestQuery}" and found the following:

`;
              if (webSearchResults.answer) contentStr += `${webSearchResults.answer}

`;
              contentStr += `**Sources:**
`;
              webSearchResults.results.slice(0, 3).forEach((res: any, idx: number) => {
                contentStr += `${idx + 1}. [${res.title}](${res.url})
`;
              });
              sendEvent({ type: 'text', content: contentStr });
            } else {
            await runSmartFallback(latestQuery, tavilyApiKey || '', sendEvent, ragContext);
          }
          closeStream();
        }
        } catch (streamError) {
          // Last-resort guard: never leave the client hanging without a terminal event
          reportError(streamError, { scope: 'chat-route', tags: { phase: 'stream' } });
          sendEvent({ type: 'error', message: 'Something went wrong while generating the response. Please try again.' });
        } finally {
          closeStream();
        }
      },
    });

    return new Response(stream, { headers });
  } catch (error: any) {
    reportError(error, { scope: 'chat-route', tags: { phase: 'handler' } });
    // Don't echo internal error details (which may include upstream API info) to the client
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Smart local fallback that handles searching and tool call mockups dynamically
async function runSmartFallback(query: string, tavilyKey: string, sendEvent: (event: ChatEvent) => void, ragContext?: string) {
  // Track whether at least one text event was sent; if not, emit a safety-net fallback
  // at the end. This guarantees the frontend always receives content.
  let _hasSentText = false;
  const _origSendEvent = sendEvent;
  sendEvent = (event: ChatEvent) => {
    if (event.type === 'text') _hasSentText = true;
    _origSendEvent(event);
  };

  try {
    const lowerQuery = query.toLowerCase();
    
    if (ragContext && !lowerQuery.includes('strategic mock diagnostic') && !lowerQuery.includes('test stats:')) {
      sendEvent({ type: 'status', message: 'Retrieving local resource knowledge...' });
      await new Promise(r => setTimeout(r, 400));
      sendEvent({ type: 'text', content: `### 📖 Local Study Resource Insights\nBased on your uploaded study materials, here is the relevant information I found:\n\n${ragContext}\n\n---\n` });
    }

    // AI Test Strategist Report Fallback
    if (lowerQuery.includes('strategic mock diagnostic') || lowerQuery.includes('test stats:')) {
      const scoreMatch = query.match(/Score obtained:\s*(-?\d+)\s*\/\s*(\d+)/i);
      const correctMatch = query.match(/Correct answers:\s*(\d+)/i);
      const wrongMatch = query.match(/Incorrect answers.*:\s*(\d+)/i);
      const skippedMatch = query.match(/Unanswered.*:\s*(\d+)/i);
      const durationMatch = query.match(/Test Duration:\s*([^\n]+)/i);
      const accuracyMatch = query.match(/Overall attempt accuracy:\s*([^\n]+)/i);

      const scoreObtained = scoreMatch ? scoreMatch[1] : '0';
      const maxMarks = scoreMatch ? scoreMatch[2] : '0';
      const correctAnswers = correctMatch ? correctMatch[1] : '0';
      const incorrectAnswers = wrongMatch ? wrongMatch[1] : '0';
      const skippedAnswers = skippedMatch ? skippedMatch[1] : '0';
      const duration = durationMatch ? durationMatch[1] : 'N/A';
      const accuracy = accuracyMatch ? accuracyMatch[1] : '0%';

      sendEvent({ type: 'status', message: 'Analyzing test statistics...' });
      await new Promise(r => setTimeout(r, 600));
      sendEvent({ type: 'status', message: 'Generating strategic mock diagnostic report...' });
      await new Promise(r => setTimeout(r, 600));

      const report = `### 🎯 AI Test Strategist Diagnostic Verdict

Here is your diagnostic analysis based on your latest test stats:
- **Score:** ${scoreObtained} / ${maxMarks} marks
- **Accuracy:** ${accuracy} (Correct: ${correctAnswers}, Incorrect: ${incorrectAnswers}, Skipped: ${skippedAnswers})
- **Time Taken:** ${duration}

#### 1. ⚡ Attempt Efficiency Verdict
Your accuracy rate of **${accuracy}** indicates your current level of preparation. Spending ${duration} shows your pacing, but we need to optimize negative marking penalty (you lost marks on ${incorrectAnswers} wrong attempts).

#### 2. 🔍 Mistake Pattern Analysis
- **Negative Marking Impact:** With ${incorrectAnswers} incorrect answers, negative marking is significantly dragging your net score down. This usually indicates guess-work or formula mis-recollection.
- **Skipped Questions:** You skipped ${skippedAnswers} questions. This is a safe play to avoid negative marking, but highlights conceptual gaps in those specific areas.

#### 3. 🛠️ Actionable Recovery Plan
1. **Eliminate Blind Guessing:** In your next mock test, only mark options where you have at least 70% confidence. It is better to skip than to accumulate negative marks.
2. **Replay Your Mistakes:** Go to your **Spaced-Repetition Mistakes Log** and replay all ${incorrectAnswers} incorrect questions from this attempt. Understand the step-by-step solutions to convert these weak spots into strong points.`;

      const words = report.split(' ');
      let currentChunk = '';
      for (let i = 0; i < words.length; i++) {
        currentChunk += words[i] + ' ';
        if (i % 8 === 0 || i === words.length - 1) {
          sendEvent({ type: 'text', content: currentChunk });
          currentChunk = '';
          await new Promise(r => setTimeout(r, 40));
        }
      }
      return;
    }

    // 1. Check if user is asking to update a topic status
    const cleaned = lowerQuery
      .replace(/['']/g, '')
      .replace(/^(?:yeah|yes|ok|okay|sure|please|pls)\s+/i, '')
      .trim();

    // Diagnostic: log entry point
    sendEvent({ type: 'status', message: `[debug] runSmartFallback called for: "${query.substring(0, 50)}"` });

  // 1. Check if user is asking to update a topic status
  // Use the same improved patterns as tryEmitToolAction
  const markMatch1 = cleaned.match(
    /(?:mark|set|update|complete|finish)\s+([a-zA-Z0-9\s,&:-]+)\s+(?:as|to)\s+(completed|learning|revised|mastered|not_started|in\s+progress)/i
  );
  const markMatch2 = cleaned.match(
    /(?:mark|set|update|complete|finish)\s+([a-zA-Z0-9\s,&:-]+)\s+in\s+progress/i
  );
  const markMatch3 = cleaned.match(
    /^(?:completed|finished|revised|mastered)\s+([a-zA-Z0-9\s,&:-]+)/i
  );
  const removeMatch1 = cleaned.match(
    /^(?:remove|delete|stop|reset|clear|drop|unmark)\s+(.+?)\s+from\s+(?:learning|studied|completed|revised|mastered|in\s+progress|not\s+started|done)/i
  );
  const removeMatch2 = cleaned.match(
    /^(?:stop|end|done|finished|complete)\s+(?:learning|studying|with)\s+(.+)/i
  );
  const removeMatch3 = cleaned.match(
    /^(?:i\s+)?(?:want|need)\s+to\s+(?:remove|delete|stop|reset|clear|drop)\s+(.+?)(?:\s+from\s+.+)?$/i
  );
  const removeMatch4 = cleaned.match(
    /^(?:reset|clear|drop|unmark|delete)\s+(.+?)(?:\s+topic)?\s*$/i
  );

  let topicNameCandidate: string | null = null;
  let statusCandidate: string | null = null;

  if (markMatch1) {
    topicNameCandidate = markMatch1[1].replace(/topic/i, '').trim();
    const rawStatus = markMatch1[2].toLowerCase().trim();
    statusCandidate = rawStatus === 'in progress' ? 'learning' : rawStatus;
  } else if (markMatch2) {
    topicNameCandidate = markMatch2[1].replace(/topic/i, '').trim();
    statusCandidate = 'learning';
  } else if (markMatch3) {
    topicNameCandidate = markMatch3[1].replace(/topic/i, '').trim();
    const raw = markMatch3[0].split(/\s+/)[0].toLowerCase();
    statusCandidate = raw === 'finished' ? 'completed' : raw;
  } else if (removeMatch1) {
    topicNameCandidate = removeMatch1[1]
      .replace(/\s+(?:in|on|from)\s+(?:analytics|syllabus|tracker|progress|my\s+\w+).*$/i, '')
      .replace(/topic/i, '')
      .trim();
    statusCandidate = 'not_started';
  } else if (removeMatch2) {
    topicNameCandidate = removeMatch2[1]
      .replace(/\s+(?:in|on|from)\s+(?:analytics|syllabus|tracker|progress|my\s+\w+).*$/i, '')
      .replace(/topic/i, '')
      .trim();
    statusCandidate = 'not_started';
  } else if (removeMatch3) {
    topicNameCandidate = removeMatch3[1]
      .replace(/\s+(?:in|on|from)\s+(?:analytics|syllabus|tracker|progress|my\s+\w+).*$/i, '')
      .replace(/topic/i, '')
      .trim();
    statusCandidate = 'not_started';
  } else if (removeMatch4) {
    topicNameCandidate = removeMatch4[1]
      .replace(/\s+(?:in|on|from)\s+(?:analytics|syllabus|tracker|progress|my\s+\w+).*$/i, '')
      .replace(/topic/i, '')
      .trim();
    statusCandidate = 'not_started';
  }

  if (topicNameCandidate && statusCandidate) {
    sendEvent({ type: 'status', message: `Analyzing topic reference for "${topicNameCandidate}"...` });
    await new Promise(r => setTimeout(r, 600));

    const topic = findTopicByName(topicNameCandidate);
    if (topic) {
      sendEvent({ type: 'status', message: `Syncing syllabus changes for "${topic.name}"...` });
      await new Promise(r => setTimeout(r, 800));

      // Trigger client action
      sendEvent({
        type: 'client_action',
        action: 'update_topic_status',
        args: {
          topicId: topic.id,
          status: statusCandidate,
          confidence: 4,
          accuracy: 80,
          chapterId: topic.chapterId,
          subject: topic.subject,
          topicName: topic.name,
          chapterName: topic.chapterName
        }
      });
      await new Promise(r => setTimeout(r, 400));

      sendEvent({
        type: 'text',
        content: statusCandidate === 'not_started'
          ? `I've prepared a reset for **${topic.name}** (${topic.subject}) to **not started**. Confirm the action prompt to apply it; you can pick the topic back up anytime from the **Syllabus Tracker**.`
          : `I've prepared a syllabus update for **${topic.name}** (${topic.subject}) to **${statusCandidate}**. Confirm the action prompt to apply it; revision scheduling will be created only after you confirm.`
      });
      return;
    } else {
      sendEvent({ type: 'text', content: `I couldn't find a specific topic matching "${topicNameCandidate}". Please try again with the exact topic name from your syllabus (e.g., "Atomic Structure" or "Laws of Motion").` });
      return;
    }
  }

  // 2. Check if user is asking to log a study session
  const logMatch = cleaned.match(/(?:log|studied|study)\s+([a-zA-Z0-9\s,&:-]+)\s+for\s+(\d+)\s*(hour|minute|hr|min)s?/i) ||
                   cleaned.match(/(?:log|record)\s+(\d+)\s*(hour|minute|hr|min)s?\s+of\s+([a-zA-Z0-9\s,&:-]+)/i);

  if (logMatch) {
    let topicNameCandidate = '';
    let durationMinutes = 60;
    
    if (cleaned.includes('studied') || cleaned.includes('for')) {
      topicNameCandidate = logMatch[1].trim();
      const rawDur = parseInt(logMatch[2], 10);
      const isHour = logMatch[3]?.startsWith('hour') || logMatch[3]?.startsWith('hr');
      durationMinutes = isHour ? rawDur * 60 : rawDur;
    } else {
      const rawDur = parseInt(logMatch[1], 10);
      const isHour = logMatch[2]?.startsWith('hour') || logMatch[2]?.startsWith('hr');
      durationMinutes = isHour ? rawDur * 60 : rawDur;
      topicNameCandidate = logMatch[3].trim();
    }

    sendEvent({ type: 'status', message: `Locating syllabus topic: "${topicNameCandidate}"...` });
    await new Promise(r => setTimeout(r, 600));

    const topic = findTopicByName(topicNameCandidate);
    if (topic) {
      sendEvent({ type: 'status', message: `Logging ${durationMinutes} minutes of study...` });
      await new Promise(r => setTimeout(r, 800));

      sendEvent({
        type: 'client_action',
        action: 'log_study',
        args: {
          description: `Studied ${topic.name} covering major concepts.`,
          topicId: topic.id,
          chapterId: topic.chapterId,
          subject: topic.subject,
          duration: durationMinutes,
          type: 'study'
        }
      });
      await new Promise(r => setTimeout(r, 400));

      sendEvent({
        type: 'text',
        content: `Logged **${durationMinutes} minutes** of study for **${topic.name}** under **${topic.chapterName}** (${topic.subject.toUpperCase()}).\n\nYour study session has been recorded in your study logs history. I've also updated the topic status to **learning** in your syllabus tracker!`
      });
      return;
    } else {
      sendEvent({ type: 'text', content: `I couldn't find a topic matching "${topicNameCandidate}". Please provide the exact topic name so I can log your study session.` });
      return;
    }
  }

  // 3. Textbook / resource search
  if (isTextbookQuery(lowerQuery)) {
    if (!tavilyKey) {
      sendEvent({ type: 'status', message: 'Textbook search unavailable — API key not configured...' });
      await new Promise(r => setTimeout(r, 400));
      sendEvent({ type: 'text', content: `I'd love to search for that textbook PDF, but the Tavily Search API key is not configured. To enable textbook search, add \`TAVILY_API_KEY\` to your \`.env.local\` file.` });
      return;
    }

    sendEvent({ type: 'status', message: `Searching for "${query}" textbooks and PDFs...` });
    sendEvent({ type: 'tool_start', id: 'textbook_search', name: 'textbook_search' });

    try {
      const searchResults = await executeTextbookSearch(query, tavilyKey);
      const resources = (searchResults.results || [])
        .map((r: any) => buildResourceFromResult(r, query))
        .filter((r: any): r is any => r !== null);
      sendEvent({ type: 'tool_end', id: 'textbook_search', name: 'textbook_search', result: { results: resources } });

      for (const res of resources) {
        sendEvent({ type: 'resource_result', payload: res });
      }

      sendEvent({ type: 'status', message: 'Found resources! Adding to your library...' });
      await new Promise(r => setTimeout(r, 400));

      if (resources.length > 0) {
        let contentStr = `### 📚 Found Textbooks & Resources\n\nI searched for "${query}" and found the following resources:\n\n`;
        resources.slice(0, 4).forEach((res: any, idx: number) => {
          contentStr += `**${idx + 1}. [${res.name}](${res.url})**\n`;
          if (res.description) contentStr += `   > ${res.description}\n`;
          contentStr += `   *Added to your Material Library — you can download it from the Resources tab.*\n\n`;
        });
        contentStr += `You can also ask me to search for more specific textbooks, reference books, or study materials by telling me what you need!`;

        const words = contentStr.split(' ');
        let currentChunk = '';
        for (let i = 0; i < words.length; i++) {
          currentChunk += words[i] + ' ';
          if (i % 6 === 0 || i === words.length - 1) {
            sendEvent({ type: 'text', content: currentChunk });
            currentChunk = '';
            await new Promise(r => setTimeout(r, 80));
          }
        }
      } else {
        sendEvent({ type: 'text', content: `I searched for "${query}" but couldn't find specific PDF resources. Try being more specific (e.g., "HC Verma Class 11 Physics Part 1 PDF" or "I need DC Pandey Electricity and Magnetism").` });
      }
      return;
    } catch (searchErr: any) {
      sendEvent({ type: 'error', message: `Textbook search failed: ${searchErr.message}` });
      sendEvent({ type: 'text', content: `I couldn't complete the textbook search for "${query}". Please try again with a more specific book name and author.` });
      return;
    }
  }

  // 4. Mock test / quiz generation
  const mockTestPatterns = [
    /(?:give|create|make|generate|start|launch|prepare)\s+(?:me\s+)?(?:a\s+)?(?:mock\s+)?(?:test|quiz|practice)/i,
    /(?:mock\s+test|practice\s+(?:test|quiz)|quick\s+quiz|mini\s+test)/i,
    /(?:i\s+)?(?:want|need|would\s+like)\s+(?:a\s+)?(?:mock\s+)?(?:test|quiz)/i,
    /(?:generate|create)\s+(?:some\s+)?(?:practice\s+)?questions/i,
  ];
  const isMockTestRequest = mockTestPatterns.some(p => p.test(lowerQuery));

  if (isMockTestRequest) {
    sendEvent({ type: 'status', message: `🎯 Creating a custom mock test based on your request...` });

    if (!tavilyKey) {
      sendEvent({ type: 'text', content: `I'd love to generate a mock test for you, but the Tavily Search API key is not configured. To enable web research for test generation, add \`TAVILY_API_KEY\` to your \`.env.local\` file.` });
      return;
    }

    // Extract topic from query
    const topicMatch = query.match(/(?:on|about|for|of|from)\s+(.+?)(?:\s+(?:exercise|chapter|questions|class|ncert)|$)/i);
    const searchTopic = topicMatch ? topicMatch[1].trim() : query;

    sendEvent({ type: 'status', message: `🔍 Researching "${searchTopic}" questions...` });
    sendEvent({ type: 'tool_start', id: 'mock_test_search', name: 'tavily_search' });

    try {
      const searchResults = await executeTavilySearch(`NCERT ${searchTopic} MCQ questions exercise problems with solutions`, tavilyKey);
      sendEvent({ type: 'tool_end', id: 'mock_test_search', name: 'tavily_search', result: searchResults });
      sendEvent({ type: 'status', message: `📝 Crafting questions from research...` });
      await new Promise(r => setTimeout(r, 600));

      // Build questions from search results or use curated defaults, then reject
      // malformed/placeholder MCQs before they can enter the test arena.
      const validQuestions = validGeneratedQuestions(buildQuestionsFromSearchResults(searchResults, searchTopic));
      const matchedTopic = findTopicByName(searchTopic);
      const questions = validQuestions.map((q, i) => ({
        id: `ai-gen-${Date.now()}-${i}`,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        topicId: matchedTopic?.id || '',
        chapterId: matchedTopic?.chapterId || '',
        subject: matchedTopic?.subject || 'mathematics',
        difficulty: 'medium',
        type: 'mcq',
        source: 'AI Tutor Generated'
      }));

      if (questions.length === 0) {
        sendEvent({ type: 'text', content: `I searched the web for "${searchTopic}" questions but could not validate enough complete four-option questions. Please try a more specific topic name.` });
        return;
      }

      const testTitle = `${searchTopic} Mock Test`;

      // Emit dynamic questions (client will cache them and set pendingDqKey)
      sendEvent({
        type: 'dynamic_questions',
        questions,
        title: testTitle,
        subject: 'mathematics',
        source: 'AI Tutor Generated (Web Researched)'
      });

      await new Promise(r => setTimeout(r, 300));

      // Emit client_action so the client navigates with the dqKey
      sendEvent({
        type: 'client_action',
        action: 'generate_mock_test',
        args: {
          subjects: ['mathematics'],
          difficulty: 'medium',
          questionCount: questions.length,
          title: testTitle,
        }
      });

      sendEvent({ type: 'status', message: `✅ ${questions.length}-question test ready! Launching...` });
      return;
    } catch (searchErr: any) {
      console.warn('Mock test search failed:', searchErr);
      sendEvent({ type: 'error', message: `Question research failed: ${searchErr.message}` });
      sendEvent({ type: 'text', content: `I encountered an error while researching "${searchTopic}". Please try again with a more specific topic.` });
      return;
    }
  }

  // 5. Web search trigger - only if the query has academic context or explicit search keyword
  // and is NOT a greeting or question about capabilities.
  const isGreeting = GREETINGS.some(g => lowerQuery === g || lowerQuery.startsWith(g + ' ') || lowerQuery.startsWith(g + '!'));
  const isCapability = CAPABILITIES.some(c => lowerQuery.includes(c) || lowerQuery === 'help' || lowerQuery === '?');
  const hasJEEContext = JEE_KEYWORDS.some(kw => lowerQuery.includes(kw));
  const hasExplicitSearch = EXPLICIT_SEARCH.some(kw => lowerQuery.includes(kw));
  const isSearchWorthy = (hasJEEContext || hasExplicitSearch) && !isGreeting && !isCapability;

  if (isCapability) {
    sendEvent({ type: 'status', message: 'Analyzing capabilities...' });
    await new Promise(r => setTimeout(r, 400));
    sendEvent({ type: 'status', message: 'Describing features...' });
    await new Promise(r => setTimeout(r, 400));

    const responseText = `I am your **JEE OS AI Tutor & Assistant**. I can help you manage your study preparation, track your syllabus, log study hours, and answer academic questions.\n\nHere are some of the main things I can do:\n\n1. **Syllabus Tracker Updates**:\n   - You can ask me to update your status for any JEE topic. For example: *"Mark Friction as completed"* or *"Set Laws of Motion to learning"*.\n   - After you confirm my suggestion, I will update your syllabus and schedule spaced repetition revision tasks (Day 1, 7, 30).\n\n2. **Study Logging**:\n   - Tell me what you studied and for how long, and I'll log it. For example: *"I studied Mole Concept for 90 minutes"* or *"Logged 2 hours of electrostatics"*.\n\n3. **Academic Explanations & Web Search**:\n   - Ask me about any physics, chemistry, or mathematics concepts, cutoffs, syllabus updates, or exam details, and I will search the web using Tavily to provide you with the most accurate, real-time answers.\n\n4. **Adaptive Test Recommendations**:\n   - I can suggest what topics you should focus on next or what questions to review based on your performance metrics.\n\nHow can I assist your JEE preparation today?`;

    const words = responseText.split(' ');
    let currentChunk = '';
    for (let i = 0; i < words.length; i++) {
      currentChunk += words[i] + ' ';
      if (i % 8 === 0 || i === words.length - 1) {
        sendEvent({ type: 'text', content: currentChunk });
        currentChunk = '';
        await new Promise(r => setTimeout(r, 40));
      }
    }
    return;
  }

  if (isGreeting) {
    sendEvent({ type: 'status', message: 'Saying hello...' });
    await new Promise(r => setTimeout(r, 400));

    const responseText = `Hello! How is your JEE preparation going today? I am ready to help you track your syllabus, log study hours, or search the web for any academic concepts you need help with. Let me know what you'd like to do!`;

    const words = responseText.split(' ');
    let currentChunk = '';
    for (let i = 0; i < words.length; i++) {
      currentChunk += words[i] + ' ';
      if (i % 8 === 0 || i === words.length - 1) {
        sendEvent({ type: 'text', content: currentChunk });
        currentChunk = '';
        await new Promise(r => setTimeout(r, 40));
      }
    }
    return;
  }

  if (isSearchWorthy) {
    if (!tavilyKey) {
      sendEvent({ type: 'status', message: 'Tavily Search unavailable...' });
      await new Promise(r => setTimeout(r, 400));
      sendEvent({
        type: 'text',
        content: `I'd love to search the web for "${query}", but the Tavily Search API key is currently not configured in this environment.\n\nTo enable real-time JEE search capabilities, please add \`TAVILY_API_KEY\` to your \`.env.local\` file. In the meantime, I can still help you log your studies or update your syllabus status if you ask!`
      });
      return;
    }

    sendEvent({ type: 'status', message: `Searching the web for "${query}" using Tavily...` });
    sendEvent({ type: 'tool_start', id: 'call_search', name: 'tavily_search' });

    try {
      const searchResults = await executeTavilySearch(query, tavilyKey);
      sendEvent({ type: 'tool_end', id: 'call_search', name: 'tavily_search', result: searchResults });
      sendEvent({ type: 'status', message: 'Synthesizing response and generating answer...' });
      await new Promise(r => setTimeout(r, 800));

      let contentStr = '';
      const hasAnswer = searchResults.answer && searchResults.answer.length > 10;

      if (searchResults.results && searchResults.results.length > 0) {
        if (hasAnswer) {
          contentStr += `${searchResults.answer}\n\n`;
        } else {
          contentStr += `Here's what I found about "${query}":\n\n`;
          const best = searchResults.results[0];
          contentStr += `${best.content.substring(0, 300).replace(/#{1,6}\s/g, '').trim()}\n\n`;
        }

        contentStr += `---\n\n**Sources:**\n`;
        searchResults.results.slice(0, 5).forEach((res: any, idx: number) => {
          contentStr += `${idx + 1}. [${res.title}](${res.url})\n`;
        });
      } else {
        contentStr += `I searched the web for "${query}" but couldn't find specific results. Try rephrasing your query or asking about a different topic.`;
      }

      // Stream the synthesized content block by block to simulate typing
      const words = contentStr.split(' ');
      let currentChunk = '';
      for (let i = 0; i < words.length; i++) {
        currentChunk += words[i] + ' ';
        if (i % 6 === 0 || i === words.length - 1) {
          sendEvent({ type: 'text', content: currentChunk });
          currentChunk = '';
          await new Promise(r => setTimeout(r, 80)); // Normal typing speed
        }
      }
      return;
    } catch (searchErr: any) {
      const isTimeout = searchErr.name === 'AbortError';
      sendEvent({ type: 'error', message: `Tavily Search ${isTimeout ? 'timed out' : 'failed'}: ${searchErr.message}` });
      sendEvent({ type: 'status', message: 'Search unavailable — providing guidance from my knowledge base...' });
      await new Promise(r => setTimeout(r, 600));

      const topic = findTopicByName(query);
      let contentStr = `I couldn't complete the web search for "${query}" (${isTimeout ? 'the request timed out' : 'an error occurred'}). However, here's what I can tell you from my knowledge base:\n\n`;

      if (topic) {
        contentStr += `### ${topic.name} (${topic.subject})\n\n`;
        contentStr += `This topic falls under **${topic.chapterName}** in the JEE syllabus. Make sure you:\n\n`;
        contentStr += `1. **Master the fundamentals** — Review NCERT thoroughly for this topic.\n`;
        contentStr += `2. **Practice numerical problems** — Focus on application-based questions.\n`;
        contentStr += `3. **Review PYQs** — Previous year questions are crucial for understanding the exam pattern.\n\n`;
        contentStr += `I've noted your question — when the search service is back online, you can try again for more detailed, real-time information!`;
      } else {
        contentStr += `For **JEE preparation**, it's generally helpful to:\n\n`;
        contentStr += `- **Review NCERT textbooks** thoroughly for conceptual clarity.\n`;
        contentStr += `- **Practice PYQs (Previous Year Questions)** to understand the exam pattern.\n`;
        contentStr += `- **Focus on numerical problem-solving** and time management.\n\n`;
        contentStr += `Feel free to ask me about any specific topic, and I'll do my best to help!`;
      }

      const words = contentStr.split(' ');
      let currentChunk = '';
      for (let i = 0; i < words.length; i++) {
        currentChunk += words[i] + ' ';
        if (i % 8 === 0 || i === words.length - 1) {
          sendEvent({ type: 'text', content: currentChunk });
          currentChunk = '';
          await new Promise(r => setTimeout(r, 40));
        }
      }
      return;
    }
  }

  // 4. Default response (if not caught by syllabus update, study log, or search)
  sendEvent({ type: 'status', message: 'Analyzing query...' });
  await new Promise(r => setTimeout(r, 600));
  sendEvent({ type: 'status', message: 'Generating response...' });
  await new Promise(r => setTimeout(r, 600));

  const welcomeText = `Hello! I'm your **JEE OS Tutor**. I noticed that your Hack Club AI key is currently unavailable or has expired, but I've activated my **smart fallback agent** so I can still assist you completely!\n\nI can still search the web using your **Tavily API Key** and modify the dashboard and syllabus data on this website directly. For example, you can tell me:\n\n- *"Mark Rotational Motion as completed"* or *"Set Laws of Motion to learning"*\n- *"Log 2 hours of study on definite integration"*\n- *Any chemistry/physics question (I will fetch real-time search results for you)*\n\nWhat would you like me to help you with right now?`;
  
  const words = welcomeText.split(' ');
  let currentChunk = '';
  for (let i = 0; i < words.length; i++) {
    currentChunk += words[i] + ' ';
    if (i % 8 === 0 || i === words.length - 1) {
      sendEvent({ type: 'text', content: currentChunk });
      currentChunk = '';
      await new Promise(r => setTimeout(r, 50));
    }
  }
  } catch (fallbackErr) {
    console.error('[runSmartFallback] unhandled error:', fallbackErr);
    if (!_hasSentText) {
      _origSendEvent({ type: 'text', content: `I encountered an issue processing your request. Please try again.` });
    }
  }

  // Safety net: if somehow no text event was sent through any branch (including the
  // catch block), send one now so the frontend never gets an empty response.
  if (!_hasSentText) {
    _origSendEvent({ type: 'text', content: `I received your request about "${query.substring(0, 80)}" but had trouble generating a response. Please try rephrasing your question.` });
  }
}

const generatedQuestionSchema = z.object({
  question: z.string().trim().min(15).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(10).max(1500),
});

function validGeneratedQuestions(input: unknown): z.infer<typeof generatedQuestionSchema>[] {
  if (!Array.isArray(input)) return [];
  const valid: z.infer<typeof generatedQuestionSchema>[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const candidate = {
      ...(raw as Record<string, unknown>),
      correctAnswer: typeof (raw as any).correctAnswer === 'number'
        ? (raw as any).correctAnswer
        : (raw as any).correct_answer,
    };
    const parsed = generatedQuestionSchema.safeParse(candidate);
    if (!parsed.success) continue;

    const normalizedOptions = parsed.data.options.map(o => o.trim().toLowerCase());
    const hasDuplicateOptions = new Set(normalizedOptions).size !== normalizedOptions.length;
    const hasPlaceholderOptions = normalizedOptions.some(o =>
      /^option\s*\d+$/.test(o) || ['none of the above', 'all of the above', 'cannot be determined', 'insufficient data'].includes(o)
    );
    const genericExplanation = /based on the problem statement|solve step by step to verify/i.test(parsed.data.explanation);
    if (!hasDuplicateOptions && !hasPlaceholderOptions && !genericExplanation) {
      valid.push(parsed.data);
    }
  }

  return valid.slice(0, 30);
}

function normalizeGeneratedSubjects(args: any): string[] {
  const allowed = new Set(['physics', 'chemistry', 'mathematics']);
  const raw = Array.isArray(args?.subjects)
    ? args.subjects
    : args?.subject
      ? [args.subject]
      : [];
  const normalized = raw
    .map((s: unknown) => String(s).toLowerCase())
    .filter((s: string) => allowed.has(s));
  return normalized.length > 0 ? Array.from(new Set(normalized)) : ['mathematics'];
}

function buildQuestionsFromSearchResults(searchResults: any, topicName: string): any[] {
  const questions: any[] = [];
  const textContent: string[] = [];

  if (searchResults.results) {
    for (const r of searchResults.results) {
      if (r.content) textContent.push(r.content);
      if (r.title) textContent.push(r.title);
    }
  }

  const body = textContent.join('\n\n');

  try {
    const scraped = parseScrapedQuestions(body);
    if (scraped.length >= 3) {
      return scraped;
    }
  } catch (e) {
    console.warn('Scraped question parsing failed, falling back to regex:', e);
  }

  if (body.length < 50) {
    return generateDefaultQuestions(topicName);
  }

  // Never invent MCQ options for a scraped free-text question. Doing so makes
  // the correct answer arbitrary and teaches wrong material. If structured
  // options were not present in the source, fall back to curated defaults.
  if (questions.length >= 2) return questions;
  return generateDefaultQuestions(topicName);
}

function generateDefaultQuestions(topicName: string): any[] {
  const topicLower = topicName.toLowerCase();

  const defaultSets: Record<string, any[]> = {
    'linear inequalities': [
      {
        question: 'Solve: 3x - 7 > 2, where x is a real number.',
        options: ['x > 3', 'x < 3', 'x > -3', 'x < -3'],
        correctAnswer: 0,
        explanation: '3x - 7 > 2 ⇒ 3x > 9 ⇒ x > 3'
      },
      {
        question: 'Solve: 2(x - 1) < x + 5, where x is a real number.',
        options: ['x < 7', 'x < 6', 'x < 8', 'x < 5'],
        correctAnswer: 0,
        explanation: '2(x - 1) < x + 5 ⇒ 2x - 2 < x + 5 ⇒ x < 7'
      },
      {
        question: 'Solve the inequality: (x - 2)/(x + 1) > 1, where x ≠ -1.',
        options: ['x < -1', 'x > -1', 'x < 0', 'x > 0'],
        correctAnswer: 0,
        explanation: '(x - 2)/(x + 1) > 1 ⇒ (x - 2)/(x + 1) - 1 > 0 ⇒ -3/(x + 1) > 0 ⇒ x + 1 < 0 ⇒ x < -1'
      },
      {
        question: 'Solve: 5x - 3 ≥ 3x - 5, where x is a real number.',
        options: ['x ≥ -1', 'x ≥ 1', 'x ≥ 0', 'x ≥ -2'],
        correctAnswer: 0,
        explanation: '5x - 3 ≥ 3x - 5 ⇒ 2x ≥ -2 ⇒ x ≥ -1'
      },
      {
        question: 'Solve: 3(2 - x) ≥ 2(1 - x), where x is a real number.',
        options: ['x ≤ 4', 'x ≥ 4', 'x ≤ -4', 'x ≥ -4'],
        correctAnswer: 0,
        explanation: '3(2 - x) ≥ 2(1 - x) ⇒ 6 - 3x ≥ 2 - 2x ⇒ -x ≥ -4 ⇒ x ≤ 4'
      },
      {
        question: 'Solve: (x - 1)/2 + (x + 2)/3 < x - 1',
        options: ['x > 7', 'x < 7', 'x > 10', 'x < 10'],
        correctAnswer: 0,
        explanation: '(x - 1)/2 + (x + 2)/3 < x - 1 ⇒ 3(x - 1) + 2(x + 2) < 6x - 6 ⇒ 5x + 1 < 6x - 6 ⇒ x > 7'
      },
      {
        question: 'Solve: 2 ≤ 3x - 4 ≤ 5, where x is a real number.',
        options: ['2 ≤ x ≤ 3', '1 ≤ x ≤ 3', '2 ≤ x ≤ 4', '1 ≤ x ≤ 2'],
        correctAnswer: 0,
        explanation: '2 ≤ 3x - 4 ≤ 5 ⇒ 6 ≤ 3x ≤ 9 ⇒ 2 ≤ x ≤ 3'
      },
    ],
  };

  for (const [key, qs] of Object.entries(defaultSets)) {
    if (topicLower.includes(key)) return qs;
  }

  return [
    {
      question: `What is the solution set for the inequality 3x - 5 < 1, where x ∈ ℝ?`,
      options: ['x < 2', 'x > 2', 'x < -2', 'x > -2'],
      correctAnswer: 0,
      explanation: '3x - 5 < 1 ⇒ 3x < 6 ⇒ x < 2'
    },
    {
      question: `Solve: 2(x + 3) ≥ 4x - 5`,
      options: ['x ≤ 11/2', 'x ≥ 11/2', 'x ≤ 5/2', 'x ≥ 5/2'],
      correctAnswer: 0,
      explanation: '2(x + 3) ≥ 4x - 5 ⇒ 2x + 6 ≥ 4x - 5 ⇒ -2x ≥ -11 ⇒ x ≤ 11/2'
    },
    {
      question: `The solution of |x - 2| < 1 is:`,
      options: ['1 < x < 3', '-1 < x < 3', '-1 < x < 1', '1 < x < 2'],
      correctAnswer: 0,
      explanation: '|x - 2| < 1 ⇒ -1 < x - 2 < 1 ⇒ 1 < x < 3'
    },
    {
      question: `Solve: (x - 3)/(x + 2) > 0`,
      options: ['x < -2 or x > 3', '-2 < x < 3', 'x < -2', 'x > 3'],
      correctAnswer: 0,
      explanation: '(x - 3)/(x + 2) > 0 ⇒ critical points -2, 3. Testing intervals gives x < -2 or x > 3'
    },
    {
      question: `If x ∈ ℝ, the solution of 3x + 8 > 2 is:`,
      options: ['x > -2', 'x > 2', 'x < -2', 'x < 2'],
      correctAnswer: 0,
      explanation: '3x + 8 > 2 ⇒ 3x > -6 ⇒ x > -2'
    },
  ];
}
