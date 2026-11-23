import { z } from 'zod';
import { ComplaintStatusSchema } from '../domain/status.js';

export const UpdateClusterStatusSchema = z.object({
  complaint_id: z.string().trim().min(1, 'Complaint ID is required'),
  status: ComplaintStatusSchema,
  officer_id: z.string().trim().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type UpdateClusterStatusInput = z.infer<typeof UpdateClusterStatusSchema>;

export const ClusterDetailsSchema = z.object({
  head_complaint_id: z.string(),
  ward: z.string(),
  department: z.string(),
  count: z.number().int().positive(),
  status: ComplaintStatusSchema,
  complaint_numbers: z.array(z.string()),
  center_lat: z.number(),
  center_lng: z.number(),
});

export type ClusterDetails = z.infer<typeof ClusterDetailsSchema>;
