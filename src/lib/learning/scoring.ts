// ──────────────────────────────────────────────────────────────────────────
// JEE scoring & projection (pure)
// ──────────────────────────────────────────────────────────────────────────
//
// Pure helpers for mapping scores to percentiles and projecting performance.
// Extracted from getExpectedJEEPerformance / getRankTrajectories in the store
// so the logic is grounded in versioned data (src/data/jee-percentiles.ts) and
// is unit-testable, rather than relying on a hardcoded curve and a decorative
// sine-wave trajectory.

import { JEE_MAIN_PERCENTILE_CURVE, JEE_TARGETS, DEFAULT_TARGET_ID } from '@/data/jee-percentiles';

export const JEE_MAX_SCORE = 300;

/**
 * Map a JEE Main score (0–300) to an NTA percentile via piecewise-linear
 * interpolation over the published anchor table.
 */
export function scoreToPercentile(score: number): number {
  const s = clamp(score, 0, JEE_MAX_SCORE);
  const curve = JEE_MAIN_PERCENTILE_CURVE;
  if (s >= curve[0].score) return curve[0].percentile;
  const last = curve[curve.length - 1];
  if (s <= last.score) return last.percentile;
  for (let i = 0; i < curve.length - 1; i++) {
    const hi = curve[i];
    const lo = curve[i + 1];
    if (s <= hi.score && s >= lo.score) {
      const ratio = (s - lo.score) / (hi.score - lo.score);
      return round1(lo.percentile + ratio * (hi.percentile - lo.percentile));
    }
  }
  return 0;
}

export interface PerformanceInputs {
  /** Overall readiness 0–100 (from the readiness engine). */
  readiness: number;
  /** Score fractions (score/maxScore, 0–1) of past mock attempts, newest first. */
  testScoreFractions: number[];
  /** The selected target goal id (defaults to NIT Trichy CSE). */
  targetId?: string;
}

export interface PerformanceProjection {
  expectedScore: number;
  variance: number;
  percentile: number;
  bestCase: { score: number; percentile: number };
  likelyCase: { score: number; percentile: number };
  worstCase: { score: number; percentile: number };
  targetScore: number;
  targetLabel: string;
  targetMet: boolean;
  marksToTarget: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

/**
 * Project expected JEE performance from readiness + mock history.
 *
 * Improvements over the original:
 *   • Recent mocks weighted more than old ones (recency-weighted mean) instead
 *     of a flat average that treats a 6-month-old mock the same as yesterday's.
 *   • Percentile comes from the versioned data table, not an inline literal.
 *   • Target is configurable rather than hardcoded to one college.
 */
export function projectPerformance(inputs: PerformanceInputs): PerformanceProjection {
  const readiness = clamp(inputs.readiness, 0, 100);
  const fractions = inputs.testScoreFractions ?? [];
  const testCount = fractions.length;

  let finalPercentage: number;
  if (testCount > 0) {
    const testAvg = recencyWeightedMean(fractions) * 100;
    // Blend: mock history dominates, readiness fills in.
    finalPercentage = readiness * 0.4 + testAvg * 0.6;
  } else {
    finalPercentage = readiness;
  }

  const expectedScore = clamp(Math.round((finalPercentage / 100) * JEE_MAX_SCORE), 0, JEE_MAX_SCORE);

  // Variance narrows as more mocks are taken (uncertainty decreases).
  const variance = Math.max(8, Math.round(15 - testCount * 0.5));

  const target = JEE_TARGETS.find(t => t.id === (inputs.targetId ?? DEFAULT_TARGET_ID))
    ?? JEE_TARGETS.find(t => t.id === DEFAULT_TARGET_ID)!;
  const marksToTarget = target.score - expectedScore;

  const bestScore = clamp(expectedScore + variance, 0, JEE_MAX_SCORE);
  const worstScore = clamp(expectedScore - variance, 0, JEE_MAX_SCORE);

  return {
    expectedScore,
    variance,
    percentile: scoreToPercentile(expectedScore),
    bestCase: { score: bestScore, percentile: scoreToPercentile(bestScore) },
    likelyCase: { score: expectedScore, percentile: scoreToPercentile(expectedScore) },
    worstCase: { score: worstScore, percentile: scoreToPercentile(worstScore) },
    targetScore: target.score,
    targetLabel: target.label,
    targetMet: marksToTarget <= 0,
    marksToTarget: Math.max(0, marksToTarget),
    confidenceLevel: testCount >= 5 ? 'high' : testCount >= 2 ? 'medium' : 'low',
  };
}

/**
 * Project a percentile trajectory over the next `steps` mocks, grounded in the
 * student's actual recent trend rather than a fixed sine wave.
 *
 * Returns three scenario paths:
 *   • current   — linear extrapolation of the recent trend (do nothing different)
 *   • optimal   — trend + improvement from following the plan/revisions
 *   • degrading — trend if study/revision lapses (forgetting dominates)
 */
export function projectTrajectory(
  currentPercentile: number,
  recentPercentiles: number[],
  steps = 5,
): { current: number[]; optimal: number[]; degrading: number[]; labels: string[] } {
  const start = clamp(currentPercentile, 0, 100);
  const slope = trendSlope(recentPercentiles);

  const current: number[] = [start];
  const optimal: number[] = [start];
  const degrading: number[] = [start];
  const labels: string[] = ['Now'];

  for (let i = 1; i <= steps; i++) {
    // Headroom shrinks as you approach 100 (diminishing returns near the top).
    const headroom = (100 - current[i - 1]) / 100;
    current.push(round2(clamp(current[i - 1] + slope, 0, 99.99)));
    optimal.push(round2(clamp(optimal[i - 1] + Math.max(slope, 0) + 0.6 * headroom, 0, 99.99)));
    degrading.push(round2(clamp(degrading[i - 1] + Math.min(slope, 0) - 0.8 * (1 - headroom) - 0.4, 0, 100)));
    labels.push(`Mock ${i}`);
  }

  return { current, optimal, degrading, labels };
}

/** Least-squares slope of a recent series (oldest→newest). Empty/short → 0. */
function trendSlope(series: number[]): number {
  const ys = series.slice().reverse(); // incoming is newest-first
  const n = ys.length;
  if (n < 2) return 0;
  const xs = ys.map((_, i) => i);
  const meanX = (n - 1) / 2;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/** Exponentially-weighted mean favouring the most recent values (index 0). */
function recencyWeightedMean(values: number[]): number {
  if (values.length === 0) return 0;
  const lambda = 0.7; // decay per step back in time
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < values.length; i++) {
    const w = Math.pow(lambda, i);
    weightedSum += values[i] * w;
    weightTotal += w;
  }
  return weightTotal === 0 ? 0 : weightedSum / weightTotal;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
function round1(n: number): number { return Math.round(n * 10) / 10; }
function round2(n: number): number { return Math.round(n * 100) / 100; }
