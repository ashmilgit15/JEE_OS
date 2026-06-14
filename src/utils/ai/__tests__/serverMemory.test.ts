import { describe, it, expect } from 'vitest';
import { ServerMemoryStore } from '@/utils/ai/serverMemory';

// Minimal stub of the Supabase client surface ServerMemoryStore touches.
function makeStub(rows: any[]) {
  const inserted: any[] = [];
  const client: any = {
    from() { return this; },
    insert(record: any) {
      inserted.push(record);
      return {
        select() {
          return { single: async () => ({ data: { id: 'new-id' }, error: null }) };
        },
      };
    },
    select() { return this; },
    eq() { return this; },
    order() { return this; },
    async limit() { return { data: rows, error: null }; },
  };
  return { client, inserted };
}

describe('ServerMemoryStore', () => {
  it('persists an observation and returns its id', async () => {
    const { client, inserted } = makeStub([]);
    const store = new ServerMemoryStore(client, 'user-1');
    const id = await store.add('User prefers worked examples', 'preference', 'ai_tutor', ['style']);
    expect(id).toBe('new-id');
    expect(inserted[0]).toMatchObject({ user_id: 'user-1', kind: 'preference', content: 'User prefers worked examples' });
  });

  it('ranks relevant memories above irrelevant ones in the context string', async () => {
    const rows = [
      { id: '1', content: 'Student struggles with rotational motion torque problems', kind: 'pattern', tags: [], importance: 0.8, access_count: 2, created_at: new Date().toISOString() },
      { id: '2', content: 'Likes chemistry organic reactions', kind: 'preference', tags: [], importance: 0.9, access_count: 0, created_at: new Date().toISOString() },
    ];
    const { client } = makeStub(rows);
    const store = new ServerMemoryStore(client, 'user-1');
    const ctx = await store.getContextString('help with rotational motion torque', 8);
    expect(ctx).toContain('rotational motion torque');
    // The relevant memory should appear before the unrelated one.
    expect(ctx.indexOf('rotational')).toBeLessThan(ctx.indexOf('chemistry') === -1 ? Infinity : ctx.indexOf('chemistry'));
  });

  it('returns an empty string when there are no memories', async () => {
    const { client } = makeStub([]);
    const store = new ServerMemoryStore(client, 'user-1');
    expect(await store.getContextString('anything')).toBe('');
  });

  it('never throws if the backing query errors', async () => {
    const client: any = {
      from() { return this; },
      select() { return this; },
      eq() { return this; },
      order() { return this; },
      async limit() { throw new Error('db down'); },
    };
    const store = new ServerMemoryStore(client, 'user-1');
    await expect(store.getContextString('x')).resolves.toBe('');
  });
});
