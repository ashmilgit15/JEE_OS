// ──────────────────────────────────────────────────────────────────────────
// Canonical subject design tokens
// ──────────────────────────────────────────────────────────────────────────
//
// Single source of truth for subject colours/labels, replacing the ~9
// near-identical `SUBJECT_META` / `subjectColor` maps duplicated across pages.
// Pages import the slice they need (text/bg/border/dot/bar classes, or hex for
// Recharts) instead of re-declaring the palette each time.

import type { SubjectId } from '@/types';

export interface SubjectTokens {
  label: string;
  /** Tailwind text colour class. */
  text: string;
  /** Tailwind subtle background class. */
  bg: string;
  /** Tailwind border class. */
  border: string;
  /** Tailwind solid dot/badge background class. */
  dot: string;
  /** Tailwind solid bar/fill background class (for progress bars). */
  bar: string;
  /** Hex colour (for Recharts / canvas / inline styles). */
  hex: string;
}

export const SUBJECT_TOKENS: Record<SubjectId, SubjectTokens> = {
  physics: {
    label: 'Physics',
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    dot: 'bg-blue-400',
    bar: 'bg-blue-500',
    hex: '#60a5fa',
  },
  chemistry: {
    label: 'Chemistry',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-400',
    bar: 'bg-emerald-500',
    hex: '#34d399',
  },
  mathematics: {
    label: 'Mathematics',
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    dot: 'bg-amber-400',
    bar: 'bg-amber-500',
    hex: '#fbbf24',
  },
};

export const SUBJECT_LABEL: Record<SubjectId, string> = {
  physics: SUBJECT_TOKENS.physics.label,
  chemistry: SUBJECT_TOKENS.chemistry.label,
  mathematics: SUBJECT_TOKENS.mathematics.label,
};

export const SUBJECT_IDS: SubjectId[] = ['physics', 'chemistry', 'mathematics'];
