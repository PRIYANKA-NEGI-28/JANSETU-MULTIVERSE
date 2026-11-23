import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { requireAuth, requireRole, requireWardOrDeptScope } from '../middleware/auth.js';
import { errorHandler } from '../middleware/error-handler.js';
import { envMiddleware } from '../config/env.js';
import type { AppEnv, AuthUser, RfcProblemDetails } from '../types/index.js';

describe('Auth & RBAC Middleware', () => {
  let app: Hono<AppEnv>;

  beforeEach(() => {
    app = new Hono<AppEnv>();
    app.use('*', envMiddleware);

    // Protected routes for testing
    app.get('/test/protected', requireAuth, (c) => {
      const user = c.get('user');
      return c.json({ message: 'Authenticated access granted', user });
    });

    app.get('/test/ward-officer', requireRole('ward_officer', 'dept_head', 'admin'), (c) => {
      const user = c.get('user');
      return c.json({ message: 'Ward officer access granted', user });
    });

    app.get('/test/admin-only', requireRole('admin'), (c) => {
      return c.json({ message: 'Admin access granted' });
    });

    app.patch('/test/clusters/:wardId', requireWardOrDeptScope(), (c) => {
      const wardId = c.req.param('wardId');
      return c.json({ message: `Cluster in ward ${wardId} updated` });
    });

    app.patch('/test/dept-clusters', requireWardOrDeptScope(), (c) => {
      return c.json({ message: 'Department cluster updated' });
    });

    app.onError(errorHandler);
  });

  const createAuthHeaders = (user: Partial<AuthUser>) => ({
    'x-test-user': JSON.stringify(user),
  });

  describe('requireAuth', () => {
    it('rejects unauthenticated request with 401 Problem Details', async () => {
      const res = await app.request('/test/protected');

      expect(res.status).toBe(401);
      expect(res.headers.get('content-type')).toContain('application/problem+json');

      const body = (await res.json()) as RfcProblemDetails;
      expect(body.status).toBe(401);
      expect(body.title).toBe('Unauthorized');
      expect(body.detail).toContain('Authentication required');
      expect(body.type).toBe('https://jansetu.gov.in/errors/401');
    });

    it('allows authenticated user with valid session context', async () => {
      const citizenUser: Partial<AuthUser> = {
        id: 'user-citizen-01',
        name: 'Pooja Sharma',
        email: 'pooja.sharma@example.com',
        role: 'citizen',
        wardId: 'ward-12',
      };

      const res = await app.request('/test/protected', {
        headers: createAuthHeaders(citizenUser),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { message: string; user: AuthUser };
      expect(body.message).toBe('Authenticated access granted');
      expect(body.user.id).toBe('user-citizen-01');
      expect(body.user.role).toBe('citizen');
    });
  });

  describe('requireRole', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await app.request('/test/ward-officer');
      expect(res.status).toBe(401);
    });

    it('rejects citizen trying to access ward officer route with 403 Forbidden', async () => {
      const citizenUser: Partial<AuthUser> = {
        id: 'user-citizen-01',
        role: 'citizen',
      };

      const res = await app.request('/test/ward-officer', {
        headers: createAuthHeaders(citizenUser),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as RfcProblemDetails;
      expect(body.status).toBe(403);
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toContain("Role 'citizen' is not authorized");
      expect(body.type).toBe('https://jansetu.gov.in/errors/403');
    });

    it('allows ward officer to access ward officer route', async () => {
      const officerUser: Partial<AuthUser> = {
        id: 'officer-01',
        role: 'ward_officer',
        wardId: 'ward-04',
      };

      const res = await app.request('/test/ward-officer', {
        headers: createAuthHeaders(officerUser),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { message: string };
      expect(body.message).toBe('Ward officer access granted');
    });

    it('rejects ward officer trying to access admin-only route with 403', async () => {
      const officerUser: Partial<AuthUser> = {
        id: 'officer-01',
        role: 'ward_officer',
        wardId: 'ward-04',
      };

      const res = await app.request('/test/admin-only', {
        headers: createAuthHeaders(officerUser),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as RfcProblemDetails;
      expect(body.detail).toContain("Role 'ward_officer' is not authorized");
    });

    it('allows admin to access admin-only route', async () => {
      const adminUser: Partial<AuthUser> = {
        id: 'admin-01',
        role: 'admin',
      };

      const res = await app.request('/test/admin-only', {
        headers: createAuthHeaders(adminUser),
      });

      expect(res.status).toBe(200);
    });
  });

  describe('requireWardOrDeptScope', () => {
    it('allows ward officer to mutate cluster in their assigned ward', async () => {
      const officerUser: Partial<AuthUser> = {
        id: 'officer-ward04',
        role: 'ward_officer',
        wardId: 'ward-04',
      };

      const res = await app.request('/test/clusters/ward-04', {
        method: 'PATCH',
        headers: createAuthHeaders(officerUser),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { message: string };
      expect(body.message).toContain('ward-04');
    });

    it('rejects ward officer attempting cross-ward mutation with 403 Forbidden', async () => {
      const officerUser: Partial<AuthUser> = {
        id: 'officer-ward04',
        role: 'ward_officer',
        wardId: 'ward-04',
      };

      // Officer assigned to ward-04 attempts to mutate ward-12
      const res = await app.request('/test/clusters/ward-12', {
        method: 'PATCH',
        headers: createAuthHeaders(officerUser),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as RfcProblemDetails;
      expect(body.status).toBe(403);
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toContain("Cross-ward mutation rejected: officer is assigned to 'ward-04' but attempted to access 'ward-12'");
    });

    it('rejects department head attempting cross-department mutation with 403 Forbidden', async () => {
      const deptHeadUser: Partial<AuthUser> = {
        id: 'head-electrical',
        role: 'dept_head',
        departmentId: 'dept-elec',
      };

      // Dept head of electrical attempts to access sanitation cluster
      const res = await app.request('/test/dept-clusters?deptId=dept-san', {
        method: 'PATCH',
        headers: createAuthHeaders(deptHeadUser),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as RfcProblemDetails;
      expect(body.detail).toContain("Cross-department mutation rejected: head is assigned to 'dept-elec' but attempted to access 'dept-san'");
    });

    it('allows department head to mutate resource in their assigned department', async () => {
      const deptHeadUser: Partial<AuthUser> = {
        id: 'head-electrical',
        role: 'dept_head',
        departmentId: 'dept-elec',
      };

      const res = await app.request('/test/dept-clusters?deptId=dept-elec', {
        method: 'PATCH',
        headers: createAuthHeaders(deptHeadUser),
      });

      expect(res.status).toBe(200);
    });

    it('allows admin unrestricted access across all wards and departments', async () => {
      const adminUser: Partial<AuthUser> = {
        id: 'admin-01',
        role: 'admin',
      };

      const resWard = await app.request('/test/clusters/any-ward-99', {
        method: 'PATCH',
        headers: createAuthHeaders(adminUser),
      });
      expect(resWard.status).toBe(200);

      const resDept = await app.request('/test/dept-clusters?deptId=any-dept-88', {
        method: 'PATCH',
        headers: createAuthHeaders(adminUser),
      });
      expect(resDept.status).toBe(200);
    });

    it('rejects citizens attempting to mutate cluster scopes with 403', async () => {
      const citizenUser: Partial<AuthUser> = {
        id: 'citizen-01',
        role: 'citizen',
        wardId: 'ward-04',
      };

      const res = await app.request('/test/clusters/ward-04', {
        method: 'PATCH',
        headers: createAuthHeaders(citizenUser),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as RfcProblemDetails;
      expect(body.detail).toContain('Citizens are not authorized to mutate municipal cluster scopes');
    });
  });
});
