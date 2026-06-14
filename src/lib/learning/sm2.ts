// ──────────────────────────────────────────────────────────────────────────
// SM-2 spaced-repetition scheduler (pure)
// ──────────────────────────────────────────────────────────────────────────
//
// The classic SuperMemo-2 algorithm, extracted from the store reducer and the
// flashcards page (which both had near-identical inline copies) so there is a
// single, tested implementation. Used for:
//   • topic revisions (quality derived from accuracy + confidence)
//   • flashcard reviews (quality derived from the user's again/hard/good/easy)

export interface Sm2State {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface Sm2Result extends Sm2State {
  /** Whether the item lapsed (quality < 3) and was reset. */
  lapsed: boolean;
}

export const SM2_DEFAULTS: Sm2State = {
  easeFactor: 2.5,
  intervalDays: 1,
  repetitions: 0,
};

const MIN_EASE = 1.3;

/**
 * Advance an item through one SM-2 review.
 *
 * @param prev    the item's current SM-2 state
 * @param quality recall quality, 0 (total blackout) – 5 (perfect)
 */
export function sm2(prev: Sm2State, quality: number): Sm2Result {
  const q = clampInt(quality, 0, 5);
  let { easeFactor, intervalDays, repetitions } = {
    easeFactor: prev.easeFactor ?? SM2_DEFAULTS.easeFactor,
    intervalDays: prev.intervalDays ?? SM2_DEFAULTS.intervalDays,
    repetitions: prev.repetitions ?? SM2_DEFAULTS.repetitions,
  };

  let lapsed = false;
  if (q < 3) {
    // Lapse: restart the repetition schedule.
    repetitions = 0;
    intervalDays = 1;
    lapsed = true;
  } else {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetitions += 1;
  }

  // Standard SM-2 ease update.
  easeFactor = Math.max(MIN_EASE, easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

  return { easeFactor, intervalDays, repetitions, lapsed };
}

/**
 * Map a topic's measured accuracy (0–100) and self-rated confidence (0–5) to
 * an SM-2 quality score. Extracted verbatim from the COMPLETE_REVISION reducer
 * so behaviour is preserved while becoming testable.
 */
export function accuracyToQuality(accuracy: number, confidence: number): number {
  let q: number;
  if (accuracy >= 90) q = 5;
  else if (accuracy >= 75) q = 4;
  else if (accuracy >= 60) q = 3;
  else if (accuracy >= 45) q = 2;
  else if (accuracy >= 30) q = 1;
  else q = 0;

  if (confidence >= 4 && q < 5) q = Math.min(5, q + 1);
  if (confidence <= 1 && q > 0) q = Math.max(0, q - 1);
  return q;
}

/** Map a flashcard rating to an SM-2 quality score. */
export function ratingToQuality(rating: 'again' | 'hard' | 'good' | 'easy'): number {
  switch (rating) {
    case 'again': return 1;
    case 'hard': return 3;
    case 'good': return 4;
    case 'easy': return 5;
  }
}

function clampInt(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
