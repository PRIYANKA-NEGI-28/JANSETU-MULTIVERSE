import { Hono } from 'hono';
import type { AppEnv } from '../types/index.js';
import { getComplaintStore } from '../services/complaint-store.js';

export const adminRoute = new Hono<AppEnv>();

adminRoute.get('/analytics', async (c) => {
  const store = getComplaintStore();
  const analytics = await store.getAnalytics();
  return c.json(analytics, 200);
});

adminRoute.get('/sla-breaches', async (c) => {
  const store = getComplaintStore();
  const breaches = await store.getSlaBreaches();
  return c.json({ count: breaches.length, breaches }, 200);
});
