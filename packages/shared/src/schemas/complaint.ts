import { z } from 'zod';
import { ComplaintCategorySchema } from '../domain/categories.js';
import { DepartmentSchema } from '../domain/departments.js';
import { UrgencyLevelSchema } from '../domain/urgency.js';
import { ComplaintStatusSchema } from '../domain/status.js';

export const CreateComplaintSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100).default('Anonymous'),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[-\s]?)?[0]?(91)?[6789]\d{9}$|^[0-9]{10}$/, 'Must be a valid 10-digit Indian phone number')
    .optional()
    .or(z.literal('')),
  text: z.string().trim().min(5, 'Complaint text must be at least 5 characters').max(2000),
  area: z.string().trim().min(1, 'Area is required'),
  ward: z.string().trim().min(1, 'Ward is required'),
  city: z.string().trim().default('Delhi NCR'),
  issue_type: ComplaintCategorySchema.default('General Complaint'),
  urgency: UrgencyLevelSchema.default('MEDIUM'),
  department: DepartmentSchema.default('Municipal Corporation - General Administration'),
  summary: z.string().trim().max(500).optional().default(''),
  latitude: z.number().min(-90).max(90).optional().default(28.6139),
  longitude: z.number().min(-180).max(180).optional().default(77.2090),
  photo_url: z.string().url().optional().nullable(),
  language: z.enum(['en', 'hi']).default('en'),
  complaint_number: z.string().optional(),
});

export type CreateComplaintInput = z.infer<typeof CreateComplaintSchema>;

export const ComplaintSchema = z.object({
  id: z.string(),
  complaint_number: z.string(),
  citizen_name: z.string(),
  citizen_phone: z.string().optional(),
  raw_text: z.string(),
  language: z.string(),
  issue_type: ComplaintCategorySchema,
  summary: z.string(),
  urgency: UrgencyLevelSchema,
  department: DepartmentSchema,
  area: z.string(),
  ward: z.string(),
  status: ComplaintStatusSchema,
  lat: z.number(),
  lng: z.number(),
  photo_url: z.string().optional().nullable(),
  similar_count: z.number().int().default(1),
  is_cluster_head: z.boolean().default(false),
  assigned_officer_id: z.string().optional().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Complaint = z.infer<typeof ComplaintSchema>;
