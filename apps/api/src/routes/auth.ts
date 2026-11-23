import { Hono } from 'hono';
import type { AppEnv } from '../types/index.js';
import { getAuthInstance } from '../auth/index.js';

export const authRoute = new Hono<AppEnv>();

authRoute.on(['POST', 'GET'], '/*', (c) => {
  const env = c.get('env');
  const auth = getAuthInstance(env);
  return auth.handler(c.req.raw);
});
