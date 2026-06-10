// Rate limit utility

interface RateLimitOptions {
  interval: number
  uniqueTokenPerInterval: number
}

interface TokenBucket {
  count: number
  lastRefill: number
}

const tokenBuckets = new Map<string, TokenBucket>()

export function rateLimit(options: RateLimitOptions) {
  return {
    check: (limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const now = Date.now()
        const bucket = tokenBuckets.get(token) || { count: 0, lastRefill: now }
        
        // Refill tokens if interval has passed
        if (now - bucket.lastRefill > options.interval) {
          bucket.count = 0
          bucket.lastRefill = now
        }

        bucket.count++
        tokenBuckets.set(token, bucket)

        if (bucket.count > limit) {
          reject(new Error("Rate limit exceeded"))
        } else {
          resolve()
        }
      }),
  }
}
