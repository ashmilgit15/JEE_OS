import { describe, it, expect } from 'vitest';
import { sm2, accuracyToQuality, ratingToQuality, SM2_DEFAULTS } from '@/lib/learning/sm2';

describe('sm2 scheduler', () => {
  it('first successful review → interval 1, repetitions 1', () => {
    const r = sm2(SM2_DEFAULTS, 4);
    expect(r.intervalDays).toBe(1);
    expect(r.repetitions).toBe(1);
    expect(r.lapsed).toBe(false);
  });

  it('second successful review → interval 6', () => {
    const r1 = sm2(SM2_DEFAULTS, 4);
    const r2 = sm2(r1, 4);
    expect(r2.intervalDays).toBe(6);
    expect(r2.repetitions).toBe(2);
  });

  it('third successful review multiplies by ease factor', () => {
    let s = sm2(SM2_DEFAULTS, 5);
    s = sm2(s, 5);
    const before = s.intervalDays;
    s = sm2(s, 5);
    // Interval grows (≈ before × easeFactor), so it must exceed the prior value.
    expect(s.intervalDays).toBeGreaterThan(before);
  });

  it('a lapse (quality < 3) resets repetitions and interval', () => {
    let s = sm2(SM2_DEFAULTS, 5);
    s = sm2(s, 5);
    const lapsed = sm2(s, 1);
    expect(lapsed.lapsed).toBe(true);
    expect(lapsed.repetitions).toBe(0);
    expect(lapsed.intervalDays).toBe(1);
  });

  it('ease factor never drops below 1.3', () => {
    let s = SM2_DEFAULTS;
    for (let i = 0; i < 20; i++) s = sm2(s, 0);
    expect(s.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('ease factor rises with perfect recall', () => {
    const r = sm2(SM2_DEFAULTS, 5);
    expect(r.easeFactor).toBeGreaterThan(SM2_DEFAULTS.easeFactor);
  });

  it('clamps out-of-range quality', () => {
    expect(() => sm2(SM2_DEFAULTS, 99)).not.toThrow();
    expect(() => sm2(SM2_DEFAULTS, -5)).not.toThrow();
    expect(sm2(SM2_DEFAULTS, -5).lapsed).toBe(true);
  });
});

describe('accuracyToQuality', () => {
  it('maps accuracy bands to quality', () => {
    expect(accuracyToQuality(95, 3)).toBe(5);
    expect(accuracyToQuality(80, 3)).toBe(4);
    expect(accuracyToQuality(65, 3)).toBe(3);
    expect(accuracyToQuality(50, 3)).toBe(2);
    expect(accuracyToQuality(35, 3)).toBe(1);
    expect(accuracyToQuality(10, 3)).toBe(0);
  });

  it('high confidence nudges quality up, low confidence down', () => {
    expect(accuracyToQuality(80, 5)).toBe(5); // 4 → 5
    expect(accuracyToQuality(80, 1)).toBe(3); // 4 → 3
  });

  it('never exceeds the 0–5 range', () => {
    expect(accuracyToQuality(100, 5)).toBeLessThanOrEqual(5);
    expect(accuracyToQuality(0, 0)).toBeGreaterThanOrEqual(0);
  });
});

describe('ratingToQuality', () => {
  it('orders again < hard < good < easy', () => {
    expect(ratingToQuality('again')).toBeLessThan(ratingToQuality('hard'));
    expect(ratingToQuality('hard')).toBeLessThan(ratingToQuality('good'));
    expect(ratingToQuality('good')).toBeLessThan(ratingToQuality('easy'));
  });
});
