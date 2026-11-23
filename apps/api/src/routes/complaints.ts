import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types/index.js';
import { getComplaintStore } from '../services/complaint-store.js';
import {
  serializeComplaint,
  serializeComplaintList,
} from '../serializers/complaint.js';
import { HttpError } from '../middleware/error-handler.js';
import {
  ComplaintCategorySchema,
  UrgencyLevelSchema,
  ComplaintStatusSchema,
  type ComplaintCategory,
  type UrgencyLevel,
  type ComplaintStatus,
} from '@jansetu/shared';

export const complaintsRoute = new Hono<AppEnv>();

const CreateComplaintPayloadSchema = z.object({
  idempotency_key: z.string().trim().optional(),
  name: z.string().trim().min(1, 'Name is required').max(100).default('Anonymous'),
  phone: z.string().trim().optional().nullable(),
  text: z.string().trim().min(5, 'Complaint text must be at least 5 characters').max(2000),
  area: z.string().trim().min(1, 'Area is required').default('Delhi NCR'),
  ward: z.string().trim().optional(),
  wardId: z.string().trim().optional(),
  city: z.string().trim().default('Delhi NCR'),
  category: ComplaintCategorySchema.optional(),
  issue_type: ComplaintCategorySchema.optional(),
  urgency: UrgencyLevelSchema.default('MEDIUM'),
  department: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  summary: z.string().trim().max(500).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  photo_url: z.string().url().optional().nullable(),
  language: z.enum(['en', 'hi']).default('en'),
});

complaintsRoute.post('/', async (c) => {
  const env = c.get('env');
  const user = c.get('user');
  const store = getComplaintStore();

  const rawBody = await c.req.json().catch(() => ({}));
  const validated = CreateComplaintPayloadSchema.parse(rawBody);

  const idempotencyKey =
    c.req.header('x-idempotency-key') ||
    validated.idempotency_key ||
    crypto.randomUUID();

  // Check if idempotency key already exists
  const existing = await store.findComplaintByIdempotencyKey(idempotencyKey, env);
  if (existing) {
    c.header('X-Idempotency-Hit', 'true');
    const serialized = serializeComplaint(existing, user);
    return c.json(serialized, 200);
  }

  const category: ComplaintCategory =
    validated.category ?? validated.issue_type ?? 'General Complaint';
  const urgency: UrgencyLevel = validated.urgency;
  const lat = validated.lat ?? validated.latitude ?? 28.6139;
  const lng = validated.lng ?? validated.longitude ?? 77.209;
  const wardId = validated.wardId ?? validated.ward ?? 'ward-04';
  const departmentId = validated.departmentId ?? 'dept-elec';

  const created = await store.createComplaint(
    {
      idempotencyKey,
      citizenId: user?.id ?? null,
      citizenName: validated.name,
      citizenPhone: validated.phone ?? null,
      citizenEmail: user?.email ?? null,
      category,
      urgency,
      departmentId,
      departmentName: validated.department,
      wardId,
      area: validated.area,
      text: validated.text,
      summary: validated.summary,
      language: validated.language,
      lat,
      lng,
      photoUrl: validated.photo_url ?? null,
    },
    env
  );

  const serialized = serializeComplaint(created, user);
  return c.json(serialized, 201);
});

complaintsRoute.get('/', async (c) => {
  const env = c.get('env');
  const user = c.get('user');
  const store = getComplaintStore();

  const page = Math.max(1, Number(c.req.query('page') ?? '1') || 1);
  const limit = Math.max(1, Math.min(100, Number(c.req.query('limit') ?? '20') || 20));
  const statusParam = c.req.query('status') as ComplaintStatus | undefined;
  const wardId = c.req.query('wardId') || c.req.query('ward');
  const departmentId = c.req.query('departmentId') || c.req.query('dept');
  const urgencyParam = c.req.query('urgency') as UrgencyLevel | undefined;
  const search = c.req.query('search');

  const { items, total } = await store.queryComplaints(
    {
      page,
      limit,
      status: statusParam,
      wardId,
      departmentId,
      urgency: urgencyParam,
      search,
    },
    env
  );

  const serializedItems = serializeComplaintList(items, user);
  const totalPages = Math.ceil(total / limit) || 1;

  return c.json(
    {
      data: serializedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    },
    200
  );
});

complaintsRoute.get('/:trackingCode', async (c) => {
  const env = c.get('env');
  const user = c.get('user');
  const store = getComplaintStore();
  const code = c.req.param('trackingCode');

  let complaint = await store.findComplaintByTrackingCode(code, env);
  if (!complaint) {
    complaint = await store.findComplaintById(code, env);
  }

  if (!complaint) {
    throw new HttpError(404, 'Not Found', `Complaint with tracking code '${code}' not found`);
  }

  const serialized = serializeComplaint(complaint, user);
  return c.json(serialized, 200);
});
