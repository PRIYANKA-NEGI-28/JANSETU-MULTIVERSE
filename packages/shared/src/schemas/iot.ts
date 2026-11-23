import { z } from 'zod';

export const IotEventPayloadSchema = z.object({
  device_id: z.string().trim().min(1, 'Device ID is required'),
  status: z.enum(['FAULT', 'RESOLVED', 'NORMAL']),
  type: z.string().trim().default('STREETLIGHT'),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  ward: z.string().trim().optional(),
  department: z.string().trim().optional(),
});

export type IotEventPayload = z.infer<typeof IotEventPayloadSchema>;

export const IotHeartbeatPayloadSchema = z.object({
  device_id: z.string().trim().min(1, 'Device ID is required'),
  timestamp: z.number().int().positive(),
  battery_level: z.number().min(0).max(100).optional(),
  signal_strength: z.number().min(-120).max(0).optional(),
  status: z.enum(['HEALTHY', 'DEGRADED', 'FAULT']).default('HEALTHY'),
});

export type IotHeartbeatPayload = z.infer<typeof IotHeartbeatPayloadSchema>;
