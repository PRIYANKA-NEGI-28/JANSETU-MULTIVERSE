import { Hono } from 'hono';
import type { AppEnv } from '../types/index.js';

export const healthRoute = new Hono<AppEnv>();

export interface HealthResponse {
  readonly status: 'healthy';
  readonly timestamp: string;
  readonly version: string;
  readonly uptime: number;
}

const startTime = Date.now();

healthRoute.get('/health', (c) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  const response: HealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: uptimeSeconds,
  };

  return c.json(response, 200, {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  });
});
