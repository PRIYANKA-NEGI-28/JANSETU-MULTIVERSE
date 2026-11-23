import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { getInMemoryLimiter } from '../middleware/rate-limiter.js';
import { parseAllowedOrigins } from '../middleware/cors.js';

describe('CORS and Security Headers Middleware', () => {
  beforeEach(() => {
    getInMemoryLimiter().reset();
  });

  it('parses comma-separated origins cleanly', () => {
    const origins = parseAllowedOrigins('http://localhost:5173, https://jansetu.gov.in , http://localhost:3000');
    expect(origins).toEqual([
      'http://localhost:5173',
      'https://jansetu.gov.in',
      'http://localhost:3000',
    ]);
  });

  it('allows matching origin and attaches CORS headers', async () => {
    const app = createApp();
    const res = await app.request('/health', {
      headers: {
        Origin: 'http://localhost:5173',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(res.headers.get('Vary')).toContain('Origin');
  });

  it('does not reflect disallowed origin', async () => {
    const app = createApp();
    const res = await app.request('/health', {
      headers: {
        Origin: 'http://malicious-civic-phish.com',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('handles OPTIONS preflight for allowed origin with 204 No Content', async () => {
    const app = createApp();
    const res = await app.request('/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });

  it('blocks OPTIONS preflight for disallowed origin with 403 Forbidden', async () => {
    const app = createApp();
    const res = await app.request('/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://unauthorized-domain.com',
      },
    });

    expect(res.status).toBe(403);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('applies all standard security headers on all responses', async () => {
    const app = createApp();
    const res = await app.request('/health');

    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains; preload');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'none'; frame-ancestors 'none';");
  });
});
