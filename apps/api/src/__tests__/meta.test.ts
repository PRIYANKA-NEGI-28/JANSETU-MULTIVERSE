import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { getInMemoryLimiter } from '../middleware/rate-limiter.js';
import { getDefaultInMemoryCache } from '../services/cache.js';
import type { MetaResponse } from '../routes/meta.js';

describe('GET /api/v1/meta', () => {
  beforeEach(async () => {
    getInMemoryLimiter().reset();
    await getDefaultInMemoryCache().clear();
  });

  it('returns complete civic metadata with cache MISS on initial request', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/meta');

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('MISS');

    const body = (await res.json()) as MetaResponse;
    expect(body.departments.length).toBe(16);
    expect(body.categories.length).toBe(16);

    const firstDept = body.departments[0]!;
    expect(firstDept.id).toBe('dept-001');
    expect(firstDept.code).toBeDefined();
    expect(firstDept.nameEn).toBe('Municipal Corporation - Electrical Division');
    expect(firstDept.nameHi).toBe('नगर निगम - विद्युत प्रभाग');
    expect(firstDept.defaultSlaHours).toBe(12);

    expect(body.categories).toContain('Street Light');
    expect(body.categories).toContain('Road Damage');
    expect(body.categories).toContain('Electricity Hazard');

    expect(body.slaPolicies.baseByUrgency.CRITICAL.resolutionHours).toBe(12);
    expect(body.slaPolicies.baseByUrgency.HIGH.resolutionHours).toBe(24);
    expect(body.slaPolicies.baseByUrgency.MEDIUM.resolutionHours).toBe(48);
    expect(body.slaPolicies.baseByUrgency.LOW.resolutionHours).toBe(72);
    expect(body.slaPolicies.categoryOverrides['Electricity Hazard']?.resolutionHours).toBe(6);
  });

  it('serves cached payload with X-Cache HIT on subsequent request', async () => {
    const app = createApp();

    // 1st request -> MISS
    const res1 = await app.request('/api/v1/meta');
    expect(res1.status).toBe(200);
    expect(res1.headers.get('X-Cache')).toBe('MISS');

    // 2nd request -> HIT
    const res2 = await app.request('/api/v1/meta');
    expect(res2.status).toBe(200);
    expect(res2.headers.get('X-Cache')).toBe('HIT');

    const body1 = (await res1.json()) as MetaResponse;
    const body2 = (await res2.json()) as MetaResponse;
    expect(body1.departments.length).toBe(body2.departments.length);
    expect(body1.timestamp).toBe(body2.timestamp);
  });
});
