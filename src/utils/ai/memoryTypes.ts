// Provider-agnostic memory interface. Implemented by the client-side
// localStorage MemoryStore (memory.ts) and the server-side Supabase-backed
// ServerMemoryStore (serverMemory.ts). Server code should depend on this
// interface, never on the 'use client' MemoryStore directly.

export interface MemoryLike {
  add(
    content: string,
    type: string,
    source: string,
    tags?: string[],
    importance?: number,
    metadata?: Record<string, unknown>,
  ): Promise<string | void>;

  getContextString(query: string, maxMemories?: number): Promise<string>;
}

/** A memory that does nothing — used when no backing store is available. */
export const noopMemory: MemoryLike = {
  async add() { return; },
  async getContextString() { return ''; },
};
