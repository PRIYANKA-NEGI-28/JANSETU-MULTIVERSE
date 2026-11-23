import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp } from '../app.js';
import { getComplaintStore } from '../services/complaint-store.js';
import {
  getQueueService,
  resetQueueService,
  setQueueService,
  QueueService,
} from '../services/queue.js';
import {
  getRealtimeService,
  resetRealtimeService,
} from '../services/realtime.js';
import { getInMemoryLimiter } from '../middleware/rate-limiter.js';

describe('Upstash QStash & Ably Real-Time Integration', () => {
  const app = createApp();
  const store = getComplaintStore();

  beforeEach(() => {
    store.reset();
    resetQueueService();
    resetRealtimeService();
    getInMemoryLimiter().reset();
  });

  afterEach(() => {
    resetQueueService();
    resetRealtimeService();
    vi.restoreAllMocks();
  });

  describe('QStash Webhook Signature Verification & Rejection', () => {
    it('rejects internal job requests with 401 Unauthorized when signature is missing or invalid', async () => {
      // Mock QueueService with an active signing key
      const mockReceiver = new QueueService();
      vi.spyOn(mockReceiver, 'verifyQStashSignature').mockResolvedValue(false);
      setQueueService(mockReceiver);

      const res = await app.request('/api/v1/internal/jobs/triage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'upstash-signature': 'invalid-tampered-sig',
        },
        body: JSON.stringify({
          complaintId: 'comp-seed-01',
        }),
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as Record<string, unknown>;
      expect(json['title']).toBe('Unauthorized');
      expect(json['detail']).toContain('Invalid or missing QStash webhook signature');
    });

    it('accepts internal job requests when QStash cryptographic signature is verified', async () => {
      const mockReceiver = new QueueService();
      vi.spyOn(mockReceiver, 'verifyQStashSignature').mockResolvedValue(true);
      setQueueService(mockReceiver);

      const res = await app.request('/api/v1/internal/jobs/sla-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'upstash-signature': 'valid-mock-signature',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as Record<string, unknown>;
      expect(json['success']).toBe(true);
      expect(typeof json['totalChecked']).toBe('number');
    });
  });

  describe('Asynchronous AI Triage Job (POST /api/v1/internal/jobs/triage)', () => {
    it('executes triage, updates cluster urgency/department on confidence >= 0.75, logs TRIAGED event, and publishes real-time message', async () => {
      const queue = getQueueService();
      const realtime = getRealtimeService();

      // Seed complaint with raw text
      const newComp = await store.createComplaint({
        idempotencyKey: 'triage-test-idempotency-01',
        citizenName: 'Deepak Verma',
        area: 'Mayur Vihar',
        category: 'General Complaint',
        urgency: 'MEDIUM',
        text: 'Live electric wire hanging loose from pole sparking dangerous accident khatra',
        lat: 28.602,
        lng: 77.298,
        language: 'en',
      });

      expect(newComp.category).toBe('General Complaint');

      // Execute triage
      const triageRes = await queue.executeTriage({
        complaintId: newComp.id,
        clusterId: newComp.clusterId,
      });

      expect(triageRes.success).toBe(true);
      expect(triageRes.triaged).toBe(true);
      expect(triageRes.confidence).toBeGreaterThanOrEqual(0.75);
      expect(triageRes.category).toBe('Electricity Hazard');
      expect(triageRes.urgency).toBe('CRITICAL');

      // Verify complaint was updated in store
      const updatedComp = await store.findComplaintById(newComp.id);
      expect(updatedComp?.category).toBe('Electricity Hazard');
      expect(updatedComp?.urgency).toBe('CRITICAL');

      // Verify TRIAGED audit event was logged
      const timeline = await store.getClusterTimeline(newComp.clusterId!);
      const triagedEvent = timeline.find((e) => e.eventType === 'TRIAGED');
      expect(triagedEvent).toBeDefined();

      // Verify Ably real-time events were published
      const published = realtime.getRecentEvents();
      expect(published.length).toBeGreaterThanOrEqual(1);
      const complaintMessage = published.find(
        (m) => m.channel === `complaint:${newComp.trackingCode}` && m.event === 'complaint:triaged'
      );
      expect(complaintMessage).toBeDefined();
    });
  });

  describe('SLA Escalation Idempotency (POST /api/v1/internal/jobs/sla-check)', () => {
    it('escalates overdue items (1→2→3) and strictly enforces idempotency at maximum level 3', async () => {
      const queue = getQueueService();
      const realtime = getRealtimeService();

      // Create an overdue complaint with slaDueAt in the past
      const pastDate = new Date(Date.now() - 48 * 3600 * 1000);
      const overdueComp = await store.createComplaint({
        idempotencyKey: 'sla-overdue-test-01',
        citizenName: 'Sunita Rao',
        area: 'Indirapuram',
        category: 'Road Damage',
        urgency: 'HIGH',
        text: 'Road completely damaged and cratered',
        lat: 28.636,
        lng: 77.371,
      });

      // Force slaDueAt into the past
      const compRecord = await store.findComplaintById(overdueComp.id);
      (compRecord as unknown as { slaDueAt: Date }).slaDueAt = pastDate;

      // First SLA Run: Level 0 -> 1
      const run1 = await queue.executeSlaCheck();
      expect(run1.escalatedCount).toBeGreaterThanOrEqual(1);

      const compAfterRun1 = await store.findComplaintById(overdueComp.id);
      expect(compAfterRun1?.escalationLevel).toBe(1);
      expect(compAfterRun1?.status).toBe('ESCALATED');

      // Second SLA Run: Level 1 -> 2
      const run2 = await queue.executeSlaCheck();
      expect(run2.escalatedCount).toBeGreaterThanOrEqual(1);

      const compAfterRun2 = await store.findComplaintById(overdueComp.id);
      expect(compAfterRun2?.escalationLevel).toBe(2);

      // Third SLA Run: Level 2 -> 3 (Max level)
      const run3 = await queue.executeSlaCheck();
      expect(run3.escalatedCount).toBeGreaterThanOrEqual(1);

      const compAfterRun3 = await store.findComplaintById(overdueComp.id);
      expect(compAfterRun3?.escalationLevel).toBe(3);

      // Fourth SLA Run: Idempotency enforcement (already at level 3, must NOT escalate further)
      const run4 = await queue.executeSlaCheck();
      expect(run4.escalatedCount).toBe(0);
      const compAfterRun4 = await store.findComplaintById(overdueComp.id);
      expect(compAfterRun4?.escalationLevel).toBe(3);

      // Check real-time alerts published for SLA breach
      const events = realtime.getRecentEvents();
      const breachAlerts = events.filter((e) => e.event === 'sla:breach');
      expect(breachAlerts.length).toBeGreaterThanOrEqual(1);
      const adminAlert = breachAlerts.find((e) => e.channel === 'admin:alerts');
      expect(adminAlert).toBeDefined();
    });
  });

  describe('Ably Channel Capability Scoping (GET /api/v1/realtime/token)', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await app.request('/api/v1/realtime/token', {
        method: 'GET',
      });
      expect(res.status).toBe(401);
    });

    it('scopes citizen capability strictly to their own complaint tracking codes', async () => {
      // Citizen filed comp1
      const citizenHeaders = {
        'x-test-user': JSON.stringify({
          id: 'citizen-user-88',
          name: 'Anil Kumar',
          role: 'citizen',
        }),
      };

      const comp = await store.createComplaint({
        idempotencyKey: 'citizen-realtime-scope-test',
        citizenId: 'citizen-user-88',
        citizenName: 'Anil Kumar',
        area: 'Patparganj',
        category: 'Water Supply',
        urgency: 'MEDIUM',
        text: 'Water supply stopped completely',
        lat: 28.62,
        lng: 77.3,
      });

      const res = await app.request(`/api/v1/realtime/token?trackingCode=${comp.trackingCode}`, {
        method: 'GET',
        headers: citizenHeaders,
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as Record<string, unknown>;
      const channelScope = json['channelScope'] as string[];
      const tokenRequest = json['tokenRequest'] as Record<string, unknown>;
      const capability = JSON.parse(tokenRequest['capability'] as string) as Record<string, string[]>;

      // Strictly allowed: complaint channel
      expect(channelScope).toContain(`complaint:${comp.trackingCode}`);
      expect(capability[`complaint:${comp.trackingCode}`]).toEqual(['subscribe']);

      // Prohibited: ward, dept, admin wildcard
      expect(channelScope).not.toContain('*');
      expect(capability['*']).toBeUndefined();
      expect(capability['admin:alerts']).toBeUndefined();
    });

    it('scopes ward officer capability to their assigned ward and department channels', async () => {
      const officerHeaders = {
        'x-test-user': JSON.stringify({
          id: 'officer-user-99',
          name: 'JE Satish Chandra',
          role: 'ward_officer',
          wardId: 'ward-indirapuram',
          departmentId: 'dept-roads',
        }),
      };

      const res = await app.request('/api/v1/realtime/token', {
        method: 'GET',
        headers: officerHeaders,
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as Record<string, unknown>;
      const channelScope = json['channelScope'] as string[];
      const tokenRequest = json['tokenRequest'] as Record<string, unknown>;
      const capability = JSON.parse(tokenRequest['capability'] as string) as Record<string, string[]>;

      expect(channelScope).toContain('ward:ward-indirapuram');
      expect(channelScope).toContain('dept:dept-roads');
      expect(capability['ward:ward-indirapuram']).toEqual(['subscribe']);
      expect(capability['dept:dept-roads']).toEqual(['subscribe']);

      // Cannot access admin alerts or global wildcard
      expect(channelScope).not.toContain('*');
      expect(capability['*']).toBeUndefined();
    });

    it('scopes admin capability to global wildcard with presence', async () => {
      const adminHeaders = {
        'x-test-user': JSON.stringify({
          id: 'admin-super-01',
          name: 'City Commissioner',
          role: 'admin',
        }),
      };

      const res = await app.request('/api/v1/realtime/token', {
        method: 'GET',
        headers: adminHeaders,
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as Record<string, unknown>;
      const channelScope = json['channelScope'] as string[];
      const tokenRequest = json['tokenRequest'] as Record<string, unknown>;
      const capability = JSON.parse(tokenRequest['capability'] as string) as Record<string, string[]>;

      expect(channelScope).toContain('*');
      expect(capability['*']).toEqual(['subscribe', 'presence']);
    });
  });

  describe('Local Dev Mode Clean Asynchronous Execution', () => {
    it('executes triage cleanly in the background without throwing when QStash credentials are absent', async () => {
      // Create complaint via POST /api/v1/complaints
      const res = await app.request('/api/v1/complaints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': 'dev-mode-async-triage-key-99',
        },
        body: JSON.stringify({
          name: 'Rajesh Malhotra',
          text: 'Potholes on the road making it impossible to drive',
          area: 'Vasundhara',
          lat: 28.66,
          lng: 77.36,
        }),
      });

      expect(res.status).toBe(201);
      const created = (await res.json()) as Record<string, unknown>;
      expect(created['trackingCode']).toBeDefined();
    });
  });
});
