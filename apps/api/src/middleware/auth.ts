import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/index.js';
import type { Role } from '@jansetu/shared';
import { getAuthInstance, resolveSession } from '../auth/index.js';
import { HttpError } from './error-handler.js';

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  let authContext = c.get('auth');
  if (!authContext) {
    const env = c.get('env');
    const authInstance = getAuthInstance(env);
    authContext = (await resolveSession(c.req.raw, authInstance, env)) ?? undefined;
    if (authContext) {
      c.set('auth', authContext);
      c.set('user', authContext.user);
      c.set('session', authContext.session);
    }
  }

  if (!authContext || !authContext.user) {
    throw new HttpError(
      401,
      'Unauthorized',
      'Authentication required to access this resource',
      'https://jansetu.gov.in/errors/401'
    );
  }

  await next();
};

export function requireRole(...allowedRoles: readonly Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    let authContext = c.get('auth');
    if (!authContext) {
      const env = c.get('env');
      const authInstance = getAuthInstance(env);
      authContext = (await resolveSession(c.req.raw, authInstance, env)) ?? undefined;
      if (authContext) {
        c.set('auth', authContext);
        c.set('user', authContext.user);
        c.set('session', authContext.session);
      }
    }

    if (!authContext || !authContext.user) {
      throw new HttpError(
        401,
        'Unauthorized',
        'Authentication required to access this resource',
        'https://jansetu.gov.in/errors/401'
      );
    }

    const userRole = authContext.user.role;
    if (!allowedRoles.includes(userRole)) {
      throw new HttpError(
        403,
        'Forbidden',
        `Role '${userRole}' is not authorized to access this resource. Required: [${allowedRoles.join(', ')}]`,
        'https://jansetu.gov.in/errors/403'
      );
    }

    await next();
  };
}

export interface ScopeTarget {
  readonly wardId?: string | null;
  readonly departmentId?: string | null;
}

export type ScopeTargetResolver = (c: Context<AppEnv>) => Promise<ScopeTarget> | ScopeTarget;

export function requireWardOrDeptScope(resolver?: ScopeTargetResolver): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    let authContext = c.get('auth');
    if (!authContext) {
      const env = c.get('env');
      const authInstance = getAuthInstance(env);
      authContext = (await resolveSession(c.req.raw, authInstance, env)) ?? undefined;
      if (authContext) {
        c.set('auth', authContext);
        c.set('user', authContext.user);
        c.set('session', authContext.session);
      }
    }

    if (!authContext || !authContext.user) {
      throw new HttpError(
        401,
        'Unauthorized',
        'Authentication required to access this resource',
        'https://jansetu.gov.in/errors/401'
      );
    }

    const user = authContext.user;

    // Admin has unrestricted scope across all wards and departments
    if (user.role === 'admin') {
      return next();
    }

    // Resolve target ward and department
    let target: ScopeTarget = {};
    if (resolver) {
      target = await resolver(c);
    } else {
      const paramWardId =
        c.req.param('wardId') || c.req.query('wardId') || c.req.query('ward');
      const paramDeptId =
        c.req.param('departmentId') ||
        c.req.param('deptId') ||
        c.req.query('departmentId') ||
        c.req.query('deptId') ||
        c.req.query('dept');

      target = { wardId: paramWardId, departmentId: paramDeptId };
    }

    // Citizens cannot mutate municipal cluster scopes
    if (user.role === 'citizen') {
      throw new HttpError(
        403,
        'Forbidden',
        'Citizens are not authorized to mutate municipal cluster scopes',
        'https://jansetu.gov.in/errors/scope-violation'
      );
    }

    // Check Ward Officer scope
    if (user.role === 'ward_officer') {
      if (!user.wardId) {
        throw new HttpError(
          403,
          'Forbidden',
          'Ward officer has no ward assignment configured',
          'https://jansetu.gov.in/errors/scope-violation'
        );
      }
      if (target.wardId && target.wardId !== user.wardId) {
        throw new HttpError(
          403,
          'Forbidden',
          `Cross-ward mutation rejected: officer is assigned to '${user.wardId}' but attempted to access '${target.wardId}'`,
          'https://jansetu.gov.in/errors/scope-violation'
        );
      }
      if (target.departmentId && user.departmentId && target.departmentId !== user.departmentId) {
        throw new HttpError(
          403,
          'Forbidden',
          `Department scope violation: officer is assigned to '${user.departmentId}' but attempted to access '${target.departmentId}'`,
          'https://jansetu.gov.in/errors/scope-violation'
        );
      }
    }

    // Check Department Head scope
    if (user.role === 'dept_head') {
      if (!user.departmentId) {
        throw new HttpError(
          403,
          'Forbidden',
          'Department head has no department assignment configured',
          'https://jansetu.gov.in/errors/scope-violation'
        );
      }
      if (target.departmentId && target.departmentId !== user.departmentId) {
        throw new HttpError(
          403,
          'Forbidden',
          `Cross-department mutation rejected: head is assigned to '${user.departmentId}' but attempted to access '${target.departmentId}'`,
          'https://jansetu.gov.in/errors/scope-violation'
        );
      }
    }

    await next();
  };
}
