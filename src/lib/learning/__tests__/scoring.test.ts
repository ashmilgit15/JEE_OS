import { describe, it, expect } from 'vitest';
import { scoreToPercentile, projectPerformance, projectTrajectory, JEE_MAX_SCORE } from '@/lib/learning/scoring';

describe('scoreToPercentile', () => {
  it('maps endpoints', () => {
    expect(scoreToPercentile(300)).toBe(100);
    expect(scoreToPercentile(0)).toBe(0);
  });

  it('is monotonically non-decreasing in score', () => {
    let prev = -1;
    for (let s = 0; s <= 300; s += 10) {
      const p = scoreToPercentile(s);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it('clamps out-of-range input', () => {
    expect(scoreToPercentile(400)).toBe(100);
    expect(scoreToPercentile(-50)).toBe(0);
  });

  it('interpolates between anchors', () => {
    const p = scoreToPercentile(210); // between 200 (99.4) and 220 (99.7)
    expect(p).toBeGreaterThan(99.4);
    expect(p).toBeLessThan(99.7);
  });
});

describe('projectPerformance', () => {
  it('uses readiness alone when there is no mock history', () => {
    const proj = projectPerformance({ readiness: 50, testScoreFractions: [] });
    expect(proj.expectedScore).toBe(Math.round(0.5 * JEE_MAX_SCORE));
    expect(proj.confidenceLevel).toBe('low');
  });

  it('weights recent mocks more heavily than old ones', () => {
    // Improving trend, newest first: most recent 0.8, oldest 0.4.
    const improving = projectPerformance({ readiness: 50, testScoreFractions: [0.8, 0.6, 0.4] });
    // Declining trend, newest first: most recent 0.4, oldest 0.8.
    const declining = projectPerformance({ readiness: 50, testScoreFractions: [0.4, 0.6, 0.8] });
    expect(improving.expectedScore).toBeGreaterThan(declining.expectedScore);
  });

  it('confidence rises with more mocks', () => {
    expect(projectPerformance({ readiness: 60, testScoreFractions: [0.6] }).confidenceLevel).toBe('low');
    expect(projectPerformance({ readiness: 60, testScoreFractions: [0.6, 0.6] }).confidenceLevel).toBe('medium');
    expect(projectPerformance({ readiness: 60, testScoreFractions: [0.6, 0.6, 0.6, 0.6, 0.6] }).confidenceLevel).toBe('high');
  });

  it('variance narrows as mocks accumulate', () => {
    const few = projectPerformance({ readiness: 60, testScoreFractions: [0.6] }).variance;
    const many = projectPerformance({ readiness: 60, testScoreFractions: Array(10).fill(0.6) }).variance;
    expect(many).toBeLessThanOrEqual(few);
  });

  it('reports target and marks-to-target', () => {
    const low = projectPerformance({ readiness: 30, testScoreFractions: [] });
    expect(low.targetMet).toBe(false);
    expect(low.marksToTarget).toBeGreaterThan(0);
    const high = projectPerformance({ readiness: 100, testScoreFractions: [1, 1, 1] });
    expect(high.targetMet).toBe(true);
    expect(high.marksToTarget).toBe(0);
  });

  it('keeps scores within 0–300', () => {
    const proj = projectPerformance({ readiness: 100, testScoreFractions: [1, 1, 1] });
    expect(proj.bestCase.score).toBeLessThanOrEqual(300);
    expect(proj.worstCase.score).toBeGreaterThanOrEqual(0);
  });
});

describe('projectTrajectory', () => {
  it('starts at the current percentile and has steps+1 points', () => {
    const t = projectTrajectory(95, [90, 92, 94], 5);
    expect(t.current[0]).toBe(95);
    expect(t.current.length).toBe(6);
    expect(t.labels.length).toBe(6);
  });

  it('optimal path is always >= current path', () => {
    const t = projectTrajectory(90, [88, 89, 90], 5);
    for (let i = 0; i < t.current.length; i++) {
      expect(t.optimal[i]).toBeGreaterThanOrEqual(t.current[i] - 1e-9);
    }
  });

  it('degrading path is always <= current path', () => {
    const t = projectTrajectory(90, [88, 89, 90], 5);
    for (let i = 0; i < t.current.length; i++) {
      expect(t.degrading[i]).toBeLessThanOrEqual(t.current[i] + 1e-9);
    }
  });

  it('an improving history yields a rising current path', () => {
    const t = projectTrajectory(80, [86, 83, 80], 5); // newest-first: improving to 86
    expect(t.current[t.current.length - 1]).toBeGreaterThan(t.current[0]);
  });

  it('caps percentiles below 100', () => {
    const t = projectTrajectory(99.9, [99, 99.5, 99.9], 5);
    for (const v of t.optimal) expect(v).toBeLessThan(100);
  });
});
