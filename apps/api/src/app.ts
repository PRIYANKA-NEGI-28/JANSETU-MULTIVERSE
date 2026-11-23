import { Hono } from 'hono';
import type { AppEnv } from './types/index.js';
import { envMiddleware } from './config/env.js';
import { securityHeadersMiddleware, corsMiddleware } from './middleware/cors.js';
import { loggerMiddleware } from './middleware/logger.js';
import { createRateLimiterMiddleware, type RateLimitOptions } from './middleware/rate-limiter.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { healthRoute } from './routes/health.js';
import { metaRoute } from './routes/meta.js';
import { authRoute } from './routes/auth.js';
import { complaintsRoute } from './routes/complaints.js';
import { clustersRoute, mapClustersRoute } from './routes/clusters.js';
import { adminRoute } from './routes/admin.js';
import { geoRoute } from './routes/geo.js';
import { mediaRoute } from './routes/media.js';
import { rtiRoute } from './routes/rti.js';
import { aiRoute } from './routes/ai.js';
import { jobsRoute } from './routes/jobs.js';
import { realtimeRoute } from './routes/realtime.js';

export interface AppOptions {
  readonly rateLimit?: RateLimitOptions;
}

export function createApp(options: AppOptions = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // Foundational Middlewares
  app.use('*', envMiddleware);
  app.use('*', securityHeadersMiddleware);
  app.use('*', corsMiddleware);
  app.use('*', loggerMiddleware);
  app.use('*', createRateLimiterMiddleware(options.rateLimit));

  // Routes
  app.route('/', healthRoute);
  app.route('/api/auth', authRoute);
  app.route('/api/v1', metaRoute);
  app.route('/api/v1/complaints', complaintsRoute);
  app.route('/api/v1/clusters', clustersRoute);
  app.route('/api/v1/map/clusters', mapClustersRoute);
  app.route('/api/v1/admin', adminRoute);
  app.route('/api/v1/geo', geoRoute);
  app.route('/api/v1/media', mediaRoute);
  app.route('/api/v1/rti', rtiRoute);
  app.route('/api/v1/ai', aiRoute);
  app.route('/api/v1/internal/jobs', jobsRoute);
  app.route('/api/v1/realtime', realtimeRoute);

  // Global Error & 404 Handlers
  app.notFound(notFoundHandler);
  app.onError(errorHandler);

  return app;
}

export const app = createApp();
