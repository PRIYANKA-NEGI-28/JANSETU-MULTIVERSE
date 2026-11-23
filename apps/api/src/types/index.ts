import type { ValidatedEnv } from '../config/env.js';
import type { Role } from '@jansetu/shared';

export interface Bindings {
  readonly NODE_ENV?: string;
  readonly PORT?: string;
  readonly LOG_LEVEL?: string;
  readonly CORS_ORIGIN?: string;
  readonly DATABASE_URL?: string;
  readonly UPSTASH_REDIS_REST_URL?: string;
  readonly UPSTASH_REDIS_REST_TOKEN?: string;
  readonly BETTER_AUTH_SECRET?: string;
  readonly BETTER_AUTH_URL?: string;
  readonly R2_ACCOUNT_ID?: string;
  readonly R2_ACCESS_KEY_ID?: string;
  readonly R2_SECRET_ACCESS_KEY?: string;
  readonly R2_BUCKET_NAME?: string;
  readonly R2_PUBLIC_URL?: string;
  readonly MEDIA_BUCKET?: R2Bucket;
  readonly GEMINI_API_KEY?: string;
  readonly GEMINI_MODEL?: string;
  readonly GROQ_API_KEY?: string;
  readonly GROQ_MODEL?: string;
  readonly GROQ_WHISPER_MODEL?: string;
  readonly SARVAM_API_KEY?: string;
  readonly AI_TIMEOUT_MS?: string;
  readonly QSTASH_TOKEN?: string;
  readonly QSTASH_CURRENT_SIGNING_KEY?: string;
  readonly QSTASH_NEXT_SIGNING_KEY?: string;
  readonly QSTASH_URL?: string;
  readonly APP_URL?: string;
  readonly ABLY_API_KEY?: string;
}

export interface AuthUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly wardId?: string | null;
  readonly departmentId?: string | null;
  readonly phone?: string | null;
  readonly image?: string | null;
}

export interface AuthSession {
  readonly id: string;
  readonly userId: string;
  readonly token: string;
  readonly expiresAt: Date;
}

export interface AuthContext {
  readonly user: AuthUser;
  readonly session: AuthSession;
}

export interface Variables {
  requestId: string;
  env: ValidatedEnv;
  startTime: number;
  auth?: AuthContext;
  user?: AuthUser;
  session?: AuthSession;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: Variables;
}

export interface RfcProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance: string;
  readonly requestId: string;
  readonly timestamp: string;
  readonly errors?: readonly Record<string, unknown>[];
  readonly stack?: string;
}
