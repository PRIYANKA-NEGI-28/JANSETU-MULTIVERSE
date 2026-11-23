import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types/index.js';
import { getComplaintStore } from '../services/complaint-store.js';
import {
  serializeCluster,
  serializeClusterList,
} from '../serializers/cluster.js';
import { requireRole, requireWardOrDeptScope } from '../middleware/auth.js';
import { HttpError } from '../middleware/error-handler.js';
import { ComplaintStatusSchema, type ComplaintStatus } from '@jansetu/shared';
import { createCacheService } from '../services/cache.js';

export const clustersRoute = new Hono<AppEnv>();

clustersRoute.get('/:id/timeline', async (c) => {
  const store = getComplaintStore();
  const clusterId = c.req.param('id');

  const cluster = await store.findClusterById(clusterId, c.get('env'));
  if (!cluster) {
    throw new HttpError(404, 'Not Found', `Cluster '${clusterId}' not found`);
  }

  const events = await store.getClusterTimeline(clusterId);
  return c.json({ clusterId, events }, 200);
});

clustersRoute.get('/:id', async (c) => {
  const store = getComplaintStore();
  const clusterId = c.req.param('id');

  const cluster = await store.findClusterById(clusterId, c.get('env'));
  if (!cluster) {
    throw new HttpError(404, 'Not Found', `Cluster '${clusterId}' not found`);
  }

  return c.json(serializeCluster(cluster, c.get('user')), 200);
});

const AssignClusterPayloadSchema = z.object({
  officerId: z.string().trim().min(1, 'officerId is required'),
  notes: z.string().trim().optional(),
});

clustersRoute.patch(
  '/:id/assign',
  requireRole('ward_officer', 'dept_head', 'admin'),
  requireWardOrDeptScope(async (c) => {
    const clusterId = c.req.param('id');
    if (!clusterId) {
      return {};
    }
    const store = getComplaintStore();
    const cluster = await store.findClusterById(clusterId, c.get('env'));
    return {
      wardId: cluster?.wardId,
      departmentId: cluster?.departmentId,
    };
  }),
  async (c) => {
    const store = getComplaintStore();
    const user = c.get('user');
    const clusterId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const validated = AssignClusterPayloadSchema.parse(body);

    const updated = await store.assignCluster(
      clusterId,
      validated.officerId,
      validated.notes,
      user?.id,
      user?.role ?? 'admin',
      c.get('env')
    );

    const serialized = serializeCluster(updated, user);
    return c.json(serialized, 200);
  }
);

const UpdateClusterStatusPayloadSchema = z.object({
  status: ComplaintStatusSchema,
  notes: z.string().trim().optional(),
});

clustersRoute.patch(
  '/:id/status',
  requireRole('ward_officer', 'dept_head', 'admin'),
  requireWardOrDeptScope(async (c) => {
    const clusterId = c.req.param('id');
    if (!clusterId) {
      return {};
    }
    const store = getComplaintStore();
    const cluster = await store.findClusterById(clusterId, c.get('env'));
    return {
      wardId: cluster?.wardId,
      departmentId: cluster?.departmentId,
    };
  }),
  async (c) => {
    const store = getComplaintStore();
    const user = c.get('user');
    const clusterId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const validated = UpdateClusterStatusPayloadSchema.parse(body);

    const updated = await store.updateClusterStatus(
      clusterId,
      validated.status,
      validated.notes,
      user?.id,
      user?.role ?? 'admin',
      c.get('env')
    );

    const serialized = serializeCluster(updated, user);
    return c.json(serialized, 200);
  }
);

export const mapClustersRoute = new Hono<AppEnv>();

mapClustersRoute.get('/', async (c) => {
  const env = c.get('env');
  const user = c.get('user');
  const cache = createCacheService(env);
  const store = getComplaintStore();

  const minLat = Number(c.req.query('minLat') ?? '-90');
  const minLng = Number(c.req.query('minLng') ?? '-180');
  const maxLat = Number(c.req.query('maxLat') ?? '90');
  const maxLng = Number(c.req.query('maxLng') ?? '180');
  const status = c.req.query('status') as ComplaintStatus | undefined;
  const departmentId = c.req.query('departmentId');
  const isFresh = c.req.query('fresh') === 'true' || c.req.header('Cache-Control') === 'no-cache';

  const cacheKey = `map:clusters:${minLat.toFixed(2)}:${minLng.toFixed(2)}:${maxLat.toFixed(2)}:${maxLng.toFixed(2)}:${status ?? 'all'}:${departmentId ?? 'all'}`;

  if (!isFresh) {
    const cached = await cache.get<unknown[]>(cacheKey);
    if (cached) {
      c.header('X-Cache', 'HIT');
      return c.json({ data: cached }, 200);
    }
  }

  const clusters = await store.queryClustersByBoundingBox(
    {
      minLat,
      minLng,
      maxLat,
      maxLng,
      status,
      departmentId,
    },
    env
  );

  const serialized = serializeClusterList(clusters, user);
  await cache.set(cacheKey, serialized, 60); // 60s TTL

  c.header('X-Cache', 'MISS');
  return c.json({ data: serialized }, 200);
});
