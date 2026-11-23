import type { MiddlewareHandler } from 'hono';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { AppEnv, RfcProblemDetails } from '../types/index.js';

export interface RateLimitOptions {
  readonly limit?: number;
  readonly windowMs?: number;
}

export interface RateLimitDecision {
  readonly success: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly reset: number; // Unix timestamp in seconds
}

export class InMemorySlidingWindowRateLimiter {
  private readonly store = new Map<string, number[]>();
  private lastCleanup = Date.now();

  check(key: string, limit: number, windowMs: number): RateLimitDecision {
    const now = Date.now();

    // Periodic cleanup of stale entries every 60 seconds
    if (now - this.lastCleanup > 60_000) {
      this.cleanup(windowMs);
      this.lastCleanup = now;
    }

    const windowStart = now - windowMs;
    const existing = this.store.get(key) ?? [];
    const validTimestamps = existing.filter((timestamp) => timestamp > windowStart);

    if (validTimestamps.length >= limit) {
      const oldest = validTimestamps[0] ?? now;
      const reset = Math.ceil((oldest + windowMs) / 1000);
      return {
        success: false,
        limit,
        remaining: 0,
        reset,
      };
    }

    validTimestamps.push(now);
    this.store.set(key, validTimestamps);
    const reset = Math.ceil((now + windowMs) / 1000);

    return {
      success: true,
      limit,
      remaining: Math.max(0, limit - validTimestamps.length),
      reset,
    };
  }

  reset(): void {
    this.store.clear();
    this.lastCleanup = Date.now();
  }

  private cleanup(windowMs: number): void {
    const cutoff = Date.now() - windowMs;
    for (const [key, timestamps] of this.store.entries()) {
      const filtered = timestamps.filter((t) => t > cutoff);
      if (filtered.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, filtered);
      }
    }
  }
}

const inMemoryLimiter = new InMemorySlidingWindowRateLimiter();

export function getInMemoryLimiter(): InMemorySlidingWindowRateLimiter {
  return inMemoryLimiter;
}

const upstashRatelimitCache = new Map<string, Ratelimit>();

export function createRateLimiterMiddleware(options: RateLimitOptions = {}): MiddlewareHandler<AppEnv> {
  const limit = options.limit ?? 60;
  const windowMs = options.windowMs ?? 60_000;
  const windowSeconds = Math.max(1, Math.round(windowMs / 1000));

  return async (c, next) => {
    const env = c.get('env');
    const ip =
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      '127.0.0.1';

    const clientKey = `${ip}:${c.req.path}`;
    let decision: RateLimitDecision;

    if (env?.UPSTASH_REDIS_REST_URL && env?.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const cacheKey = `${env.UPSTASH_REDIS_REST_URL}:${limit}:${windowSeconds}`;
        let ratelimit = upstashRatelimitCache.get(cacheKey);
        if (!ratelimit) {
          const redis = new Redis({
            url: env.UPSTASH_REDIS_REST_URL,
            token: env.UPSTASH_REDIS_REST_TOKEN,
          });
          ratelimit = new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
            analytics: false,
          });
          upstashRatelimitCache.set(cacheKey, ratelimit);
        }

        const result = await ratelimit.limit(clientKey);
        decision = {
          success: result.success,
          limit: result.limit,
          remaining: result.remaining,
          reset: Math.ceil(result.reset / 1000),
        };
      } catch {
        // Fallback safely to in-memory limiter on Redis connection failure
        decision = inMemoryLimiter.check(clientKey, limit, windowMs);
      }
    } else {
      decision = inMemoryLimiter.check(clientKey, limit, windowMs);
    }

    c.header('X-RateLimit-Limit', String(decision.limit));
    c.header('X-RateLimit-Remaining', String(decision.remaining));
    c.header('X-RateLimit-Reset', String(decision.reset));

    if (!decision.success) {
      const retryAfterSeconds = Math.max(1, decision.reset - Math.floor(Date.now() / 1000));
      c.header('Retry-After', String(retryAfterSeconds));

      const requestId = c.get('requestId') || c.req.header('x-request-id') || crypto.randomUUID();
      const problem: RfcProblemDetails = {
        type: 'https://jansetu.gov.in/errors/429',
        title: 'Too Many Requests',
        status: 429,
        detail: `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`,
        instance: c.req.path,
        requestId,
        timestamp: new Date().toISOString(),
      };

      return c.json(problem, 429, {
        'Content-Type': 'application/problem+json',
        'X-Request-ID': requestId,
      });
    }

    return next();
  };
}
