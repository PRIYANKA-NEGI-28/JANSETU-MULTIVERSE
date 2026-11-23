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
