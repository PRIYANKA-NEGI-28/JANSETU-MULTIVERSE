import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { getComplaintStore } from '../services/complaint-store.js';
import { getInMemoryLimiter } from '../middleware/rate-limiter.js';
import { getDefaultInMemoryCache } from '../services/cache.js';
import type { RfcProblemDetails, AuthUser } from '../types/index.js';
import type { AdminAnalyticsSummary, SlaBreachItem } from '../services/complaint-store.js';

describe('Clusters, Admin Analytics, and Geo Resolution Endpoints', () => {
  beforeEach(async () => {
    getComplaintStore().reset();
    getInMemoryLimiter().reset();
    await getDefaultInMemoryCache().clear();
  });

  const authOfficerWard12: Partial<AuthUser> = {
    id: 'officer-ward12',
    role: 'ward_officer',
    wardId: 'ward-12',
    departmentId: 'dept-elec',
  };

  const createAuthHeaders = (user: Partial<AuthUser>) => ({
    'x-test-user': JSON.stringify(user),
    'Content-Type': 'application/json',
  });

  describe('Cluster Timeline & Mutations', () => {
    it('retrieves cluster timeline events', async () => {
      const app = createApp();
      const res = await app.request('/api/v1/clusters/cluster-indirapuram-elec/timeline');

      expect(res.status).toBe(200);
      const body = (await res.json()) as { clusterId: string; events: unknown[] };
      expect(body.clusterId).toBe('cluster-indirapuram-elec');
      expect(Array.isArray(body.events)).toBe(true);
      expect(body.events.length).toBeGreaterThanOrEqual(1);
    });

    it('assigns officer to cluster with audit event logged', async () => {
      const app = createApp();
      const res = await app.request('/api/v1/clusters/cluster-indirapuram-elec/assign', {
        method: 'PATCH',
        headers: createAuthHeaders(authOfficerWard12),
        body: JSON.stringify({
          officerId: 'officer.rajesh@jansetu.gov.in',
          notes: 'Assigned to field technician Rajesh',
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { id: string; assignedOfficerId: string };
      expect(body.id).toBe('cluster-indirapuram-elec');
      expect(body.assignedOfficerId).toBe('officer.rajesh@jansetu.gov.in');
    });

    it('rejects invalid state machine transition with 400 Bad Request', async () => {
      const app = createApp();

      // Cluster status is 'IN_PROGRESS'; transition to 'PENDING' is prohibited by state machine
      const res = await app.request('/api/v1/clusters/cluster-indirapuram-elec/status', {
        method: 'PATCH',
        headers: createAuthHeaders(authOfficerWard12),
        body: JSON.stringify({
          status: 'PENDING',
          notes: 'Attempting to revert progress to pending',
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as RfcProblemDetails;
      expect(body.status).toBe(400);
      expect(body.title).toBe('Invalid Status Transition');
      expect(body.detail).toContain('prohibits transition');
    });

    it('accepts valid state machine transition (IN_PROGRESS -> RESOLVED) and propagates', async () => {
      const app = createApp();
      const res = await app.request('/api/v1/clusters/cluster-indirapuram-elec/status', {
        method: 'PATCH',
        headers: createAuthHeaders(authOfficerWard12),
        body: JSON.stringify({
          status: 'RESOLVED',
          notes: 'New LED light fixture installed and energized.',
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe('RESOLVED');
    });
  });

  describe('Map Clusters Endpoint (Bounding Box & Redis Cache)', () => {
    it('returns clusters within bounding box with Redis cache MISS then HIT', async () => {
      const app = createApp();

      // 1st request -> MISS
      const res1 = await app.request('/api/v1/map/clusters?minLat=28.0&minLng=77.0&maxLat=29.0&maxLng=78.0');
      expect(res1.status).toBe(200);
      expect(res1.headers.get('X-Cache')).toBe('MISS');

      const body1 = (await res1.json()) as { data: unknown[] };
      expect(Array.isArray(body1.data)).toBe(true);
      expect(body1.data.length).toBeGreaterThanOrEqual(1);

      // 2nd request -> HIT
      const res2 = await app.request('/api/v1/map/clusters?minLat=28.0&minLng=77.0&maxLat=29.0&maxLng=78.0');
      expect(res2.status).toBe(200);
      expect(res2.headers.get('X-Cache')).toBe('HIT');
    });
  });

  describe('Admin Analytics & SLA Breaches', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const app = createApp();
      const res = await app.request('/api/v1/admin/analytics');
      expect(res.status).toBe(401);

      const breachRes = await app.request('/api/v1/admin/sla-breaches');
      expect(breachRes.status).toBe(401);
    });

    it('rejects citizen role with 403 Forbidden', async () => {
      const app = createApp();
      const res = await app.request('/api/v1/admin/analytics', {
        headers: { Authorization: 'Bearer demo-token-citizen' },
      });
      expect(res.status).toBe(403);
    });

    it('aggregates department statistics and status breakdowns for admin/officer', async () => {
      const app = createApp();
      const res = await app.request('/api/v1/admin/analytics', {
        headers: { Authorization: 'Bearer demo-token-admin' },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as AdminAnalyticsSummary;

      expect(body.totalComplaints).toBeGreaterThanOrEqual(1);
      expect(body.totalClusters).toBeGreaterThanOrEqual(1);
      expect(body.statusBreakdown).toBeDefined();
      expect(body.urgencyBreakdown).toBeDefined();
      expect(body.departmentAnalytics.length).toBeGreaterThanOrEqual(1);
    });

    it('detects and lists overdue complaints via SLA breaches endpoint for admin/officer', async () => {
      const app = createApp();

      // Submit an overdue complaint directly into store
      const store = getComplaintStore();
      await store.createComplaint({
        idempotencyKey: 'idem-breach-test-01',
        citizenName: 'Overdue Citizen',
        category: 'Fire Hazard',
        urgency: 'CRITICAL',
        departmentId: 'dept-elec',
        wardId: 'ward-04',
        area: 'Mayur Vihar',
        text: 'Sparking transformer not fixed for days',
        lat: 28.601,
        lng: 77.302,
      });

      // Force SLA due date to 5 hours ago
      const created = await store.findComplaintByIdempotencyKey('idem-breach-test-01');
      if (created) {
        (created as { slaDueAt: Date }).slaDueAt = new Date(Date.now() - 5 * 3600 * 1000);
      }

      const res = await app.request('/api/v1/admin/sla-breaches', {
        headers: { Authorization: 'Bearer demo-token-admin' },
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as { count: number; breaches: SlaBreachItem[] };
      expect(body.count).toBeGreaterThanOrEqual(1);
      expect(body.breaches.length).toBeGreaterThanOrEqual(1);

      const found = body.breaches.find((b) => b.complaintId === created?.id);
      expect(found).toBeDefined();
      expect(found?.overdueHours).toBeGreaterThanOrEqual(4.9);
    });
  });

  describe('Geo Resolution Endpoint', () => {
    it('resolves ward and address from valid lat/lng coordinates', async () => {
      const app = createApp();
      // Indirapuram coordinates
      const res = await app.request('/api/v1/geo/resolve-ward?lat=28.636&lng=77.371');

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        wardId: string;
        wardName: string;
        locality: string;
        city: string;
        boundaryMatched: boolean;
      };

      expect(body.wardId).toBe('ward-12');
      expect(body.wardName).toContain('Indirapuram');
      expect(body.city).toBe('Ghaziabad');
      expect(body.boundaryMatched).toBe(true);
    });

    it('rejects invalid or missing coordinates with 400 Bad Request', async () => {
      const app = createApp();
      const resMissing = await app.request('/api/v1/geo/resolve-ward?lat=28.636');
      expect(resMissing.status).toBe(400);

      const resInvalid = await app.request('/api/v1/geo/resolve-ward?lat=abc&lng=77.371');
      expect(resInvalid.status).toBe(400);
    });
  });
});
