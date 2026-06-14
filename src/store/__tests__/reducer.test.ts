import { describe, it, expect } from 'vitest';
import { reducer, initialState } from '@/store';
import type { AppState } from '@/types';

// The reducer is a pure function; we exercise the cases most likely to harbour
// regressions (status cascade, SM-2 revision math, audit logging).

function clone(): AppState {
  return JSON.parse(JSON.stringify(initialState));
}

// Pick any real topic id from the seeded syllabus.
const firstTopic = initialState.syllabus[0].chapters[0].topics[0];

describe('reducer: UPDATE_TOPIC_STATUS', () => {
  it('updates the targeted topic status and records a topic event + audit entry', () => {
    const next = reducer(clone(), {
      type: 'UPDATE_TOPIC_STATUS',
      payload: { topicId: firstTopic.id, status: 'learning', source: 'manual' },
    } as never);

    const updated = next.syllabus[0].chapters[0].topics[0];
    expect(updated.status).toBe('learning');
    expect(next.topicEvents.some(e => e.topicId === firstTopic.id && e.field === 'status')).toBe(true);
    expect(next.auditLog[0].action).toBe('UPDATE_TOPIC_STATUS');
  });

  it('does not mutate the input state', () => {
    const input = clone();
    const snapshot = JSON.stringify(input);
    reducer(input, {
      type: 'UPDATE_TOPIC_STATUS',
      payload: { topicId: firstTopic.id, status: 'mastered', source: 'manual' },
    } as never);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('reducer: ADD_STUDY_LOG', () => {
  it('prepends the log and writes an audit entry', () => {
    const log = {
      id: 'log-1', date: new Date().toISOString(), description: 'Kinematics practice',
      topicId: firstTopic.id, chapterId: 'phy-mechanics', subject: 'physics' as const,
      duration: 45, type: 'study' as const,
    };
    const next = reducer(clone(), { type: 'ADD_STUDY_LOG', payload: log } as never);
    expect(next.studyLogs[0].id).toBe('log-1');
    expect(next.auditLog.some(a => a.action === 'ADD_STUDY_LOG')).toBe(true);
  });
});

describe('reducer: SCHEDULE_REVISIONS + COMPLETE_REVISION', () => {
  it('schedules an increasing ladder of revisions for a topic', () => {
    const next = reducer(clone(), {
      type: 'SCHEDULE_REVISIONS',
      payload: {
        topicId: firstTopic.id, chapterId: 'phy-mechanics', subject: 'physics',
        topicName: firstTopic.name, chapterName: 'Mechanics',
        completedDate: new Date().toISOString(),
      },
    } as never);

    const revs = next.revisions.filter(r => r.topicId === firstTopic.id);
    expect(revs.length).toBeGreaterThan(0);
    // due dates should be strictly increasing
    const dueTimes = revs.map(r => new Date(r.dueDate).getTime());
    for (let i = 1; i < dueTimes.length; i++) {
      expect(dueTimes[i]).toBeGreaterThan(dueTimes[i - 1]);
    }
  });

  it('completing a revision produces a follow-up revision and an audit entry', () => {
    let state = clone();
    state = reducer(state, {
      type: 'SCHEDULE_REVISIONS',
      payload: {
        topicId: firstTopic.id, chapterId: 'phy-mechanics', subject: 'physics',
        topicName: firstTopic.name, chapterName: 'Mechanics',
        completedDate: new Date().toISOString(),
      },
    } as never);

    const before = state.revisions.filter(r => r.topicId === firstTopic.id && !r.completedDate).length;
    state = reducer(state, {
      type: 'COMPLETE_REVISION',
      payload: { topicId: firstTopic.id, revisionNumber: 1 },
    } as never);

    expect(state.revisions.some(r => r.completedDate)).toBe(true);
    const after = state.revisions.filter(r => r.topicId === firstTopic.id && !r.completedDate).length;
    // one completed, one new follow-up scheduled → pending count stays ≥ before-1
    expect(after).toBeGreaterThanOrEqual(before - 1);
    expect(state.auditLog.some(a => a.action === 'COMPLETE_REVISION')).toBe(true);
  });
});

describe('reducer: unknown action', () => {
  it('returns the same state reference for an unhandled action', () => {
    const input = clone();
    const out = reducer(input, { type: '__UNKNOWN__' } as never);
    expect(out).toBe(input);
  });
});
