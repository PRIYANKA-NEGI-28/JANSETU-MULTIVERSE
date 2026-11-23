import { describe, it, expect } from 'vitest';
import {
  BASE_SLA_BY_URGENCY,
  CATEGORY_SLA_OVERRIDES,
  getSlaPolicy,
  calculateSlaDeadline,
  calculateRemainingSlaMs,
  isSlaBreached,
  isSlaWarning,
} from '../domain/sla.js';

describe('SLA Policy & Deadline Calculations', () => {
  it('exposes baseline SLA policy tables', () => {
    expect(BASE_SLA_BY_URGENCY.CRITICAL.resolutionHours).toBe(12);
    expect(CATEGORY_SLA_OVERRIDES['Electricity Hazard']?.resolutionHours).toBe(6);
  });
  it('returns baseline SLA policies according to urgency level', () => {
    expect(getSlaPolicy('General Complaint', 'CRITICAL').resolutionHours).toBe(12);
    expect(getSlaPolicy('General Complaint', 'HIGH').resolutionHours).toBe(24);
    expect(getSlaPolicy('General Complaint', 'MEDIUM').resolutionHours).toBe(48);
    expect(getSlaPolicy('General Complaint', 'LOW').resolutionHours).toBe(72);
  });

  it('applies category-specific overrides for high-hazard utilities when not CRITICAL', () => {
    const electricityPolicy = getSlaPolicy('Electricity Hazard', 'HIGH');
    expect(electricityPolicy.resolutionHours).toBe(6);

    const sewagePolicy = getSlaPolicy('Sewage', 'MEDIUM');
    expect(sewagePolicy.resolutionHours).toBe(18);

    const waterPolicy = getSlaPolicy('Water Supply', 'MEDIUM');
    expect(waterPolicy.resolutionHours).toBe(18);
  });

  it('calculates accurate resolution deadline timestamps', () => {
    const baseTime = new Date('2026-11-23T10:00:00.000Z');
    const deadline = calculateSlaDeadline(baseTime, 'Street Light', 'HIGH');

    // 24 hours later
    const expected = new Date('2026-11-24T10:00:00.000Z');
    expect(deadline.toISOString()).toBe(expected.toISOString());
  });

  it('correctly detects breached and unbreached SLAs', () => {
    const createdAt = new Date('2026-11-20T10:00:00.000Z'); // 3 days ago

    // LOW urgency is 72h = 3 days. Exactly at boundary or slightly after
    const nowBreached = new Date('2026-11-23T10:00:01.000Z');
    expect(isSlaBreached(createdAt, 'General Complaint', 'LOW', nowBreached)).toBe(true);

    const nowWithin = new Date('2026-11-21T10:00:00.000Z');
    expect(isSlaBreached(createdAt, 'General Complaint', 'LOW', nowWithin)).toBe(false);
  });

  it('detects warning window before full breach', () => {
    const createdAt = new Date('2026-11-23T00:00:00.000Z');
    // HIGH urgency: resolution 24h, warning 18h
    const beforeWarning = new Date('2026-11-23T12:00:00.000Z'); // 12h elapsed
    const duringWarning = new Date('2026-11-23T20:00:00.000Z'); // 20h elapsed
    const afterBreach = new Date('2026-11-24T02:00:00.000Z');   // 26h elapsed

    expect(isSlaWarning(createdAt, 'Street Light', 'HIGH', beforeWarning)).toBe(false);
    expect(isSlaWarning(createdAt, 'Street Light', 'HIGH', duringWarning)).toBe(true);
    expect(isSlaWarning(createdAt, 'Street Light', 'HIGH', afterBreach)).toBe(false); // Breached, no longer in warning
  });

  it('computes remaining SLA in milliseconds', () => {
    const createdAt = new Date('2026-11-23T10:00:00.000Z');
    const now = new Date('2026-11-23T14:00:00.000Z'); // 4 hours in
    // CRITICAL is 12h = 8h remaining = 8 * 3600 * 1000 ms
    const remaining = calculateRemainingSlaMs(createdAt, 'General Complaint', 'CRITICAL', now);
    expect(remaining).toBe(8 * 3600 * 1000);
  });
});
