import { describe, it, expect } from 'vitest';
import { defaultSyllabus } from '@/data/syllabus';
import { PREREQUISITE_EDGES, CHAPTER_WEIGHTAGE } from '@/lib/learning/config';

// Build the canonical id sets from the syllabus.
const topicIds = new Set<string>();
const chapterIds = new Set<string>();
for (const subject of defaultSyllabus) {
  for (const chapter of subject.chapters) {
    chapterIds.add(chapter.id);
    for (const topic of chapter.topics) {
      topicIds.add(topic.id);
    }
  }
}

describe('learning-engine reference data integrity', () => {
  it('every prerequisite edge references topic ids that exist in the syllabus', () => {
    const missing: string[] = [];
    for (const edge of PREREQUISITE_EDGES) {
      if (!topicIds.has(edge.dependent)) missing.push(`dependent:${edge.dependent}`);
      if (!topicIds.has(edge.prerequisite)) missing.push(`prerequisite:${edge.prerequisite}`);
    }
    expect(missing, `Unknown topic ids in PREREQUISITE_EDGES: ${missing.join(', ')}`).toEqual([]);
  });

  it('no prerequisite edge is self-referential', () => {
    for (const edge of PREREQUISITE_EDGES) {
      expect(edge.dependent).not.toBe(edge.prerequisite);
    }
  });

  it('every chapter weightage key is a real chapter id', () => {
    const missing = Object.keys(CHAPTER_WEIGHTAGE).filter(id => !chapterIds.has(id));
    expect(missing, `Unknown chapter ids in CHAPTER_WEIGHTAGE: ${missing.join(', ')}`).toEqual([]);
  });

  it('every syllabus chapter has an explicit weightage (no silent defaults)', () => {
    const uncovered = [...chapterIds].filter(id => !(id in CHAPTER_WEIGHTAGE));
    expect(uncovered, `Chapters missing weightage: ${uncovered.join(', ')}`).toEqual([]);
  });

  it('topic ids are globally unique', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const subject of defaultSyllabus) {
      for (const chapter of subject.chapters) {
        for (const topic of chapter.topics) {
          if (seen.has(topic.id)) dupes.push(topic.id);
          seen.add(topic.id);
        }
      }
    }
    expect(dupes).toEqual([]);
  });
});
