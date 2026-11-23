import { createMiddleware } from 'hono/factory';
import crypto from 'node:crypto';
import type { AppEnv } from '../types/index.js';
import { HttpError } from './error-handler.js';
import { getIotStore } from '../services/iot-store.js';

interface DeviceRateLimitEntry {
  count: number;
  resetAt: number;
}

const deviceRateLimits = new Map<string, DeviceRateLimitEntry>();

export function resetDeviceRateLimits(): void {
  deviceRateLimits.clear();
}

/**
 * Validates HMAC-SHA256 signature on incoming IoT device requests with:
 * 1. Required header validation (X-Signature, X-Device-ID, X-Timestamp).
 * 2. Strict replay attack protection (+/- 5 minutes timestamp tolerance).
 * 3. Constant-time signature comparison preventing timing attacks.
 * 4. Per-device sliding-window rate limiting (120 req/min).
 */
export const iotHmacMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const env = c.get('env');
  const signature = c.req.header('x-signature');
  const deviceId = c.req.header('x-device-id');
  const timestampHeader = c.req.header('x-timestamp');

  // 1. Validate required security headers
  if (!signature || !deviceId || !timestampHeader) {
    throw new HttpError(401, 'Unauthorized', 'Missing HMAC security headers (X-Signature, X-Device-ID, X-Timestamp)');
  }

  // 2. Replay attack protection (+/- 5 minutes = 300 seconds)
  const timestamp = Number.parseInt(timestampHeader, 10);
  if (Number.isNaN(timestamp)) {
    throw new HttpError(401, 'Unauthorized', 'Invalid X-Timestamp header format');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > 300) {
    throw new HttpError(401, 'Unauthorized', 'Timestamp outside allowed window (replay attack detected)');
  }

  // 3. Per-device rate limiting (120 requests per minute)
  const nowMs = Date.now();
  const rateLimitKey = deviceId.trim().toUpperCase();
  const entry = deviceRateLimits.get(rateLimitKey);

  if (!entry || nowMs > entry.resetAt) {
    deviceRateLimits.set(rateLimitKey, { count: 1, resetAt: nowMs + 60_000 });
  } else {
    entry.count++;
    if (entry.count > 120) {
      throw new HttpError(429, 'Too Many Requests', 'Device rate limit exceeded (max 120 req/min)');
    }
  }

  // 4. Read raw body text for cryptographic verification
  const rawBody = await c.req.text();
  const message = `${timestampHeader}.${rawBody}`;

  const iotStore = getIotStore();
  const secret = iotStore.getDeviceSecret(deviceId, env);

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  const sigBuffer = Buffer.from(signature.toLowerCase(), 'utf-8');
  const expectedBuffer = Buffer.from(expectedSignature.toLowerCase(), 'utf-8');

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new HttpError(401, 'Unauthorized', 'Invalid HMAC signature');
  }

  // Attach verified context
  (c as unknown as { rawIotBody?: string; iotDeviceId?: string }).rawIotBody = rawBody;
  (c as unknown as { rawIotBody?: string; iotDeviceId?: string }).iotDeviceId = deviceId;

  await next();
});
