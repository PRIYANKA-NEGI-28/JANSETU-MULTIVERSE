import { describe, it, expect } from 'vitest';
import {
  VALID_STATUS_TRANSITIONS,
  isValidStatusTransition,
  type ComplaintStatus,
} from '../domain/status.js';
import { canTransitionStatus, hasPermission } from '../roles/index.js';

describe('Status State Machine', () => {
  it('validates transition dictionary integrity', () => {
    expect(VALID_STATUS_TRANSITIONS.PENDING).toContain('ASSIGNED');
    expect(VALID_STATUS_TRANSITIONS.RESOLVED).toContain('REOPENED');
  });
  it('allows valid sequential transitions from PENDING', () => {
    expect(isValidStatusTransition('PENDING', 'ASSIGNED')).toBe(true);
    expect(isValidStatusTransition('PENDING', 'IN_PROGRESS')).toBe(true);
    expect(isValidStatusTransition('PENDING', 'RESOLVED')).toBe(true);
    expect(isValidStatusTransition('PENDING', 'ESCALATED')).toBe(true);
  });

  it('rejects invalid transitions from PENDING', () => {
    expect(isValidStatusTransition('PENDING', 'REOPENED')).toBe(false);
  });

  it('only allows REOPENED from RESOLVED', () => {
    expect(isValidStatusTransition('RESOLVED', 'REOPENED')).toBe(true);
    expect(isValidStatusTransition('RESOLVED', 'PENDING')).toBe(false);
    expect(isValidStatusTransition('RESOLVED', 'ASSIGNED')).toBe(false);
    expect(isValidStatusTransition('RESOLVED', 'IN_PROGRESS')).toBe(false);
  });

  it('allows self-transitions (idempotent)', () => {
    const statuses: ComplaintStatus[] = [
      'PENDING',
      'ASSIGNED',
      'IN_PROGRESS',
      'RESOLVED',
      'ESCALATED',
      'REOPENED',
    ];
    for (const status of statuses) {
      expect(isValidStatusTransition(status, status)).toBe(true);
    }
  });

  it('enforces role-based transition authorization', () => {
    // Citizen can only reopen resolved complaints
    expect(canTransitionStatus('citizen', 'RESOLVED', 'REOPENED')).toBe(true);
    expect(canTransitionStatus('citizen', 'PENDING', 'ASSIGNED')).toBe(false);
    expect(canTransitionStatus('citizen', 'ASSIGNED', 'RESOLVED')).toBe(false);

    // Ward officer can move assigned to in progress or resolved/escalated
    expect(canTransitionStatus('ward_officer', 'ASSIGNED', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionStatus('ward_officer', 'IN_PROGRESS', 'RESOLVED')).toBe(true);
    expect(canTransitionStatus('ward_officer', 'PENDING', 'RESOLVED')).toBe(false);

    // Admin has superuser authority across all states
    expect(canTransitionStatus('admin', 'PENDING', 'RESOLVED')).toBe(true);
    expect(canTransitionStatus('admin', 'RESOLVED', 'REOPENED')).toBe(true);
    expect(canTransitionStatus('admin', 'ESCALATED', 'ASSIGNED')).toBe(true);
  });

  it('correctly maps role permissions', () => {
    expect(hasPermission('citizen', 'complaint:create')).toBe(true);
    expect(hasPermission('citizen', 'complaint:view_all')).toBe(false);

    expect(hasPermission('ward_officer', 'complaint:update_status')).toBe(true);
    expect(hasPermission('ward_officer', 'admin:access_dashboard')).toBe(false);

    expect(hasPermission('dept_head', 'complaint:assign')).toBe(true);
    expect(hasPermission('dept_head', 'admin:access_dashboard')).toBe(true);
    expect(hasPermission('dept_head', 'admin:system_reset')).toBe(false);

    expect(hasPermission('admin', 'admin:system_reset')).toBe(true);
  });
});
