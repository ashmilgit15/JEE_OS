import { MemoryStore } from './memory';

interface ResearchFinding {
  query: string;
  summary: string;
  sources: { title: string; url: string }[];
}

interface DeepResearchResult {
  findings: ResearchFinding[];
  synthesis: string;
  totalSources: number;
}

const TAVILY_API_URL = 'https://api.tavily.com/search';

async function searchStep(query: string, apiKey: string): Promise<{ answer?: string; results: { title: string; url: string; content: string }[] }> {
  try {
    const res = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        include_answer: true,
        max_results: 5,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { results: [] };
    return await res.json();
  } catch {
    return { results: [] };
  }
}

function generateSubQueries(mainQuery: string): string[] {
  const base = mainQuery.toLowerCase();

  const subQueries: string[] = [mainQuery];

  if (base.includes('jee') || base.includes('iit')) {
    subQueries.push(`${mainQuery} JEE Main 2025 2026`);
    subQueries.push(`${mainQuery} NCERT textbook explanation`);
    subQueries.push(`${mainQuery} PYQ previous year questions`);
  }

  if (base.includes('formula') || base.includes('theorem') || base.includes('concept')) {
    subQueries.push(`${mainQuery} explained simply`);
    subQueries.push(`${mainQuery} examples and practice`);
  }

  subQueries.push(`${mainQuery} study tips tricks`);

  return [...new Set(subQueries)].slice(0, 4);
}

export async function executeDeepResearch(
  query: string,
  tavilyKey: string,
  onProgress?: (status: string) => void,
  memory?: MemoryStore,
): Promise<DeepResearchResult> {
  const findings: ResearchFinding[] = [];
  const allSources: Set<string> = new Set();

  onProgress?.(`🔬 Generating research sub-queries for "${query.slice(0, 60)}"...`);

  const subQueries = generateSubQueries(query);

  for (let i = 0; i < subQueries.length; i++) {
    const subQuery = subQueries[i];
    onProgress?.(`📡 Research round ${i + 1}/${subQueries.length}: "${subQuery.slice(0, 50)}"...`);

    const result = await searchStep(subQuery, tavilyKey);
    if (result.results.length === 0) continue;

    const sources = result.results.slice(0, 3).map(r => ({ title: r.title, url: r.url }));
    sources.forEach(s => allSources.add(s.url));

    const summary = result.answer || result.results[0]?.content.slice(0, 300) || '';

    findings.push({
      query: subQuery,
      summary,
      sources,
    });

    onProgress?.(`✓ Found ${result.results.length} sources for round ${i + 1}`);
  }

  onProgress?.(`🧠 Synthesizing ${findings.length} research findings...`);

  const synthesis = synthesizeFindings(query, findings);

  if (memory && findings.length > 0) {
    const keyFindings = findings
      .filter(f => f.summary.length > 50)
      .slice(0, 3)
      .map(f => f.summary.slice(0, 200));
    for (const finding of keyFindings) {
      await memory.add(finding, 'fact', 'system', ['research', 'deep_research'], 0.6);
    }
  }

  return {
    findings,
    synthesis,
    totalSources: allSources.size,
  };
}

function synthesizeFindings(query: string, findings: ResearchFinding[]): string {
  if (findings.length === 0) {
    return `I researched "${query}" but couldn't find comprehensive results. Please try a more specific query.`;
  }

  const parts: string[] = [];
  parts.push(`## Deep Research: ${query}\n`);

  const allSummaries = findings.filter(f => f.summary.length > 20).map(f => f.summary);
  if (allSummaries.length > 0) {
    const combinedSummary = allSummaries.slice(0, 3).join('\n\n').slice(0, 1500);
    parts.push(combinedSummary);
  }

  parts.push('\n### Sources\n');
  const seen = new Set<string>();
  for (const f of findings) {
    for (const s of f.sources) {
      if (!seen.has(s.url)) {
        seen.add(s.url);
        parts.push(`- [${s.title}](${s.url})`);
      }
    }
  }

  return parts.join('\n');
}

export async function generateResearchSystemPrompt(query: string): Promise<string> {
  return `You are a Deep Research Agent specializing in JEE and academic research.

Your task is to research: "${query}"

Research methodology:
1. Break down the query into sub-questions
2. Search each sub-question using the available tools
3. Cross-reference findings from multiple sources
4. Synthesize into a comprehensive, accurate answer
5. Cite all sources

Output format:
- Use ## for section headings
- Use **bold** for key terms
- Use bullet points for lists
- Cite sources as [Source N]
- Include a "### Sources" section at the end

Be thorough. Quality over speed.`;
}
