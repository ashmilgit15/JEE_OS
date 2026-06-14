// ──────────────────────────────────────────────────────────────────────────
// Unified memory model (FSRS-lite)
// ──────────────────────────────────────────────────────────────────────────
//
// This module is the SINGLE source of truth for "how memory works" in JEE OS.
// Before this existed, three different formulas modelled the same concept and
// disagreed with each other:
//
//   1. getTopicForgettingProbability — exponential decay with strength
//        = 2.0 · (1+conf·0.5) · 1.8^recalls · (0.5+acc) · (1+√hours)
//   2. SCHEDULE_REVISIONS            — a *different* strength
//        = (0.5+conf/5·1.5) · 1.5^recalls · (0.3+acc/100·1.2) · (1+√hours·0.3)
//   3. COMPLETE_REVISION             — textbook SM-2 (easeFactor / quality)
//
// They are now all derived from ONE retrievability curve and ONE stability
// model, so the "chance you've forgotten" shown to the user and the "when is
// the next revision" the scheduler picks are always consistent.
//
// Model (inspired by FSRS / the DSR memory model):
//
//   • Stability S (days): how long memory lasts. The interval after which
//     retrievability decays to RETENTION_TARGET.
//   • Retrievability R(t) = (1 + FACTOR · t / S) ^ DECAY
//     — a power-law forgetting curve (heavier tail than pure exponential,
//       which matches empirical spacing-effect data better than Ebbinghaus).
//   • On each successful review, stability grows; on a lapse, it collapses.
//
// All functions here are PURE and fully unit-tested in
// src/lib/learning/__tests__/memory.test.ts.

/** Target retention used to pick the next interval (FSRS default ≈ 0.9). */
export const RETENTION_TARGET = 0.9;

/** Power-law decay exponent. More negative → faster forgetting. */
const DECAY = -0.5;

/** Derived so that R(S) === RETENTION_TARGET exactly. */
const FACTOR = Math.pow(RETENTION_TARGET, 1 / DECAY) - 1; // ≈ 0.2346

/** Stability bounds (days). */
const MIN_STABILITY = 0.5;
const MAX_STABILITY = 365;

/** Inputs that describe what we know about a topic's memory strength. */
export interface MemoryInputs {
  /** Self-rated confidence, 0–5. */
  confidence: number;
  /** Measured accuracy, 0–100. */
  accuracy: number;
  /** Number of completed reviews/recalls so far. */
  recalls: number;
  /** Total study hours logged on the topic. */
  studyHours: number;
  /** Days since the last review/study touch. */
  daysSince: number;
}

/**
 * Initial stability (in days) for a topic, before any spaced reviews.
 * Driven by how well the student currently knows it: higher confidence,
 * accuracy, study time and prior recalls → longer-lasting memory.
 *
 * This replaces BOTH ad-hoc "strength" formulas (#1 and #2 above).
 */
export function estimateStability(inputs: MemoryInputs): number {
  const confidence = clamp(inputs.confidence, 0, 5);
  const accuracy = clamp(inputs.accuracy, 0, 100) / 100;
  const recalls = Math.max(0, inputs.recalls);
  const hours = Math.max(0, inputs.studyHours);

  // Base half-life in days for a freshly-learned, low-confidence topic.
  const base = 1.0;
  // Confidence: 0 → ×1.0, 5 → ×2.0.
  const confidenceScale = 1.0 + confidence * 0.2;
  // Accuracy: 0% → ×0.5, 100% → ×1.5.
  const accuracyScale = 0.5 + accuracy;
  // Each successful recall meaningfully lengthens retention (spacing effect).
  const recallScale = Math.pow(1.7, recalls);
  // Diminishing returns on raw study time.
  const hourScale = 1.0 + Math.sqrt(hours) * 0.5;

  const stability = base * confidenceScale * accuracyScale * recallScale * hourScale;
  return clamp(stability, MIN_STABILITY, MAX_STABILITY);
}

/**
 * Retrievability: probability the topic is still recallable `daysSince` days
 * after the last review, given its stability. Range (0, 1].
 */
export function retrievability(daysSince: number, stability: number): number {
  const t = Math.max(0, daysSince);
  const S = clamp(stability, MIN_STABILITY, MAX_STABILITY);
  return Math.pow(1 + FACTOR * (t / S), DECAY);
}

/**
 * Probability the topic has been FORGOTTEN, as an integer percentage 0–100.
 * This is the single function the UI ("forgetting probability") should use.
 */
export function forgettingProbability(inputs: MemoryInputs): number {
  const stability = estimateStability(inputs);
  const r = retrievability(inputs.daysSince, stability);
  return Math.round((1 - r) * 100);
}

/**
 * The next review interval (in whole days) that brings retrievability back
 * down to RETENTION_TARGET — i.e. schedule the review for when the student is
 * predicted to be ~90% likely to still remember.
 *
 * By construction this equals the stability, rounded and floored at 1 day.
 */
export function nextIntervalDays(stability: number): number {
  const S = clamp(stability, MIN_STABILITY, MAX_STABILITY);
  return Math.max(1, Math.round(S));
}

/**
 * Generate the initial ladder of review intervals (in days from now) for a
 * topic that was just completed. Each subsequent review assumes the previous
 * one succeeded, so stability compounds.
 *
 * Replaces the ad-hoc `[baseInterval, ×mult, ×mult², ×mult³]` array in
 * SCHEDULE_REVISIONS with intervals derived from the unified model.
 */
export function initialReviewLadder(
  inputs: Omit<MemoryInputs, 'daysSince'>,
  count = 4,
): number[] {
  const ladder: number[] = [];
  let recalls = Math.max(0, inputs.recalls);
  let cumulative = 0;
  for (let i = 0; i < count; i++) {
    const stability = estimateStability({ ...inputs, recalls, daysSince: 0 });
    const step = nextIntervalDays(stability);
    cumulative += step;
    ladder.push(cumulative);
    recalls += 1; // assume this review succeeds → memory strengthens
  }
  return ladder;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
