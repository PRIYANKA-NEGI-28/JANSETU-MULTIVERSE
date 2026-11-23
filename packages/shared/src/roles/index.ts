import { z } from 'zod';
import type { ComplaintStatus } from '../domain/status.js';

export const ROLES = ['citizen', 'ward_officer', 'dept_head', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const RoleSchema = z.enum(ROLES);

export const PERMISSIONS = [
  'complaint:create',
  'complaint:view_own',
  'complaint:view_all',
  'complaint:assign',
  'complaint:update_status',
  'complaint:escalate',
  'officer:seed',
  'officer:manage',
  'admin:access_dashboard',
  'admin:system_reset',
  'iot:view_telemetry',
  'iot:manage_devices',
  'rti:create',
  'rti:review',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  citizen: ['complaint:create', 'complaint:view_own', 'rti:create', 'iot:view_telemetry'],
  ward_officer: [
    'complaint:view_all',
    'complaint:update_status',
    'complaint:escalate',
    'iot:view_telemetry',
  ],
  dept_head: [
    'complaint:view_all',
    'complaint:assign',
    'complaint:update_status',
    'complaint:escalate',
    'officer:manage',
    'admin:access_dashboard',
    'iot:view_telemetry',
    'rti:review',
  ],
  admin: PERMISSIONS,
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const allowed = ROLE_PERMISSIONS[role];
  return allowed ? allowed.includes(permission) : false;
}

export function getRolePermissions(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function canTransitionStatus(
  role: Role,
  from: ComplaintStatus,
  to: ComplaintStatus
): boolean {
  if (role === 'admin') return true;

  if (role === 'citizen') {
    return from === 'RESOLVED' && to === 'REOPENED';
  }

  if (role === 'ward_officer') {
    if (from === 'ASSIGNED' && (to === 'IN_PROGRESS' || to === 'RESOLVED' || to === 'ESCALATED')) {
      return true;
    }
    if (from === 'IN_PROGRESS' && (to === 'RESOLVED' || to === 'ESCALATED')) {
      return true;
    }
    return false;
  }

  if (role === 'dept_head') {
    if (from === 'PENDING' && (to === 'ASSIGNED' || to === 'ESCALATED' || to === 'IN_PROGRESS')) {
      return true;
    }
    if (from === 'ESCALATED' && (to === 'ASSIGNED' || to === 'IN_PROGRESS' || to === 'RESOLVED')) {
      return true;
    }
    if (to === 'RESOLVED' || to === 'ASSIGNED') {
      return true;
    }
  }

  return false;
}
