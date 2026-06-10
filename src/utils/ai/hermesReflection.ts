import { MemoryStore } from './memory';

interface ReflectionResult {
  adaptationNotes: string[];
  confidenceAdjustment: number;
  suggestedTools: string[];
  userPersonaInsight: string | null;
}

const REFLECTION_PROMPT = `You are Hermes, a meta-cognitive reflection engine. Your sole purpose is to analyze an AI-user interaction and extract insights to make future responses better.

Analyze the following interaction and return a JSON object with these fields:
- adaptationNotes: array of strings — what should the AI adapt about its approach for this user?
- confidenceAdjustment: number from -0.3 to +0.3 — how much to adjust response confidence based on user engagement
- suggestedTools: array of strings — what tools would have been useful here?
- userPersonaInsight: string or null — a single insight about this user's learning style

Interaction:
User Query: {{query}}
AI Response: {{response}}
User's Learning Context: {{context}}

Return ONLY valid JSON, no other text.`;

export async function reflectOnInteraction(
  query: string,
  response: string,
  context: string,
  apiKey: string,
  apiUrl: string,
  model: string,
  memory: MemoryStore,
): Promise<ReflectionResult | null> {
  try {
    const prompt = REFLECTION_PROMPT
      .replace('{{query}}', query.slice(0, 500))
      .replace('{{response}}', response.slice(0, 1000))
      .replace('{{context}}', context.slice(0, 300));

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const json = JSON.parse(text.replace(/```json|```/g, '').trim());

    const result: ReflectionResult = {
      adaptationNotes: json.adaptationNotes || [],
      confidenceAdjustment: json.confidenceAdjustment || 0,
      suggestedTools: json.suggestedTools || [],
      userPersonaInsight: json.userPersonaInsight || null,
    };

    if (result.userPersonaInsight && result.userPersonaInsight.length > 10) {
      await memory.add(
        result.userPersonaInsight,
        'preference',
        'ai_tutor',
        ['hermes', 'persona'],
        0.85,
      );
    }

    for (const note of result.adaptationNotes) {
      if (note.length > 10) {
        await memory.add(
          note,
          'observation',
          'ai_tutor',
          ['hermes', 'adaptation'],
          0.7,
        );
      }
    }

    return result;
  } catch (e) {
    console.warn('[Hermes] Reflection failed:', e);
    return null;
  }
}

export async function generateHermesSystemPrompt(memoryContext: string): Promise<string> {
  return `You are Hermes, a meta-cognitive AI tutor who reflects on your own teaching to improve.

Your unique capabilities:
1. You learn from every interaction. After each response, you analyze what worked and what didn't.
2. You maintain a shared memory of the student's patterns, preferences, and mistakes.
3. You adapt your teaching style based on what you've observed.

Your teaching principles:
- If the student seems confused, try a different explanation approach.
- If the student corrects you, learn from it and don't repeat the mistake.
- If the student engages deeply, provide more challenging material.
- If the student is struggling with fundamentals, simplify.

Your meta-cognitive loop (think about this silently before responding):
- "What do I know about this student from past interactions?"
- "What approach have I tried before for this type of question?"
- "Did that approach work? Should I try something different?"
- "What would help this student most RIGHT NOW?"

${memoryContext ? `\n### 🧠 Recollections from shared memory:\n${memoryContext}\n` : ''}

Always strive to improve with every interaction. You are not just answering — you are growing with the student.`;
}
