import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { getInMemoryLimiter } from '../middleware/rate-limiter.js';
import { getDefaultInMemoryCache } from '../services/cache.js';

describe('GET /health', () => {
  beforeEach(async () => {
    getInMemoryLimiter().reset();
    await getDefaultInMemoryCache().clear();
  });

  it('returns 200 with healthy status and metadata', async () => {
    const app = createApp();
    const res = await app.request('/health');

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      version: string;
      uptime: number;
      timestamp: string;
    };

    expect(body.status).toBe('healthy');
    expect(body.version).toBe('1.0.0');
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.timestamp).toBe('string');
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  it('attaches X-Request-ID and security headers', async () => {
    const app = createApp();
    const res = await app.request('/health');

    expect(res.headers.get('X-Request-ID')).toBeDefined();
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
  });

  it('propagates custom X-Request-ID if valid', async () => {
    const app = createApp();
    const customId = 'req-custom-test-12345';
    const res = await app.request('/health', {
      headers: {
        'x-request-id': customId,
      },
    });

    expect(res.headers.get('X-Request-ID')).toBe(customId);
  });
});
