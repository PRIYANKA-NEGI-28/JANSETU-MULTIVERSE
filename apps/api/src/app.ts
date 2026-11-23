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

  // Global Error & 404 Handlers
  app.notFound(notFoundHandler);
  app.onError(errorHandler);

  return app;
}

export const app = createApp();
