import { Hono } from 'hono';
import type { AppEnv } from '../types/index.js';
import { requireAuth } from '../middleware/auth.js';
import { getRealtimeService } from '../services/realtime.js';

export const realtimeRoute = new Hono<AppEnv>();

// GET /api/v1/realtime/token - Issue short-lived capability-scoped Ably tokens
realtimeRoute.get('/token', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const trackingCode = c.req.query('trackingCode') || undefined;
  const env = c.get('env');
  const realtime = getRealtimeService(env);

  const result = await realtime.createTokenRequest(user, trackingCode, env);

  return c.json(result, 200);
});
