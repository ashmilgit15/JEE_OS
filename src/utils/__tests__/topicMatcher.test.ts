import { describe, it, expect } from 'vitest';
import {
  parseOrdinalTopicQuery,
  resolveOrdinalPosition,
  chapterNameMatchesQuery,
} from '@/utils/topicMatcher';

describe('parseOrdinalTopicQuery', () => {
  it('parses "first topic of Mechanics"', () => {
    const q = parseOrdinalTopicQuery('first topic of Mechanics');
    expect(q).toEqual({ position: 0, chapterQuery: 'mechanics' });
  });

  it('parses numeric ordinals and "last"', () => {
    expect(parseOrdinalTopicQuery('3rd topic in Optics')?.position).toBe(2);
    expect(parseOrdinalTopicQuery('last topic of Calculus')?.position).toBe('last');
  });

  it('strips the word "chapter" from the chapter query', () => {
    expect(parseOrdinalTopicQuery('2nd topic of Mechanics chapter')?.chapterQuery).toBe('mechanics');
  });

  it('returns null for non-ordinal input', () => {
    expect(parseOrdinalTopicQuery('explain newtons laws')).toBeNull();
    expect(parseOrdinalTopicQuery('')).toBeNull();
  });
});

describe('resolveOrdinalPosition', () => {
  it('resolves numeric positions in range', () => {
    expect(resolveOrdinalPosition(0, 5)).toBe(0);
    expect(resolveOrdinalPosition(4, 5)).toBe(4);
  });
  it('resolves "last"', () => {
    expect(resolveOrdinalPosition('last', 5)).toBe(4);
  });
  it('returns -1 for out-of-range or empty', () => {
    expect(resolveOrdinalPosition(9, 5)).toBe(-1);
    expect(resolveOrdinalPosition(0, 0)).toBe(-1);
  });
});

describe('chapterNameMatchesQuery', () => {
  it('matches exact, substring, and superstring', () => {
    expect(chapterNameMatchesQuery('Mechanics', 'mechanics')).toBe(true);
    expect(chapterNameMatchesQuery('Wave Optics', 'optics')).toBe(true);
    expect(chapterNameMatchesQuery('Optics', 'wave optics')).toBe(true);
  });
  it('rejects unrelated names', () => {
    expect(chapterNameMatchesQuery('Mechanics', 'thermodynamics')).toBe(false);
  });
});
