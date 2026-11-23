import type { AuthUser } from '../types/index.js';
import type { LocationCoords } from './complaint.js';

export interface ClusterEntity {
  readonly id: string;
  readonly title: string;
  readonly departmentId: string;
  readonly wardId: string;
  readonly status: string;
  readonly centroid: LocationCoords;
  readonly complaintCount: number;
  readonly lastActivityAt: Date | string;
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
  readonly assignedOfficerId?: string | null;
  readonly internalNotes?: string | null;
}

export interface PublicClusterDto {
  readonly id: string;
  readonly title: string;
  readonly departmentId: string;
  readonly wardId: string;
  readonly status: string;
  readonly centroid: LocationCoords;
  readonly complaintCount: number;
  readonly lastActivityAt: string;
  readonly createdAt: string;
}

export interface OfficerClusterDto extends PublicClusterDto {
  readonly assignedOfficerId: string | null;
  readonly internalNotes: string | null;
  readonly updatedAt: string;
}

function formatDate(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  return typeof val === 'string' ? val : val.toISOString();
}

export function serializePublicCluster(entity: ClusterEntity): PublicClusterDto {
  return {
    id: entity.id,
    title: entity.title,
    departmentId: entity.departmentId,
    wardId: entity.wardId,
    status: entity.status,
    centroid: {
      lat: entity.centroid.lat,
      lng: entity.centroid.lng,
    },
    complaintCount: entity.complaintCount,
    lastActivityAt: formatDate(entity.lastActivityAt) ?? new Date().toISOString(),
    createdAt: formatDate(entity.createdAt) ?? new Date().toISOString(),
  };
}

export function serializeOfficerCluster(entity: ClusterEntity): OfficerClusterDto {
  const publicBase = serializePublicCluster(entity);
  return {
    ...publicBase,
    assignedOfficerId: entity.assignedOfficerId ?? null,
    internalNotes: entity.internalNotes ?? null,
    updatedAt: formatDate(entity.updatedAt) ?? new Date().toISOString(),
  };
}

export function canAccessPrivilegedCluster(
  entity: ClusterEntity,
  user?: AuthUser | null
): boolean {
  if (!user) {
    return false;
  }
  if (user.role === 'admin') {
    return true;
  }
  if (user.role === 'dept_head') {
    return !user.departmentId || user.departmentId === entity.departmentId;
  }
  if (user.role === 'ward_officer') {
    return user.wardId ? user.wardId === entity.wardId : false;
  }
  return false;
}

export function serializeCluster(
  entity: ClusterEntity,
  user?: AuthUser | null
): PublicClusterDto | OfficerClusterDto {
  if (canAccessPrivilegedCluster(entity, user)) {
    return serializeOfficerCluster(entity);
  }
  return serializePublicCluster(entity);
}

export function serializeClusterList(
  entities: readonly ClusterEntity[],
  user?: AuthUser | null
): readonly (PublicClusterDto | OfficerClusterDto)[] {
  return entities.map((entity) => serializeCluster(entity, user));
}
