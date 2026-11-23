import type { ComplaintCategory } from './categories.js';
import type { UrgencyLevel } from './urgency.js';

export interface SlaPolicy {
  readonly resolutionHours: number;
  readonly warningHours: number;
}

export const BASE_SLA_BY_URGENCY: Readonly<Record<UrgencyLevel, SlaPolicy>> = {
  CRITICAL: { resolutionHours: 12, warningHours: 6 },
  HIGH: { resolutionHours: 24, warningHours: 18 },
  MEDIUM: { resolutionHours: 48, warningHours: 36 },
  LOW: { resolutionHours: 72, warningHours: 48 },
};

export const CATEGORY_SLA_OVERRIDES: Partial<Record<ComplaintCategory, SlaPolicy>> = {
  'Electricity Hazard': { resolutionHours: 6, warningHours: 3 },
  'Fire Hazard': { resolutionHours: 6, warningHours: 3 },
  'Water Supply': { resolutionHours: 18, warningHours: 12 },
  'Sewage': { resolutionHours: 18, warningHours: 12 },
};

export function getSlaPolicy(category: ComplaintCategory, urgency: UrgencyLevel): SlaPolicy {
  if (urgency === 'CRITICAL') {
    return BASE_SLA_BY_URGENCY.CRITICAL;
  }
  const override = CATEGORY_SLA_OVERRIDES[category];
  if (override) {
    return override;
  }
  return BASE_SLA_BY_URGENCY[urgency];
}

export function calculateSlaDeadline(
  createdAt: Date | string | number,
  category: ComplaintCategory,
  urgency: UrgencyLevel
): Date {
  const policy = getSlaPolicy(category, urgency);
  const createdMs = typeof createdAt === 'string' || typeof createdAt === 'number'
    ? new Date(createdAt).getTime()
    : createdAt.getTime();
  return new Date(createdMs + policy.resolutionHours * 60 * 60 * 1000);
}

export function calculateRemainingSlaMs(
  createdAt: Date | string | number,
  category: ComplaintCategory,
  urgency: UrgencyLevel,
  now: Date = new Date()
): number {
  const deadline = calculateSlaDeadline(createdAt, category, urgency);
  return deadline.getTime() - now.getTime();
}

export function isSlaBreached(
  createdAt: Date | string | number,
  category: ComplaintCategory,
  urgency: UrgencyLevel,
  now: Date = new Date()
): boolean {
  return calculateRemainingSlaMs(createdAt, category, urgency, now) <= 0;
}

export function isSlaWarning(
  createdAt: Date | string | number,
  category: ComplaintCategory,
  urgency: UrgencyLevel,
  now: Date = new Date()
): boolean {
  const policy = getSlaPolicy(category, urgency);
  const createdMs = typeof createdAt === 'string' || typeof createdAt === 'number'
    ? new Date(createdAt).getTime()
    : createdAt.getTime();
  const warningDeadline = createdMs + policy.warningHours * 60 * 60 * 1000;
  return now.getTime() >= warningDeadline && !isSlaBreached(createdAt, category, urgency, now);
}
