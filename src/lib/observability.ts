// ──────────────────────────────────────────────────────────────────────────
// Error reporting seam
// ──────────────────────────────────────────────────────────────────────────
//
// A single funnel for server/client errors so they aren't lost in scattered
// console.warn calls. Today it logs structured JSON; wiring a real backend
// (Sentry, Axiom, Datadog) means implementing `dispatch` in ONE place.
//
// To enable Sentry later: `npm i @sentry/nextjs`, set NEXT_PUBLIC_SENTRY_DSN,
// and forward `dispatch` to Sentry.captureException — no call sites change.

export interface ErrorContext {
  /** Logical area, e.g. 'chat-route', 'sync', 'stream'. */
  scope: string;
  /** Arbitrary structured tags (ids, status codes — never secrets). */
  tags?: Record<string, string | number | boolean | undefined>;
}

function dispatch(error: unknown, context: ErrorContext): void {
  const payload = {
    level: 'error' as const,
    scope: context.scope,
    message: error instanceof Error ? error.message : String(error),
    tags: context.tags ?? {},
  };
  // Structured single-line log — easy to grep and to ship to a log drain.
  console.error('[error]', JSON.stringify(payload));
}

/** Report a handled error. Never throws. */
export function reportError(error: unknown, context: ErrorContext): void {
  try {
    dispatch(error, context);
  } catch {
    // Reporting must never crash the caller.
  }
}
