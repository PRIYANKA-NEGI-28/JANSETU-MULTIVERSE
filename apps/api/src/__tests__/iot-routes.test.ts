import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import { createApp } from '../app.js';
import { getIotStore, resetIotStore } from '../services/iot-store.js';
import { getComplaintStore } from '../services/complaint-store.js';
import {
  getRealtimeService,
  resetRealtimeService,
} from '../services/realtime.js';
import {
  getQueueService,
  resetQueueService,
  setQueueService,
  QueueService,
} from '../services/queue.js';
import { resetDeviceRateLimits } from '../middleware/iot-hmac.js';
import { getInMemoryLimiter } from '../middleware/rate-limiter.js';

describe('IoT Device Telemetry & Edge Reliability Routes', () => {
  // Use high global rate limit so per-device 120 req/min rate limit can be tested without interference
  const app = createApp({ rateLimit: { limit: 1000 } });
  const iotStore = getIotStore();
  const complaintStore = getComplaintStore();
  const defaultSecret = 'jansetu-iot-dev-secret';

  function signPayload(body: unknown, deviceId = 'UNO_Q_01', timestamp?: number, secret = defaultSecret) {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    const message = `${ts}.${rawBody}`;
    const signature = crypto.createHmac('sha256', secret).update(message).digest('hex');

    return {
      headers: {
        'content-type': 'application/json',
        'x-device-id': deviceId,
        'x-timestamp': ts.toString(),
        'x-signature': signature,
      },
      rawBody,
    };
  }

  beforeEach(() => {
    resetIotStore();
    complaintStore.reset();
    resetRealtimeService();
    resetQueueService();
    resetDeviceRateLimits();
    getInMemoryLimiter().reset();
  });

  afterEach(() => {
    resetRealtimeService();
    resetQueueService();
    resetDeviceRateLimits();
    vi.restoreAllMocks();
  });

  describe('HMAC-SHA256 Security & Header Validation', () => {
    it('rejects requests missing security headers with 401 Unauthorized', async () => {
      const res = await app.request('/api/v1/iot/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ device_id: 'UNO_Q_01', status: 'FAULT', idempotency_key: 'test-1' }),
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as Record<string, unknown>;
      expect(json['title']).toBe('Unauthorized');
      expect(json['detail']).toContain('Missing HMAC security headers');
    });

    it('rejects requests with an invalid HMAC signature with 401 Unauthorized', async () => {
      const ts = Math.floor(Date.now() / 1000);
      const body = JSON.stringify({
        device_id: 'UNO_Q_01',
        status: 'FAULT',
        idempotency_key: 'test-bad-sig-1',
      });

      const res = await app.request('/api/v1/iot/events', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-device-id': 'UNO_Q_01',
          'x-timestamp': ts.toString(),
          'x-signature': '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        },
        body,
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as Record<string, unknown>;
      expect(json['title']).toBe('Unauthorized');
      expect(json['detail']).toContain('Invalid HMAC signature');
    });

    it('rejects replay attacks with timestamp older than 300 seconds', async () => {
      const staleTimestamp = Math.floor(Date.now() / 1000) - 301;
      const { headers, rawBody } = signPayload(
        { device_id: 'UNO_Q_01', status: 'FAULT', idempotency_key: 'replay-old' },
        'UNO_Q_01',
        staleTimestamp
      );

      const res = await app.request('/api/v1/iot/events', {
        method: 'POST',
        headers,
        body: rawBody,
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as Record<string, unknown>;
      expect(json['title']).toBe('Unauthorized');
      expect(json['detail']).toContain('replay attack');
    });

    it('rejects replay attacks with timestamp too far in the future (>300s)', async () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 305;
      const { headers, rawBody } = signPayload(
        { device_id: 'UNO_Q_01', status: 'FAULT', idempotency_key: 'replay-future' },
        'UNO_Q_01',
        futureTimestamp
      );

      const res = await app.request('/api/v1/iot/events', {
        method: 'POST',
        headers,
        body: rawBody,
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as Record<string, unknown>;
      expect(json['title']).toBe('Unauthorized');
      expect(json['detail']).toContain('replay attack');
    });

    it('enforces per-device rate limiting (max 120 req/min)', async () => {
      const payload = { device_id: 'UNO_Q_01', status: 'NORMAL', idempotency_key: 'rate-limit-test' };
      const { headers, rawBody } = signPayload(payload, 'UNO_Q_01');

      // Send 120 requests
      for (let i = 0; i < 120; i++) {
        const dummyPayload = {
          device_id: 'UNO_Q_01',
          status: 'NORMAL',
          idempotency_key: `rate-limit-${i}`,
        };
        const signed = signPayload(dummyPayload, 'UNO_Q_01');
        const res = await app.request('/api/v1/iot/events', {
          method: 'POST',
          headers: signed.headers,
          body: signed.rawBody,
        });
        expect(res.status).toBe(200);
      }

      // 121st request must trigger 429 Too Many Requests
      const res121 = await app.request('/api/v1/iot/events', {
        method: 'POST',
        headers,
        body: rawBody,
      });

      expect(res121.status).toBe(429);
      const json = (await res121.json()) as Record<string, unknown>;
      expect(json['title']).toBe('Too Many Requests');
      expect(json['detail']).toContain('Device rate limit exceeded');
    });
  });

  describe('POST /api/v1/iot/events - Telemetry, Cluster Creation & Deduplication', () => {
    it('creates complaint cluster and publishes real-time alert on FAULT_CONFIRMED', async () => {
      const payload = {
        device_id: 'UNO_Q_01',
        status: 'FAULT',
        type: 'STREETLIGHT',
        idempotency_key: 'UNO_Q_01:42:FAULT_CONFIRMED',
        seq: 42,
        uptime_ms: 125000,
        ldr_raw: 980,
        fault_duration_ms: 60000,
      };
      const { headers, rawBody } = signPayload(payload);

      const res = await app.request('/api/v1/iot/events', {
        method: 'POST',
        headers,
        body: rawBody,
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as {
        success: boolean;
        event: string;
        clusterId: string;
        deviceId: string;
        trackingCode: string;
      };

      expect(json.success).toBe(true);
      expect(json.event).toBe('FAULT_RECORDED');
      expect(json.deviceId).toBe('UNO_Q_01');
      expect(json.clusterId).toBeDefined();
      expect(json.trackingCode).toMatch(/^JS-\d{8}-\d{4}$/);

      // Verify device state in store is now FAULT
      const dev = await iotStore.findDeviceByUid('UNO_Q_01');
      expect(dev?.status).toBe('FAULT');
      expect(dev?.activeClusterId).toBe(json.clusterId);

      // Verify complaint was created
      const cluster = await complaintStore.findClusterById(json.clusterId);
      expect(cluster).toBeDefined();
      expect(cluster?.departmentId).toBe('dept-streetlights');
    });

    it('returns 200 with duplicate: true for idempotent replay of same key', async () => {
      const payload = {
        device_id: 'UNO_Q_01',
        status: 'FAULT',
        idempotency_key: 'UNO_Q_01:99:FAULT_CONFIRMED',
        seq: 99,
        uptime_ms: 200000,
        ldr_raw: 990,
      };
      const { headers, rawBody } = signPayload(payload);

      // First submission -> 201 Created
      const res1 = await app.request('/api/v1/iot/events', {
        method: 'POST',
        headers,
        body: rawBody,
      });
      expect(res1.status).toBe(201);

      // Second submission with exact same idempotency_key -> 200 duplicate
      const res2 = await app.request('/api/v1/iot/events', {
        method: 'POST',
        headers,
        body: rawBody,
      });
      expect(res2.status).toBe(200);
      const json2 = (await res2.json()) as {
        success: boolean;
        duplicate: boolean;
        idempotency_key: string;
        message: string;
      };
      expect(json2.success).toBe(true);
      expect(json2.duplicate).toBe(true);
      expect(json2.idempotency_key).toBe('UNO_Q_01:99:FAULT_CONFIRMED');
    });

    it('automatically resolves active cluster on FAULT_CLEARED / RESOLVED event', async () => {
      // 1. First trigger a FAULT
      const faultPayload = {
        device_id: 'UNO_Q_01',
        status: 'FAULT',
        idempotency_key: 'UNO_Q_01:101:FAULT_CONFIRMED',
        seq: 101,
        ldr_raw: 950,
      };
      const signedFault = signPayload(faultPayload);
      const faultRes = await app.request('/api/v1/iot/events', {
        method: 'POST',
        headers: signedFault.headers,
        body: signedFault.rawBody,
      });
      expect(faultRes.status).toBe(201);
      const faultJson = (await faultRes.json()) as { clusterId: string };
      const clusterId = faultJson.clusterId;

      // 2. Now submit FAULT_CLEARED (RESOLVED status)
      const clearPayload = {
        device_id: 'UNO_Q_01',
        status: 'RESOLVED',
        idempotency_key: 'UNO_Q_01:102:FAULT_CLEARED',
        seq: 102,
        ldr_raw: 220,
      };
      const signedClear = signPayload(clearPayload);
      const clearRes = await app.request('/api/v1/iot/events', {
        method: 'POST',
        headers: signedClear.headers,
        body: signedClear.rawBody,
      });

      expect(clearRes.status).toBe(200);
      const clearJson = (await clearRes.json()) as {
        success: boolean;
        event: string;
        deviceId: string;
        activeClusterIdResolved: string;
      };
      expect(clearJson.success).toBe(true);
      expect(clearJson.event).toBe('FAULT_CLEARED');
      expect(clearJson.activeClusterIdResolved).toBe(clusterId);

      // Verify cluster status in store is updated to RESOLVED
      const cluster = await complaintStore.findClusterById(clusterId);
      expect(cluster?.status).toBe('RESOLVED');

      // Verify audit event IOT_CLEARED exists
      const timeline = await complaintStore.getClusterTimeline(clusterId);
      const clearedAudit = timeline.find((a) => a.eventType === 'IOT_CLEARED');
      expect(clearedAudit).toBeDefined();
      expect(clearedAudit?.actorRole).toBe('system');
      expect(clearedAudit?.notes).toContain('Fault automatically cleared');

      // Verify device status returned to NORMAL and activeClusterId cleared
      const dev = await iotStore.findDeviceByUid('UNO_Q_01');
      expect(dev?.status).toBe('NORMAL');
      expect(dev?.activeClusterId).toBeNull();
    });
  });

  describe('POST /api/v1/iot/heartbeat & Legacy Compatibility', () => {
    it('updates lastHeartbeatAt and recovers OFFLINE device to NORMAL', async () => {
      // Mark device offline first
      await iotStore.markDeviceOffline('UNO_Q_02');
      let dev = await iotStore.findDeviceByUid('UNO_Q_02');
      expect(dev?.status).toBe('OFFLINE');

      const heartbeatPayload = {
        device_id: 'UNO_Q_02',
        status: 'HEALTHY',
        state: 'NORMAL',
        uptime_ms: 300000,
        ldr_raw: 150,
        seq: 15,
      };
      const { headers, rawBody } = signPayload(heartbeatPayload, 'UNO_Q_02');

      const res = await app.request('/api/v1/iot/heartbeat', {
        method: 'POST',
        headers,
        body: rawBody,
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        deviceId: string;
        status: string;
        lastHeartbeatAt: string;
      };
      expect(json.success).toBe(true);
      expect(json.deviceId).toBe('UNO_Q_02');
      expect(json.status).toBe('NORMAL');

      dev = await iotStore.findDeviceByUid('UNO_Q_02');
      expect(dev?.status).toBe('NORMAL');
    });

    it('supports legacy POST /api/sensor mounting for heartbeat and telemetry', async () => {
      // Test legacy heartbeat
      const hb = {
        device_id: 'UNO_Q_01',
        status: 'HEALTHY',
        state: 'NORMAL',
        uptime_ms: 450000,
      };
      const signedHb = signPayload(hb, 'UNO_Q_01');
      const hbRes = await app.request('/api/sensor', {
        method: 'POST',
        headers: signedHb.headers,
        body: signedHb.rawBody,
      });
      expect(hbRes.status).toBe(200);
      const hbJson = (await hbRes.json()) as { success: boolean; deviceId: string };
      expect(hbJson.success).toBe(true);
      expect(hbJson.deviceId).toBe('UNO_Q_01');
    });
  });

  describe('Scheduled IoT Watchdog Cron & Dead Node Escalation', () => {
    it('detects devices with missed heartbeats (>15m) and triggers offline alert cluster', async () => {
      // Mock QueueService to approve QStash signature
      const mockReceiver = new QueueService();
      vi.spyOn(mockReceiver, 'verifyQStashSignature').mockResolvedValue(true);
      setQueueService(mockReceiver);

      // Simulate UNO_Q_01 with a heartbeat 20 minutes ago
      const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
      iotStore.setDeviceHeartbeatTime('UNO_Q_01', twentyMinsAgo);

      // Execute watchdog via internal job endpoint
      const res = await app.request('/api/v1/internal/jobs/iot-watchdog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'upstash-signature': 'mock-valid-qstash-sig',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        checkedCount: number;
        offlineCount: number;
        devices: string[];
      };

      expect(json.success).toBe(true);
      expect(json.offlineCount).toBeGreaterThanOrEqual(1);
      expect(json.devices).toContain('UNO_Q_01');

      // Verify UNO_Q_01 is now marked OFFLINE
      const updatedDev = await iotStore.findDeviceByUid('UNO_Q_01');
      expect(updatedDev?.status).toBe('OFFLINE');

      // Verify alert complaint cluster was created
      const { items: complaints } = await complaintStore.queryComplaints({});
      const offlineAlert = complaints.find(
        (c) => c.description.includes('UNO_Q_01') && c.description.includes('missed consecutive heartbeats')
      );
      expect(offlineAlert).toBeDefined();
      expect(offlineAlert?.urgency).toBe('HIGH');
    });
  });
});
