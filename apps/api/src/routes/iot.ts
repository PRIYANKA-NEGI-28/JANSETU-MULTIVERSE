import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types/index.js';
import { iotHmacMiddleware } from '../middleware/iot-hmac.js';
import { getIotStore } from '../services/iot-store.js';
import { getComplaintStore } from '../services/complaint-store.js';
import { getRealtimeService } from '../services/realtime.js';

export const iotRoute = new Hono<AppEnv>();

// Apply HMAC verification middleware to all incoming IoT device requests
iotRoute.use('*', iotHmacMiddleware);

const IotEventBodySchema = z.object({
  device_id: z.string().trim().min(1, 'device_id is required'),
  status: z.enum(['FAULT', 'RESOLVED', 'NORMAL']),
  type: z.string().trim().default('STREETLIGHT'),
  idempotency_key: z.string().trim().min(1, 'idempotency_key is required'),
  seq: z.number().int().optional(),
  uptime_ms: z.number().int().optional(),
  ldr_raw: z.number().int().optional(),
  fault_duration_ms: z.number().int().optional(),
  timestamp: z.number().int().optional(),
});

const IotHeartbeatBodySchema = z.object({
  device_id: z.string().trim().min(1, 'device_id is required'),
  status: z.enum(['HEALTHY', 'DEGRADED', 'FAULT']).default('HEALTHY'),
  state: z.string().optional(),
  uptime_ms: z.number().int().optional(),
  ldr_raw: z.number().int().optional(),
  seq: z.number().int().optional(),
  timestamp: z.number().int().optional(),
});

// Helper to extract JSON from validated context
function parseRawBody<T>(c: unknown, schema: z.ZodSchema<T>): T {
  const rawBody = (c as unknown as { rawIotBody?: string }).rawIotBody;
  let parsed: unknown = {};
  if (rawBody && rawBody.trim().length > 0) {
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      // fallback
    }
  }
  return schema.parse(parsed);
}

