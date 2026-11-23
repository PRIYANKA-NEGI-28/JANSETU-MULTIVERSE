import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types/index.js';
import { getQueueService } from '../services/queue.js';
import { HttpError } from '../middleware/error-handler.js';

export const jobsRoute = new Hono<AppEnv>();

const TriageJobBodySchema = z.object({
  complaintId: z.string().min(1, 'complaintId is required'),
  clusterId: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});

// Signature verification middleware for all internal job webhooks
jobsRoute.use('*', async (c, next) => {
  const env = c.get('env');
  const queueService = getQueueService(env);
  const signature = c.req.header('upstash-signature');
  const url = c.req.url;

  // Read raw body as text for cryptographic HMAC signature verification
  const rawBody = await c.req.text();
  const isValid = await queueService.verifyQStashSignature(signature, rawBody, url, env);

  if (!isValid) {
    throw new HttpError(401, 'Unauthorized', 'Invalid or missing QStash webhook signature');
  }

  // Attach raw body for handlers
  (c as unknown as { rawJobBody?: string }).rawJobBody = rawBody;
  await next();
});

// POST /api/v1/internal/jobs/triage - Asynchronous AI Triage and Vision Hazard Verification
jobsRoute.post('/triage', async (c) => {
  const env = c.get('env');
  const queueService = getQueueService(env);
  const rawBody = (c as unknown as { rawJobBody?: string }).rawJobBody;
  let rawData: unknown = {};
  if (rawBody && rawBody.trim().length > 0) {
    try {
      rawData = JSON.parse(rawBody);
    } catch {
      // ignore
    }
  } else {
    rawData = await c.req.json().catch(() => ({}));
  }
  const validated = TriageJobBodySchema.parse(rawData);

  const result = await queueService.executeTriage(validated, env);
  return c.json(result, 200);
});

// POST /api/v1/internal/jobs/sla-check - Scheduled SLA Escalation & Real-Time Alerts
jobsRoute.post('/sla-check', async (c) => {
  const env = c.get('env');
  const queueService = getQueueService(env);

  const result = await queueService.executeSlaCheck(env);
  return c.json(result, 200);
});

// POST /api/v1/internal/jobs/iot-watchdog - Scheduled 10-min Watchdog for Inactive Devices (>15m)
jobsRoute.post('/iot-watchdog', async (c) => {
  const env = c.get('env');
  const queueService = getQueueService(env);

  const result = await queueService.executeIotWatchdog(env);
  return c.json(result, 200);
});
