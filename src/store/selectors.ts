'use client';

// Thin selector hooks layered over the unified store.
//
// These exist so components can subscribe to a narrow slice of derived state
// with an intention-revealing name, instead of pulling the whole `useStore()`
// surface. They keep call sites decoupled from the store's internal shape: if
// the underlying computation moves, only the hook changes.
//
// `dispatch`-only consumers should use `useDispatch()` from DispatchContext
// directly to avoid re-rendering on state changes.

import { useStore } from './index';
import type { SubjectId } from '@/types';

/** Overall exam readiness (0–100) plus per-subject breakdown. */
export function useReadiness() {
  const { getOverallReadiness, getReadinessScore } = useStore();
  return {
    overall: getOverallReadiness(),
    physics: getReadinessScore('physics'),
    chemistry: getReadinessScore('chemistry'),
    mathematics: getReadinessScore('mathematics'),
  };
}

/** Readiness for a single subject (0–100). */
export function useSubjectReadiness(subjectId: SubjectId): number {
  const { getReadinessScore } = useStore();
  return getReadinessScore(subjectId);
}

/** Ranked list of what the student should study next. */
export function useWhatToStudyNext() {
  const { getWhatToStudyNext } = useStore();
  return getWhatToStudyNext();
}

/** Raw syllabus slice plus the visibility helpers that gate it. */
export function useSyllabusState() {
  const { state, getTopicById, isItemHidden } = useStore();
  return {
    syllabus: state.syllabus,
    getTopicById,
    isItemHidden,
  };
}