// POST /api/v1/iot/events - Idempotent Telemetry & Fault / Clearance Processing
iotRoute.post('/events', async (c) => {
  const env = c.get('env');
  const validated = parseRawBody(c, IotEventBodySchema);
  const iotStore = getIotStore();
  const complaintStore = getComplaintStore();
  const realtime = getRealtimeService(env);

  const device = await iotStore.findDeviceByUid(validated.device_id, env);
  if (!device) {
    return c.json({ success: false, error: 'Device not found' }, 404);
  }

  // 1. Idempotency Check
  const isDuplicate = await iotStore.isIdempotencyKeyProcessed(validated.idempotency_key);
  if (isDuplicate) {
    return c.json(
      {
        success: true,
        duplicate: true,
        idempotency_key: validated.idempotency_key,
        message: 'Event already processed',
      },
      200
    );
  }

  // 2. Persist Telemetry Record
  const now = new Date();
  await iotStore.recordTelemetry(
    {
      id: `tel-${crypto.randomUUID()}`,
      deviceId: device.id,
      deviceUid: device.deviceUid,
      idempotencyKey: validated.idempotency_key,
      eventType: validated.status === 'FAULT' ? 'FAULT_CONFIRMED' : 'FAULT_CLEARED',
      status: validated.status,
      seq: validated.seq,
      uptimeMs: validated.uptime_ms,
      ldrRaw: validated.ldr_raw,
      faultDurationMs: validated.fault_duration_ms,
      payload: { ...validated },
      recordedAt: now,
    },
    env
  );

  // 3. State-Specific Actions
  if (validated.status === 'FAULT') {
    // Streetlight failure confirmed: create or link complaint cluster
    const complaint = await complaintStore.createComplaint(
      {
        idempotencyKey: validated.idempotency_key,
        citizenName: `JanSetu Edge Node (${device.deviceUid})`,
        category: 'Street Light',
        urgency: 'HIGH',
        departmentId: device.departmentId ?? 'dept-streetlights',
        wardId: device.wardId ?? 'ward-12',
        area: 'Indirapuram Sector 12',
        text: `Automated hardware sensor alert: Streetlight node ${device.deviceUid} confirmed persistent illumination failure (LDR ADC: ${validated.ldr_raw ?? 0}).`,
        lat: device.location.lat,
        lng: device.location.lng,
      },
      env
    );

    const clusterId = complaint.clusterId ?? complaint.id;
    await iotStore.updateDeviceStatus(device.deviceUid, 'FAULT', clusterId);

    // Publish Real-time Alerts via Ably
    const alertData = {
      deviceId: device.deviceUid,
      clusterId,
      complaintId: complaint.id,
      trackingCode: complaint.trackingCode,
      status: 'FAULT',
      seq: validated.seq,
      ldrRaw: validated.ldr_raw,
      timestamp: Date.now(),
    };

    await realtime.publish('admin:alerts', 'iot:fault', alertData);
    if (device.wardId) {
      await realtime.publish(`ward:${device.wardId}`, 'iot:fault', alertData);
    }

    return c.json(
      {
        success: true,
        event: 'FAULT_RECORDED',
        clusterId,
        deviceId: device.deviceUid,
        trackingCode: complaint.trackingCode,
      },
      201
    );
  }

  if (validated.status === 'RESOLVED' || validated.status === 'NORMAL') {
    // Streetlight repaired / daylight restored
    const activeClusterId = device.activeClusterId;
    await iotStore.updateDeviceStatus(device.deviceUid, 'NORMAL', null);

    if (activeClusterId) {
      // Resolve active cluster
      await complaintStore.updateClusterStatus(
        activeClusterId,
        'RESOLVED',
        'Streetlight fault resolved via hardware sensor restoration or technician repair',
        'system',
        'admin',
        env
      );

      // Audit Event
      await complaintStore.addAuditEvent(
        {
          complaintId: activeClusterId,
          eventType: 'IOT_CLEARED',
          actorRole: 'system',
          notes: `Streetlight node ${device.deviceUid} recovered to NORMAL. Fault automatically cleared.`,
          metadata: {
            deviceId: device.deviceUid,
            seq: validated.seq,
            ldrRaw: validated.ldr_raw,
          },
        },
        env
      );

      // Publish Real-time Alerts via Ably
      const resolveData = {
        deviceId: device.deviceUid,
        clusterId: activeClusterId,
        status: 'NORMAL',
        seq: validated.seq,
        timestamp: Date.now(),
      };

      await realtime.publish('admin:alerts', 'iot:resolved', resolveData);
      if (device.wardId) {
        await realtime.publish(`ward:${device.wardId}`, 'iot:resolved', resolveData);
      }
    }

    return c.json(
      {
        success: true,
        event: 'FAULT_CLEARED',
        deviceId: device.deviceUid,
        activeClusterIdResolved: activeClusterId ?? null,
      },
      200
    );
  }

  return c.json({ success: true, event: 'IGNORED', deviceId: device.deviceUid }, 200);
});

// Support legacy POST / (when mounted at /api/sensor)
iotRoute.post('/', async (c) => {
  // Delegate directly to the events handler logic
  const rawBody = (c as unknown as { rawIotBody?: string }).rawIotBody;
  let isHeartbeat = false;
  if (rawBody) {
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed.state && parsed.status === 'HEALTHY') {
        isHeartbeat = true;
      }
    } catch {
      // ignore
    }
  }

  if (isHeartbeat) {
    const validated = parseRawBody(c, IotHeartbeatBodySchema);
    const iotStore = getIotStore();
    const updated = await iotStore.updateHeartbeat(validated.device_id, validated.state);
    return c.json(
      {
        success: true,
        deviceId: validated.device_id,
        status: updated?.status ?? 'NORMAL',
        lastHeartbeatAt: updated?.lastHeartbeatAt?.toISOString() ?? new Date().toISOString(),
      },
      200
    );
  }

  // Handle as telemetry event
  return iotRoute.fetch(
    new Request(new URL('/events', c.req.url).toString(), {
      method: 'POST',
      headers: c.req.raw.headers,
      body: rawBody,
    }),
    c.env
  );
});

// POST /api/v1/iot/heartbeat - 5-Minute Heartbeat & OFFLINE Device Recovery
iotRoute.post('/heartbeat', async (c) => {
  const validated = parseRawBody(c, IotHeartbeatBodySchema);
  const iotStore = getIotStore();

  const updated = await iotStore.updateHeartbeat(validated.device_id, validated.state);
  return c.json(
    {
      success: true,
      deviceId: validated.device_id,
      status: updated?.status ?? 'NORMAL',
      lastHeartbeatAt: updated?.lastHeartbeatAt?.toISOString() ?? new Date().toISOString(),
    },
    200
  );
});
