import { z } from 'zod';

export const COMPLAINT_STATUSES = [
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'ESCALATED',
  'REOPENED',
] as const;

export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const ComplaintStatusSchema = z.enum(COMPLAINT_STATUSES);

export const VALID_STATUS_TRANSITIONS: Readonly<Record<ComplaintStatus, readonly ComplaintStatus[]>> = {
  PENDING: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED'],
  ASSIGNED: ['IN_PROGRESS', 'RESOLVED', 'ESCALATED', 'PENDING'],
  IN_PROGRESS: ['RESOLVED', 'ESCALATED', 'ASSIGNED'],
  ESCALATED: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['REOPENED'],
  REOPENED: ['ASSIGNED', 'IN_PROGRESS', 'ESCALATED'],
};

export function isValidStatusTransition(from: ComplaintStatus, to: ComplaintStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_STATUS_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}
