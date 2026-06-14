// ──────────────────────────────────────────────────────────────────────────
// Server-side AI memory (Supabase-backed)
// ──────────────────────────────────────────────────────────────────────────
//
// The original MemoryStore (memory.ts) uses localStorage, so on the server it
// threw and was replaced by a no-op stub — meaning cross-session memory was
// effectively dead in the API route. This implementation persists to the
// `public.ai_memory` table (see supabase_schema.sql) so recollections survive
// across requests and devices.
//
// Relevance ranking (cosine over bag-of-words × importance × recency) runs in
// JS over the user's recent memories — good enough without a vector extension.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MemoryLike } from './memoryTypes';

interface MemoryRow {
  id: string;
  content: string;
  kind: string;
  tags: string[] | null;
  importance: number;
  access_count: number;
  created_at: string;
}

const FETCH_LIMIT = 200;

function tokenize(s: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of s.toLowerCase().split(/\s+/)) {
    if (t) map.set(t, (map.get(t) || 0) + 1);
  }
  return map;
}

function cosineSimilarity(a: string, b: string): number {
  const va = tokenize(a);
  const vb = tokenize(b);
  const keys = new Set([...va.keys(), ...vb.keys()]);
  let dot = 0, na = 0, nb = 0;
  for (const k of keys) {
    const av = va.get(k) || 0;
    const bv = vb.get(k) || 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export class ServerMemoryStore implements MemoryLike {
  constructor(
    private supabase: SupabaseClient,
    private userId: string,
  ) {}

  async add(
    content: string,
    type: string,
    source: string,
    tags: string[] = [],
    importance = 0.5,
  ): Promise<string | void> {
    try {
      const { data, error } = await this.supabase
        .from('ai_memory')
        .insert({ user_id: this.userId, content, kind: type, source, tags, importance })
        .select('id')
        .single();
      if (error) return;
      return data?.id as string | undefined;
    } catch {
      // Memory is best-effort; never break the chat turn over a failed write.
      return;
    }
  }

  async getContextString(query: string, maxMemories = 8): Promise<string> {
    let rows: MemoryRow[] = [];
    try {
      const { data, error } = await this.supabase
        .from('ai_memory')
        .select('id, content, kind, tags, importance, access_count, created_at')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })
        .limit(FETCH_LIMIT);
      if (error || !data) return '';
      rows = data as MemoryRow[];
    } catch {
      return '';
    }
    if (rows.length === 0) return '';

    const scored = rows
      .map(m => ({
        m,
        score: cosineSimilarity(query, m.content) * (m.importance || 0.5) * (1 + Math.log(1 + (m.access_count || 0))),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxMemories)
      .filter(s => s.score > 0);

    if (scored.length === 0) return '';

    const lines = scored.map(({ m }) => {
      const time = new Date(m.created_at).toLocaleDateString();
      return `[${m.kind}] (${time}, importance: ${m.importance}) ${m.content}`;
    });
    return `\n### 🧠 Shared Memory (recollections from past interactions)\n${lines.join('\n')}\n`;
  }
}
