// ──────────────────────────────────────────────────────────────────────────
// Durable, distributed rate limiting
// ──────────────────────────────────────────────────────────────────────────
//
// The in-memory token bucket (rate-limit.ts) resets on every serverless cold
// start, so it can't enforce limits across instances. This module calls the
// atomic `check_rate_limit` SQL function (see supabase_schema.sql) so limits
// hold across all instances and survive restarts.
//
// If Supabase is unavailable or the RPC errors, we fall back to the in-memory
// limiter so a database hiccup never takes the endpoint down — degraded but
// still protected within a single instance.

import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { env } from '@/lib/env';
import { rateLimit } from '@/utils/rate-limit';

const memoryLimiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 500 });

/**
 * Returns true if the request is allowed, false if the limit is exceeded.
 *
 * @param key          unique bucket key, e.g. `${ip}:search`
 * @param maxRequests  allowed requests within the window
 * @param intervalSecs window length in seconds (default 60)
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  intervalSecs = 60,
): Promise<boolean> {
  if (env.supabaseConfigured) {
    try {
      const cookieStore = await cookies();
      const supabase = createClient(cookieStore);
      const { data, error } = await supabase.rpc('check_rate_limit', {
        key,
        max_requests: maxRequests,
        interval_secs: intervalSecs,
      });
      if (!error && typeof data === 'boolean') {
        return data;
      }
      // RPC missing or errored → fall through to in-memory.
    } catch {
      // Network/db error → fall through to in-memory.
    }
  }

  try {
    await memoryLimiter.check(maxRequests, key);
    return true;
  } catch {
    return false;
  }
}
