// Shared parsing for ordinal topic references like "first topic of Mechanics",
// "3rd topic in Thermodynamics" or "last topic of Optics". Used by the chat API
// route, the study-log autocomplete and the store action handler.

const ORDINAL_WORDS: Record<string, number> = {
  '1st': 0, first: 0,
  '2nd': 1, second: 1,
  '3rd': 2, third: 2,
  '4th': 3, fourth: 3,
  '5th': 4, fifth: 4,
  '6th': 5, sixth: 5,
  '7th': 6, seventh: 6,
  '8th': 7, eighth: 7,
  '9th': 8, ninth: 8,
  '10th': 9, tenth: 9,
};

const ORDINAL_TOPIC_RE =
  /^(1st|first|2nd|second|3rd|third|4th|fourth|5th|fifth|6th|sixth|7th|seventh|8th|eighth|9th|ninth|10th|tenth|last)\s+topic(?:\s+in\s+|\s+of\s+|\s+from\s+)(.+)$/i;

export interface OrdinalTopicQuery {
  /** Zero-based topic index, or 'last' for the final topic of the chapter. */
  position: number | 'last';
  /** Lowercased chapter name the user referred to, with "chapter" stripped. */
  chapterQuery: string;
}

export function parseOrdinalTopicQuery(input: string): OrdinalTopicQuery | null {
  const match = input.match(ORDINAL_TOPIC_RE);
  if (!match) return null;
  const ordinal = match[1].toLowerCase();
  const chapterQuery = match[2].replace(/chapter/i, '').toLowerCase().trim();
  if (!chapterQuery) return null;
  return {
    position: ordinal === 'last' ? 'last' : ORDINAL_WORDS[ordinal] ?? 0,
    chapterQuery,
  };
}

/** Resolve an OrdinalTopicQuery position against a list length; -1 if out of range. */
export function resolveOrdinalPosition(position: number | 'last', length: number): number {
  if (length <= 0) return -1;
  const index = position === 'last' ? length - 1 : position;
  return index >= 0 && index < length ? index : -1;
}

/** Loose chapter-name match: exact, or either string contains the other. */
export function chapterNameMatchesQuery(chapterName: string, chapterQuery: string): boolean {
  const name = chapterName.toLowerCase();
  return name === chapterQuery || name.includes(chapterQuery) || chapterQuery.includes(name);
}
