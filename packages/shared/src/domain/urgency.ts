import { z } from 'zod';

export const URGENCY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export const UrgencyLevelSchema = z.enum(URGENCY_LEVELS);

export const URGENCY_WEIGHTS: Readonly<Record<UrgencyLevel, number>> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};
