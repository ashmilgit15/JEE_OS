import { describe, it, expect } from 'vitest';
import {
  estimateStability,
  retrievability,
  forgettingProbability,
  nextIntervalDays,
  initialReviewLadder,
  RETENTION_TARGET,
} from '@/lib/learning/memory';

describe('memory model: retrievability', () => {
  it('is 1 immediately after review (t=0)', () => {
    expect(retrievability(0, 5)).toBeCloseTo(1, 5);
  });

  it('decays monotonically with time', () => {
    const r1 = retrievability(1, 5);
    const r5 = retrievability(5, 5);
    const r20 = retrievability(20, 5);
    expect(r1).toBeGreaterThan(r5);
    expect(r5).toBeGreaterThan(r20);
  });

  it('equals the retention target when t equals stability (curve calibration)', () => {
    expect(retrievability(10, 10)).toBeCloseTo(RETENTION_TARGET, 5);
    expect(retrievability(30, 30)).toBeCloseTo(RETENTION_TARGET, 5);
  });

  it('higher stability means slower forgetting', () => {
    expect(retrievability(10, 20)).toBeGreaterThan(retrievability(10, 5));
  });
});

describe('memory model: estimateStability', () => {
  const base = { confidence: 0, accuracy: 0, recalls: 0, studyHours: 0 };

  it('increases with confidence', () => {
    expect(estimateStability({ ...base, confidence: 5, daysSince: 0 }))
      .toBeGreaterThan(estimateStability({ ...base, confidence: 0, daysSince: 0 }));
  });

  it('increases with accuracy', () => {
    expect(estimateStability({ ...base, accuracy: 100, daysSince: 0 }))
      .toBeGreaterThan(estimateStability({ ...base, accuracy: 0, daysSince: 0 }));
  });

  it('increases with each successful recall (spacing effect)', () => {
    const r0 = estimateStability({ ...base, recalls: 0, daysSince: 0 });
    const r1 = estimateStability({ ...base, recalls: 1, daysSince: 0 });
    const r2 = estimateStability({ ...base, recalls: 2, daysSince: 0 });
    expect(r1).toBeGreaterThan(r0);
    expect(r2).toBeGreaterThan(r1);
  });

  it('stays within bounds for extreme/garbage inputs', () => {
    const huge = estimateStability({ confidence: 99, accuracy: 9999, recalls: 50, studyHours: 1e6, daysSince: 0 });
    expect(huge).toBeLessThanOrEqual(365);
    const nan = estimateStability({ confidence: NaN, accuracy: NaN, recalls: NaN, studyHours: NaN, daysSince: 0 });
    expect(Number.isFinite(nan)).toBe(true);
    expect(nan).toBeGreaterThanOrEqual(0.5);
  });
});

describe('memory model: forgettingProbability', () => {
  it('returns an integer percentage 0–100', () => {
    const p = forgettingProbability({ confidence: 3, accuracy: 70, recalls: 1, studyHours: 4, daysSince: 7 });
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(100);
    expect(Number.isInteger(p)).toBe(true);
  });

  it('is ~0 right after studying', () => {
    expect(forgettingProbability({ confidence: 3, accuracy: 70, recalls: 1, studyHours: 4, daysSince: 0 })).toBe(0);
  });

  it('grows the longer you go without review', () => {
    const inputs = { confidence: 2, accuracy: 60, recalls: 0, studyHours: 1 };
    expect(forgettingProbability({ ...inputs, daysSince: 30 }))
      .toBeGreaterThan(forgettingProbability({ ...inputs, daysSince: 2 }));
  });

  it('a well-mastered topic is forgotten more slowly than a weak one', () => {
    const strong = forgettingProbability({ confidence: 5, accuracy: 95, recalls: 4, studyHours: 20, daysSince: 14 });
    const weak = forgettingProbability({ confidence: 1, accuracy: 40, recalls: 0, studyHours: 1, daysSince: 14 });
    expect(strong).toBeLessThan(weak);
  });
});

describe('memory model: scheduling', () => {
  it('nextIntervalDays is at least 1 and rounds stability', () => {
    expect(nextIntervalDays(0.1)).toBe(1);
    expect(nextIntervalDays(6.4)).toBe(6);
    expect(nextIntervalDays(6.6)).toBe(7);
  });

  it('initialReviewLadder is strictly increasing (cumulative days)', () => {
    const ladder = initialReviewLadder({ confidence: 3, accuracy: 70, recalls: 0, studyHours: 4 });
    expect(ladder.length).toBe(4);
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i]).toBeGreaterThan(ladder[i - 1]);
    }
  });

  it('stronger topics get wider initial spacing than weaker ones', () => {
    const strong = initialReviewLadder({ confidence: 5, accuracy: 95, recalls: 2, studyHours: 20 });
    const weak = initialReviewLadder({ confidence: 1, accuracy: 40, recalls: 0, studyHours: 1 });
    expect(strong[strong.length - 1]).toBeGreaterThan(weak[weak.length - 1]);
  });
});
