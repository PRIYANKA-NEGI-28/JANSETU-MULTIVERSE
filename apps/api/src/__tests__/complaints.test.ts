import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { getComplaintStore } from '../services/complaint-store.js';
import { getInMemoryLimiter } from '../middleware/rate-limiter.js';
import type { PublicComplaintDto } from '../serializers/complaint.js';
import type { RfcProblemDetails } from '../types/index.js';

describe('Complaints Endpoints (Intake, Idempotency, Deduplication, & Queries)', () => {
  beforeEach(() => {
    getComplaintStore().reset();
    getInMemoryLimiter().reset();
  });

  const validPayload = {
    name: 'Vikram Joshi',
    phone: '+919876543210',
    text: 'Deep dangerous pothole in the middle lane causing vehicle damage.',
    area: 'Indirapuram Kala Patthar',
    wardId: 'ward-12',
    category: 'Road Damage',
    urgency: 'HIGH',
    departmentId: 'dept-pwd',
    lat: 28.6365,
    lng: 77.3715,
  };

  it('rejects complaint creation with invalid payload (text < 5 chars)', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validPayload, text: 'bad' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as RfcProblemDetails;
    expect(body.status).toBe(400);
    expect(body.title).toBe('Bad Request');
    expect(body.type).toBe('https://jansetu.gov.in/errors/validation-error');
    expect(body.errors).toBeDefined();
  });

  it('creates complaint, snaps publicLocation to ~50m grid, and returns 201 Created', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as PublicComplaintDto;

    expect(body.id).toBeDefined();
    expect(body.trackingCode).toMatch(/^JS-\d{8}-\d{4}$/);
    expect(body.category).toBe('Road Damage');
    expect(body.urgency).toBe('HIGH');
    expect(body.status).toBe('PENDING');
    expect(body.wardId).toBe('ward-12');
    expect(body.departmentId).toBe('dept-pwd');

    // Public Location privacy check
    expect(body.publicLocation.lat).toBe(28.6365);
    expect(body.publicLocation.lng).toBe(77.3715);
    expect('exactLocation' in body).toBe(false);
    expect('citizenPhone' in body).toBe(false);
  });

  it('enforces idempotency key on repeated submission (returns 200 OK with X-Idempotency-Hit)', async () => {
    const app = createApp();
    const idempotencyKey = 'idem-test-uniq-12345';

    // 1st request -> 201 Created
    const res1 = await app.request('/api/v1/complaints', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(validPayload),
    });
    expect(res1.status).toBe(201);
    const body1 = (await res1.json()) as PublicComplaintDto;

    // 2nd request with same idempotency key -> 200 OK with X-Idempotency-Hit
    const res2 = await app.request('/api/v1/complaints', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(validPayload),
    });

    expect(res2.status).toBe(200);
    expect(res2.headers.get('X-Idempotency-Hit')).toBe('true');
    const body2 = (await res2.json()) as PublicComplaintDto;
    expect(body2.id).toBe(body1.id);
    expect(body2.trackingCode).toBe(body1.trackingCode);
  });

  it('deduplicates complaints into nearby open cluster within 150m and increments cluster count', async () => {
    const app = createApp();
    const store = getComplaintStore();

    // 1st complaint creates a new cluster
    const res1 = await app.request('/api/v1/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validPayload,
        lat: 28.6301,
        lng: 77.3701,
      }),
    });
    expect(res1.status).toBe(201);
    const comp1 = (await res1.json()) as PublicComplaintDto;
    expect(comp1.clusterId).toBeDefined();

    const cluster1 = await store.findClusterById(comp1.clusterId!);
    expect(cluster1).toBeDefined();
    expect(cluster1?.complaintCount).toBe(1);

    // 2nd complaint located ~30m away (lat + 0.0002) of same department
    const res2 = await app.request('/api/v1/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validPayload,
        lat: 28.6303,
        lng: 77.3702,
        text: 'Another pothole right next to the previous one on the road.',
      }),
    });
    expect(res2.status).toBe(201);
    const comp2 = (await res2.json()) as PublicComplaintDto;

    // Second complaint is grouped into the same cluster
    expect(comp2.clusterId).toBe(comp1.clusterId);

    const clusterAfter = await store.findClusterById(comp1.clusterId!);
    expect(clusterAfter?.complaintCount).toBe(2);
  });

  it('queries complaints with pagination and filters', async () => {
    const app = createApp();

    // Create another complaint
    await app.request('/api/v1/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    const res = await app.request('/api/v1/complaints?page=1&limit=10&wardId=ward-12');
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: PublicComplaintDto[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    };

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.total).toBeGreaterThanOrEqual(1);

    // Ensure public data is properly redacted
    for (const item of body.data) {
      expect('exactLocation' in item).toBe(false);
      expect('citizenPhone' in item).toBe(false);
      expect('citizenEmail' in item).toBe(false);
      expect('citizenName' in item).toBe(false);
    }
  });

  it('retrieves complaint by tracking code', async () => {
    const app = createApp();

    const createRes = await app.request('/api/v1/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    const created = (await createRes.json()) as PublicComplaintDto;

    const res = await app.request(`/api/v1/complaints/${created.trackingCode}`);
    expect(res.status).toBe(200);

    const retrieved = (await res.json()) as PublicComplaintDto;
    expect(retrieved.id).toBe(created.id);
    expect(retrieved.trackingCode).toBe(created.trackingCode);
    expect(retrieved.category).toBe(created.category);
    expect('exactLocation' in retrieved).toBe(false);
    expect('citizenPhone' in retrieved).toBe(false);
    expect('citizenEmail' in retrieved).toBe(false);
    expect('citizenName' in retrieved).toBe(false);
  });

  it('returns 404 for unknown tracking code', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/complaints/JS-99999999-9999');

    expect(res.status).toBe(404);
    const body = (await res.json()) as RfcProblemDetails;
    expect(body.status).toBe(404);
    expect(body.title).toBe('Not Found');
  });
});
