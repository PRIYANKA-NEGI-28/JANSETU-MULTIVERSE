import { z } from 'zod';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/index.js';

export const DEFAULT_DEV_BETTER_AUTH_SECRET = 'jansetu-multiverse-development-secret-key-32chars';
export const DEFAULT_DEV_DEVICE_HMAC_SECRET = 'jansetu-iot-dev-secret';

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:3000'),
    DATABASE_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    BETTER_AUTH_SECRET: z.string().min(16).default(DEFAULT_DEV_BETTER_AUTH_SECRET),
    BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET_NAME: z.string().default('jansetu-media'),
    R2_PUBLIC_URL: z.string().url().optional(),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
    GROQ_API_KEY: z.string().optional(),
    GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
    GROQ_WHISPER_MODEL: z.string().default('whisper-large-v3-turbo'),
    SARVAM_API_KEY: z.string().optional(),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
    QSTASH_TOKEN: z.string().optional(),
    QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
    QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
    QSTASH_URL: z.string().url().default('https://qstash.upstash.io/v2'),
    APP_URL: z.string().url().default('http://localhost:3000'),
    ABLY_API_KEY: z.string().optional(),
    DEVICE_HMAC_SECRET: z.string().default(DEFAULT_DEV_DEVICE_HMAC_SECRET),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (!env.DATABASE_URL || env.DATABASE_URL.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DATABASE_URL'],
          message: 'DATABASE_URL is required and cannot be empty in production',
        });
      }

      if (
        !env.BETTER_AUTH_SECRET ||
        env.BETTER_AUTH_SECRET.length < 32 ||
        env.BETTER_AUTH_SECRET === DEFAULT_DEV_BETTER_AUTH_SECRET
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['BETTER_AUTH_SECRET'],
          message:
            'BETTER_AUTH_SECRET must be at least 32 characters and cannot use default dev secret in production',
        });
      }

      if (
        !env.DEVICE_HMAC_SECRET ||
        env.DEVICE_HMAC_SECRET === DEFAULT_DEV_DEVICE_HMAC_SECRET
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DEVICE_HMAC_SECRET'],
          message:
            'DEVICE_HMAC_SECRET cannot use default dev secret in production',
        });
      }

      if (
        !env.QSTASH_CURRENT_SIGNING_KEY ||
        env.QSTASH_CURRENT_SIGNING_KEY.trim().length === 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['QSTASH_CURRENT_SIGNING_KEY'],
          message:
            'QSTASH_CURRENT_SIGNING_KEY is required and cannot be empty in production',
        });
      }
    }
  });

export type ValidatedEnv = z.infer<typeof EnvSchema>;

let bootEnvCache: ValidatedEnv | null = null;

export function validateEnv(rawEnv: Record<string, unknown>): ValidatedEnv {
  const result = EnvSchema.safeParse(rawEnv);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Environment validation failed: ${issues}`);
  }
  return result.data;
}

export function getBootEnv(): ValidatedEnv {
  if (bootEnvCache) {
    return bootEnvCache;
  }
  const source = typeof process !== 'undefined' && process.env ? process.env : {};
  bootEnvCache = validateEnv(source as Record<string, unknown>);
  return bootEnvCache;
}

export function resetBootEnvCache(): void {
  bootEnvCache = null;
}

export const envMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const rawMerged: Record<string, unknown> = {
    ...(typeof process !== 'undefined' && process.env ? process.env : {}),
    ...(c.env ? (c.env as Record<string, unknown>) : {}),
  };
  const validated = validateEnv(rawMerged);
  c.set('env', validated);
  await next();
};
