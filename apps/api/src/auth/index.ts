import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins/bearer';
import { expo } from '@better-auth/expo';
import { users, sessions, accounts, verifications, type AppDatabase, getDatabase } from '@jansetu/db';
import type { ValidatedEnv } from '../config/env.js';
import type { AuthContext, AuthUser } from '../types/index.js';
import type { Role } from '@jansetu/shared';

export interface BetterAuthConfigurationOptions {
  readonly env: ValidatedEnv;
  readonly db?: AppDatabase;
  readonly secret?: string;
  readonly baseURL?: string;
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;

export function createBetterAuth(options: BetterAuthConfigurationOptions) {
  const secret = options.secret ?? options.env.BETTER_AUTH_SECRET;
  const baseURL = options.baseURL ?? options.env.BETTER_AUTH_URL;

  let db = options.db;
  if (!db && options.env.DATABASE_URL) {
    try {
      db = getDatabase(options.env.DATABASE_URL);
    } catch {
      // In tests/dev without live DB, Drizzle adapter is skipped safely
    }
  }

  return betterAuth({
    secret,
    baseURL,
    ...(db
      ? {
          database: drizzleAdapter(db, {
            provider: 'pg',
            schema: {
              user: users,
              session: sessions,
              account: accounts,
              verification: verifications,
            },
          }),
        }
      : {}),
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: 'citizen',
          input: true,
        },
        phone: {
          type: 'string',
          required: false,
          input: true,
        },
        departmentId: {
          type: 'string',
          required: false,
          input: true,
        },
        wardId: {
          type: 'string',
          required: false,
          input: true,
        },
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      bearer(),
      expo(),
    ],
  });
}

let cachedAuthInstance: BetterAuthInstance | null = null;

export function getAuthInstance(env: ValidatedEnv): BetterAuthInstance {
  if (cachedAuthInstance) {
    return cachedAuthInstance;
  }
  cachedAuthInstance = createBetterAuth({ env });
  return cachedAuthInstance;
}

export function resetAuthInstance(): void {
  cachedAuthInstance = null;
}

export async function resolveSession(
  req: Request,
  authInstance: BetterAuthInstance,
  env?: ValidatedEnv
): Promise<AuthContext | null> {
  // Test hook: Allows deterministic injection of session context during unit/integration tests
  if (env?.NODE_ENV === 'test' || process.env.NODE_ENV === 'test') {
    const testUserHeader = req.headers.get('x-test-user');
    if (testUserHeader) {
      try {
        const parsed = JSON.parse(testUserHeader) as Partial<AuthUser>;
        const user: AuthUser = {
          id: parsed.id ?? 'test-user-id',
          name: parsed.name ?? 'Test User',
          email: parsed.email ?? 'test@example.com',
          role: (parsed.role as Role) ?? 'citizen',
          wardId: parsed.wardId ?? null,
          departmentId: parsed.departmentId ?? null,
          phone: parsed.phone ?? null,
          image: parsed.image ?? null,
        };
        return {
          user,
          session: {
            id: 'test-session-id',
            userId: user.id,
            token: 'test-session-token',
            expiresAt: new Date(Date.now() + 86400000),
          },
        };
      } catch {
        return null;
      }
    }
  }

  try {
    const result = await authInstance.api.getSession({
      headers: req.headers,
    });

    if (!result || !result.user || !result.session) {
      return null;
    }

    const user: AuthUser = {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: (result.user.role as Role) || 'citizen',
      wardId: (result.user.wardId as string | null) ?? null,
      departmentId: (result.user.departmentId as string | null) ?? null,
      phone: (result.user.phone as string | null) ?? null,
      image: result.user.image ?? null,
    };

    return {
      user,
      session: {
        id: result.session.id,
        userId: result.session.userId,
        token: result.session.token,
        expiresAt: new Date(result.session.expiresAt),
      },
    };
  } catch {
    return null;
  }
}
