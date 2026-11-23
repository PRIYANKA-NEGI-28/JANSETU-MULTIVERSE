import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { getInMemoryLimiter } from '../middleware/rate-limiter.js';
import type { RfcProblemDetails } from '../types/index.js';

describe('Sliding Window Rate Limiter Middleware', () => {
  beforeEach(() => {
    getInMemoryLimiter().reset();
  });

  it('decrements remaining count on successive requests', async () => {
    const app = createApp({ rateLimit: { limit: 5, windowMs: 10_000 } });

    const res1 = await app.request('/health', {
      headers: { 'cf-connecting-ip': '192.168.1.100' },
    });
    expect(res1.status).toBe(200);
    expect(res1.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res1.headers.get('X-RateLimit-Remaining')).toBe('4');

    const res2 = await app.request('/health', {
      headers: { 'cf-connecting-ip': '192.168.1.100' },
    });
    expect(res2.status).toBe(200);
    expect(res2.headers.get('X-RateLimit-Remaining')).toBe('3');
  });

  it('blocks requests exceeding the limit with 429 Too Many Requests', async () => {
    const app = createApp({ rateLimit: { limit: 3, windowMs: 10_000 } });
    const ip = '10.0.0.42';

    // 3 allowed requests
    for (let i = 0; i < 3; i++) {
      const res = await app.request('/health', {
        headers: { 'cf-connecting-ip': ip },
      });
      expect(res.status).toBe(200);
    }

    // 4th request must be rejected with 429
    const blockedRes = await app.request('/health', {
      headers: { 'cf-connecting-ip': ip },
    });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(blockedRes.headers.get('Retry-After')).toBeDefined();
    expect(blockedRes.headers.get('content-type')).toContain('application/problem+json');

    const body = (await blockedRes.json()) as RfcProblemDetails;
    expect(body.status).toBe(429);
    expect(body.title).toBe('Too Many Requests');
    expect(body.detail).toContain('Rate limit exceeded');
  });

  it('tracks distinct IP addresses independently', async () => {
    const app = createApp({ rateLimit: { limit: 2, windowMs: 10_000 } });

    await app.request('/health', { headers: { 'cf-connecting-ip': '10.0.0.1' } });
    await app.request('/health', { headers: { 'cf-connecting-ip': '10.0.0.1' } });
    const blocked1 = await app.request('/health', { headers: { 'cf-connecting-ip': '10.0.0.1' } });
    expect(blocked1.status).toBe(429);

    // Different IP is unaffected
    const allowed2 = await app.request('/health', { headers: { 'cf-connecting-ip': '10.0.0.2' } });
    expect(allowed2.status).toBe(200);
    expect(allowed2.headers.get('X-RateLimit-Remaining')).toBe('1');
  });
});
