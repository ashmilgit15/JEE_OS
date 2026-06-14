// ──────────────────────────────────────────────────────────────────────────
// JEE Main score → percentile reference data
// ──────────────────────────────────────────────────────────────────────────
//
// Anchors for mapping a JEE Main score (out of 300) to an NTA percentile.
// These are approximate, derived from publicly-reported NTA score-vs-percentile
// tables across recent sessions. They are intentionally kept as DATA (not
// hardcoded inside an algorithm) so they can be updated each year without
// touching logic, and so the source/year is auditable.
//
// NOTE: NTA percentiles vary year to year and session to session; treat these
// as a planning estimate, not a guarantee. Update `JEE_PERCENTILE_YEAR` and the
// anchors when fresh official data is published.

export const JEE_PERCENTILE_YEAR = 2025;

export interface PercentileAnchor {
  /** Score out of 300. */
  score: number;
  /** NTA percentile (0–100). */
  percentile: number;
}

/** Monotonic, descending-by-score anchor table. */
export const JEE_MAIN_PERCENTILE_CURVE: PercentileAnchor[] = [
  { score: 300, percentile: 100 },
  { score: 290, percentile: 99.99 },
  { score: 281, percentile: 99.98 },
  { score: 270, percentile: 99.95 },
  { score: 250, percentile: 99.9 },
  { score: 232, percentile: 99.8 },
  { score: 220, percentile: 99.7 },
  { score: 200, percentile: 99.4 },
  { score: 180, percentile: 98.7 },
  { score: 160, percentile: 97.7 },
  { score: 145, percentile: 96.5 },
  { score: 130, percentile: 94.8 },
  { score: 110, percentile: 91.5 },
  { score: 90, percentile: 86.5 },
  { score: 75, percentile: 80.0 },
  { score: 60, percentile: 71.0 },
  { score: 45, percentile: 57.0 },
  { score: 30, percentile: 40.0 },
  { score: 15, percentile: 20.0 },
  { score: 0, percentile: 0 },
];

/** Common aspirational targets (score out of 300) for goal tracking. */
export interface JeeTarget {
  id: string;
  label: string;
  score: number;
  approxPercentile: number;
}

export const JEE_TARGETS: JeeTarget[] = [
  { id: 'iit-bombay-cse', label: 'IIT Bombay CSE (JEE Adv)', score: 290, approxPercentile: 99.99 },
  { id: 'top-nit-cse', label: 'Top NIT CSE', score: 250, approxPercentile: 99.9 },
  { id: 'nit-trichy-cse', label: 'NIT Trichy CSE', score: 232, approxPercentile: 99.8 },
  { id: 'good-nit', label: 'Good NIT (any branch)', score: 200, approxPercentile: 99.4 },
  { id: 'iiit-gfti', label: 'IIIT / GFTI', score: 160, approxPercentile: 97.7 },
  { id: 'qualify-advanced', label: 'Qualify for JEE Advanced', score: 95, approxPercentile: 88.0 },
];

export const DEFAULT_TARGET_ID = 'nit-trichy-cse';
