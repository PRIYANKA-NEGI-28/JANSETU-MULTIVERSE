import { app, createApp } from './app.js';
import { getBootEnv, type ValidatedEnv } from './config/env.js';
import { getQueueService } from './services/queue.js';

// Strict environment validation on boot
getBootEnv();

export { app, createApp };

export default {
  fetch: (request: Request, env: Record<string, unknown>, ctx: ExecutionContext) =>
    app.fetch(request, env, ctx),
  async scheduled(
    _event: { cron: string; scheduledTime: number },
    env: Record<string, unknown>,
    _ctx: ExecutionContext
  ): Promise<void> {
    const queue = getQueueService(env as unknown as ValidatedEnv);
    await Promise.allSettled([
      queue.executeSlaCheck(env as unknown as ValidatedEnv),
      queue.executeIotWatchdog(env as unknown as ValidatedEnv),
    ]);
  },
};
