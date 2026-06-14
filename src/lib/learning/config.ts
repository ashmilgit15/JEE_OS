// ──────────────────────────────────────────────────────────────────────────
// Learning-engine configuration & domain reference data
// ──────────────────────────────────────────────────────────────────────────
//
// Centralizes the "magic numbers" and hardcoded tables that were previously
// scattered (and in some cases broken) inside the store's engine functions:
//
//   • Readiness weighting (was inline in getReadinessScore).
//   • Per-CHAPTER JEE weightage (the ROI engine's table was keyed by topic id
//     but looked up by chapter id, so it silently always fell back to 3.0 —
//     this fixes that by keying on real chapter ids from defaultSyllabus).
//   • Prerequisite graph (the old list referenced topic ids that no longer
//     exist in the syllabus; corrected here and covered by an integrity test).

import type { SubjectId } from '@/types';

/** Weights for the readiness score components. Must sum to 1. */
export const READINESS_WEIGHTS = {
  completion: 0.30,
  confidence: 0.20,
  testAccuracy: 0.25,
  revisionConsistency: 0.15,
  mastery: 0.10,
} as const;

/**
 * Approximate JEE Main weightage (relative marks importance) per CHAPTER.
 * Keyed by the chapter ids in src/data/syllabus.ts. Used by the ROI engine to
 * prioritise high-yield chapters. Chapters not listed default to 3.0.
 */
export const CHAPTER_WEIGHTAGE: Record<string, number> = {
  // Physics
  'phy-mechanics': 5.5,
  'phy-thermo': 3.5,
  'phy-waves': 3.0,
  'phy-electrostatics': 5.0,
  'phy-current': 4.0,
  'phy-magnetism': 4.0,
  'phy-emi': 4.5,
  'phy-emwaves': 2.5,
  'phy-optics': 4.5,
  'phy-modern': 5.0,
  // Chemistry
  'chem-basic': 3.5,
  'chem-bonding': 4.0,
  'chem-equilibrium': 4.0,
  'chem-thermo': 3.5,
  'chem-kinetics': 3.0,
  'chem-electrochemistry': 3.5,
  'chem-solutions': 3.0,
  'chem-solid': 3.0,
  'chem-surface': 2.5,
  'chem-coordination': 4.5,
  'chem-organic-basic': 4.5,
  'chem-hydrocarbons': 3.5,
  'chem-organic-functional': 5.5,
  'chem-inorganic': 4.5,
  // Mathematics
  'math-algebra': 5.0,
  'math-trigonometry': 3.0,
  'math-coordinate': 4.5,
  'math-calculus': 5.5,
  'math-vectors': 4.0,
};

export const DEFAULT_CHAPTER_WEIGHTAGE = 3.0;

export function chapterWeightage(chapterId: string): number {
  return CHAPTER_WEIGHTAGE[chapterId] ?? DEFAULT_CHAPTER_WEIGHTAGE;
}

/**
 * Prerequisite dependency edges. `dependent` should not be studied before
 * `prerequisite` is solid. All ids are validated against defaultSyllabus by
 * src/lib/learning/__tests__/integrity.test.ts so they cannot silently rot.
 */
export interface PrereqEdge {
  dependent: string;
  prerequisite: string;
  reason: string;
}

export const PREREQUISITE_EDGES: PrereqEdge[] = [
  // Mathematics — calculus chain
  { dependent: 'math-calc-differentiability', prerequisite: 'math-calc-limits', reason: 'Differentiability requires a solid grasp of limit convergence.' },
  { dependent: 'math-calc-differentiation', prerequisite: 'math-calc-differentiability', reason: 'Differentiation methods build on differentiability rules.' },
  { dependent: 'math-calc-application-diff', prerequisite: 'math-calc-differentiation', reason: 'Application of derivatives relies on differentiation techniques.' },
  { dependent: 'math-calc-definite', prerequisite: 'math-calc-indefinite', reason: 'Definite integrals require mastering antiderivatives first.' },
  { dependent: 'math-calc-area', prerequisite: 'math-calc-definite', reason: 'Area under curves is an application of definite integration.' },
  { dependent: 'math-calc-diffeq', prerequisite: 'math-calc-indefinite', reason: 'Differential equations require integration techniques.' },
  // Physics — mechanics chain
  { dependent: 'phy-mech-motion1d', prerequisite: 'phy-mech-units', reason: 'Kinematics relies on unit analysis and conversions.' },
  { dependent: 'phy-mech-motion2d', prerequisite: 'phy-mech-motion1d', reason: '2D motion extends 1D straight-line kinematics.' },
  { dependent: 'phy-mech-newton', prerequisite: 'phy-mech-motion2d', reason: "Newton's laws require vector acceleration from 2D motion." },
  { dependent: 'phy-mech-workenergy', prerequisite: 'phy-mech-newton', reason: 'Work and energy are derived from force concepts.' },
  { dependent: 'phy-mech-rotation', prerequisite: 'phy-mech-workenergy', reason: 'Rotational dynamics extends linear work-energy theorems.' },
  // Chemistry chains
  { dependent: 'chem-eq-ionic', prerequisite: 'chem-basic-mole', reason: 'Ionic equilibrium constants build on concentration/mole concepts.' },
  { dependent: 'chem-eq-ph', prerequisite: 'chem-eq-ionic', reason: 'pH and buffers are an application of ionic equilibrium.' },
  { dependent: 'chem-echem-cells', prerequisite: 'chem-eq-ionic', reason: 'Cell potentials are calculated from equilibrium concepts.' },
  { dependent: 'chem-echem-nernst', prerequisite: 'chem-echem-cells', reason: 'The Nernst equation builds on electrochemical cell basics.' },
  { dependent: 'chem-org-goc', prerequisite: 'chem-org-nomenclature', reason: 'General organic chemistry assumes you can name structures.' },
  { dependent: 'chem-org-effects', prerequisite: 'chem-org-goc', reason: 'Electronic effects build on general organic chemistry.' },
];

/** Marking scheme (JEE Main default: +4 correct, -1 wrong, 0 unattempted). */
export const MARKING_SCHEME: Record<SubjectId | 'default', { correct: number; wrong: number; unattempted: number }> = {
  default: { correct: 4, wrong: -1, unattempted: 0 },
  physics: { correct: 4, wrong: -1, unattempted: 0 },
  chemistry: { correct: 4, wrong: -1, unattempted: 0 },
  mathematics: { correct: 4, wrong: -1, unattempted: 0 },
};
