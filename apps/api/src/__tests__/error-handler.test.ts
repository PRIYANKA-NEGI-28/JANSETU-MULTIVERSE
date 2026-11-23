import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { HttpError } from '../middleware/error-handler.js';
import { getInMemoryLimiter } from '../middleware/rate-limiter.js';
import { z } from 'zod';
import type { RfcProblemDetails } from '../types/index.js';

describe('Global Error Handler', () => {
  beforeEach(() => {
    getInMemoryLimiter().reset();
  });

  it('returns 404 Problem Details for non-existent routes', async () => {
    const app = createApp();
    const res = await app.request('/non-existent-route-xyz');

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect(res.headers.get('x-request-id')).toBeDefined();

    const body = (await res.json()) as RfcProblemDetails;
    expect(body.status).toBe(404);
    expect(body.title).toBe('Not Found');
    expect(body.detail).toContain('Cannot GET /non-existent-route-xyz');
    expect(body.instance).toBe('/non-existent-route-xyz');
    expect(body.requestId).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  it('formats custom HttpError properly', async () => {
    const app = createApp();
    app.get('/test/custom-error', () => {
      throw new HttpError(403, 'Forbidden Action', 'User lacks ward officer permissions');
    });

    const res = await app.request('/test/custom-error');
    expect(res.status).toBe(403);
    const body = (await res.json()) as RfcProblemDetails;

    expect(body.status).toBe(403);
    expect(body.title).toBe('Forbidden Action');
    expect(body.detail).toBe('User lacks ward officer permissions');
    expect(body.type).toBe('https://jansetu.gov.in/errors/403');
  });

  it('formats Zod validation errors as 400 with details', async () => {
    const app = createApp();
    app.post('/test/validation', async (c) => {
      const schema = z.object({
        area: z.string().min(3),
        urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
      });
      const data = await c.req.json();
      schema.parse(data);
      return c.json({ ok: true });
    });

    const res = await app.request('/test/validation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area: 'a', urgency: 'INVALID' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as RfcProblemDetails;
    expect(body.status).toBe(400);
    expect(body.title).toBe('Bad Request');
    expect(body.type).toBe('https://jansetu.gov.in/errors/validation-error');
    expect(body.errors).toBeDefined();
    expect(body.errors?.length).toBeGreaterThan(0);
  });

  it('redacts stack trace in production environment for unhandled exceptions', async () => {
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const app = createApp();
      app.get('/test/crash', () => {
        throw new Error('Database connection secret-string leaked');
      });

      const res = await app.request('/test/crash');
      expect(res.status).toBe(500);

      const body = (await res.json()) as RfcProblemDetails;
      expect(body.status).toBe(500);
      expect(body.title).toBe('Internal Server Error');
      expect(body.detail).toBe('An unexpected internal server error occurred');
      expect(body.stack).toBeUndefined();
    } finally {
      process.env.NODE_ENV = oldNodeEnv;
    }
  });
});
