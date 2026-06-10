'use client';

export type MemoryType = 'observation' | 'preference' | 'pattern' | 'fact' | 'mistake' | 'interaction_summary' | 'skill_estimate';
export type MemorySource = 'user' | 'ai_tutor' | 'ai_coach' | 'ai_copilot' | 'system' | 'test_engine';

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  tags: string[];
  importance: number;
  timestamp: string;
  source: MemorySource;
  accessCount: number;
  lastAccessed: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

const STORAGE_KEY = 'jee-os-memory-cache';

const TYPE_WEIGHTS: Record<MemoryType, number> = {
  observation: 0.6,
  preference: 0.9,
  pattern: 0.8,
  fact: 0.5,
  mistake: 0.85,
  interaction_summary: 0.4,
  skill_estimate: 0.75,
};

function generateId(): string {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function cosineSimilarity(a: string, b: string): number {
  const tokenize = (s: string): Map<string, number> => {
    const map = new Map<string, number>();
    const tokens = s.toLowerCase().split(/\s+/);
    for (const t of tokens) {
      map.set(t, (map.get(t) || 0) + 1);
    }
    return map;
  };
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

export class MemoryStore {
  private cache: Memory[] = [];
  private loaded = false;

  constructor(private userId?: string) {}

  private loadCache(): void {
    if (this.loaded) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.cache = JSON.parse(raw);
      }
    } catch { /* ignore */ }
    this.loaded = true;
  }

  private persist(): void {
    try {
      const trimmed = this.cache.slice(-500);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch { /* ignore */ }
  }

  async add(
    content: string,
    type: MemoryType,
    source: MemorySource,
    tags: string[] = [],
    importance?: number,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    this.loadCache();
    const id = generateId();
    const memory: Memory = {
      id,
      type,
      content,
      tags,
      importance: importance ?? TYPE_WEIGHTS[type],
      timestamp: new Date().toISOString(),
      source,
      accessCount: 0,
      lastAccessed: new Date().toISOString(),
      userId: this.userId,
      metadata,
    };
    this.cache.push(memory);
    this.persist();
    return id;
  }

  async getRelevant(query: string, limit = 10): Promise<Memory[]> {
    this.loadCache();
    const scored = this.cache.map(m => ({
      memory: m,
      relevance: cosineSimilarity(query, m.content) * m.importance * (1 + Math.log(1 + m.accessCount)),
    }));
    scored.sort((a, b) => b.relevance - a.relevance);
    return scored.slice(0, limit).map(s => {
      s.memory.accessCount++;
      s.memory.lastAccessed = new Date().toISOString();
      return s.memory;
    });
  }

  async getByTags(tags: string[], limit = 20): Promise<Memory[]> {
    this.loadCache();
    return this.cache
      .filter(m => tags.some(t => m.tags.includes(t)))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  async getByType(type: MemoryType, limit = 20): Promise<Memory[]> {
    this.loadCache();
    return this.cache
      .filter(m => m.type === type)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async consolidate(): Promise<void> {
    this.loadCache();
    const seen = new Set<string>();
    const deduped: Memory[] = [];
    for (const m of this.cache) {
      const key = m.content.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      const similar = this.cache.filter(
        o => o.id !== m.id && cosineSimilarity(m.content, o.content) > 0.85 && o.type === m.type,
      );
      if (similar.length > 0) {
        m.accessCount += similar.reduce((s, o) => s + o.accessCount, 0);
        m.importance = Math.max(m.importance, ...similar.map(o => o.importance));
        m.tags = [...new Set([...m.tags, ...similar.flatMap(o => o.tags)])];
      }
      deduped.push(m);
    }
    this.cache = deduped;
    this.persist();
  }

  async getContextString(query: string, maxMemories = 8): Promise<string> {
    const relevant = await this.getRelevant(query, maxMemories);
    if (relevant.length === 0) return '';
    const lines = relevant.map(m => {
      const time = new Date(m.timestamp).toLocaleDateString();
      return `[${m.type}] (${time}, importance: ${m.importance}) ${m.content}`;
    });
    return `\n### 🧠 Shared Memory (recollections from past interactions)\n${lines.join('\n')}\n`;
  }

  clear(): void {
    this.cache = [];
    localStorage.removeItem(STORAGE_KEY);
  }
}
