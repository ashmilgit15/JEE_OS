// ──────────────────────────────────────────────────────────────────────────
// Environment configuration & validation
// ──────────────────────────────────────────────────────────────────────────
//
// Centralizes access to environment variables with Zod validation, instead of
// reading `process.env.X!` (non-null asserted) in scattered places. Optional
// keys degrade gracefully but emit a one-time startup warning so deployers
// notice missing configuration instead of debugging silent feature loss.
//
// NEXT_PUBLIC_* vars are inlined by Next at build time and are safe to read on
// the client. Server-only keys (HACKCLUB/TAVILY) are read lazily so they are
// never bundled into client code.

import { z } from 'zod';

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
});

const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

/** Public (browser-safe) configuration. */
export const env = {
  supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabasePublishableKey: publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  get supabaseConfigured() {
    return Boolean(this.supabaseUrl && this.supabasePublishableKey);
  },
};

let warned = false;

/**
 * Server-only secrets. Call inside route handlers / server utilities only.
 * Logs a single warning if optional integration keys are missing.
 */
export function serverEnv() {
  const hackClubApiKey = process.env.HACKCLUB_API_KEY ?? '';
  const hackClubModel = process.env.HACKCLUB_MODEL || 'google/gemini-3.5-flash';
  const tavilyApiKey = process.env.TAVILY_API_KEY ?? '';

  if (!warned) {
    warned = true;
    if (!hackClubApiKey) {
      console.warn('[env] HACKCLUB_API_KEY is not set — AI chat will use the local smart-fallback only.');
    }
    if (!tavilyApiKey) {
      console.warn('[env] TAVILY_API_KEY is not set — web/textbook search and mock generation will degrade.');
    }
    if (!env.supabaseConfigured) {
      console.warn('[env] Supabase env vars are missing — sync and auth are disabled (local-only mode).');
    }
  }

  return {
    hackClubApiKey,
    hackClubModel,
    tavilyApiKey,
    hackClubConfigured: Boolean(hackClubApiKey),
    tavilyConfigured: Boolean(tavilyApiKey),
  };
}
