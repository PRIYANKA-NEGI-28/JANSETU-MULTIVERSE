import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/index.js';

export const securityHeadersMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");
};

export function parseAllowedOrigins(corsOriginConfig?: string): readonly string[] {
  if (!corsOriginConfig) {
    return ['http://localhost:5173', 'http://localhost:3000'];
  }
  return corsOriginConfig
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export const corsMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const env = c.get('env');
  const allowedOrigins = parseAllowedOrigins(env?.CORS_ORIGIN);
  const requestOrigin = c.req.header('origin');

  if (!requestOrigin) {
    if (c.req.method === 'OPTIONS') {
      return c.body(null, 204);
    }
    return next();
  }

  const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(requestOrigin);

  if (isAllowed) {
    c.header('Access-Control-Allow-Origin', requestOrigin);
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    c.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Request-ID, X-Idempotency-Key'
    );
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Max-Age', '86400');
    c.header('Vary', 'Origin');

    if (c.req.method === 'OPTIONS') {
      return c.body(null, 204);
    }
    return next();
  }

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 403);
  }

  return next();
};
