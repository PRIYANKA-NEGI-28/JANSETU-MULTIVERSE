import type { AuthUser } from '../types/index.js';

export interface LocationCoords {
  readonly lat: number;
  readonly lng: number;
}

export interface ComplaintEntity {
  readonly id: string;
  readonly trackingCode: string;
  readonly idempotencyKey?: string;
  readonly citizenId?: string | null;
  readonly citizenName: string;
  readonly citizenPhone?: string | null;
  readonly citizenEmail?: string | null;
  readonly departmentId: string;
  readonly wardId: string;
  readonly clusterId?: string | null;
  readonly category: string;
  readonly urgency: string;
  readonly status: string;
  readonly title: string;
  readonly description: string;
  readonly rawText?: string | null;
  readonly language?: string;
  readonly exactLocation: LocationCoords;
  readonly publicLocation: LocationCoords;
  readonly photoUrl?: string | null;
  readonly assignedOfficerId?: string | null;
  readonly slaDueAt: Date | string;
  readonly resolvedAt?: Date | string | null;
  readonly escalatedAt?: Date | string | null;
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
}

export interface PublicComplaintDto {
  readonly id: string;
  readonly trackingCode: string;
  readonly category: string;
  readonly urgency: string;
  readonly status: string;
  readonly title: string;
  readonly description: string;
  readonly wardId: string;
  readonly departmentId: string;
  readonly clusterId: string | null;
  readonly publicLocation: LocationCoords;
  readonly photoUrl: string | null;
  readonly slaDueAt: string;
  readonly resolvedAt: string | null;
  readonly createdAt: string;
}

export interface OfficerComplaintDto extends PublicComplaintDto {
  readonly citizenId: string | null;
  readonly citizenName: string;
  readonly citizenPhone: string | null;
  readonly citizenEmail: string | null;
  readonly exactLocation: LocationCoords;
  readonly assignedOfficerId: string | null;
  readonly escalatedAt: string | null;
  readonly rawText: string | null;
  readonly updatedAt: string;
}

function formatDate(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  return typeof val === 'string' ? val : val.toISOString();
}

export function serializePublicComplaint(entity: ComplaintEntity): PublicComplaintDto {
  return {
    id: entity.id,
    trackingCode: entity.trackingCode,
    category: entity.category,
    urgency: entity.urgency,
    status: entity.status,
    title: entity.title,
    description: entity.description,
    wardId: entity.wardId,
    departmentId: entity.departmentId,
    clusterId: entity.clusterId ?? null,
    publicLocation: {
      lat: entity.publicLocation.lat,
      lng: entity.publicLocation.lng,
    },
    photoUrl: entity.photoUrl ?? null,
    slaDueAt: formatDate(entity.slaDueAt) ?? new Date().toISOString(),
    resolvedAt: formatDate(entity.resolvedAt),
    createdAt: formatDate(entity.createdAt) ?? new Date().toISOString(),
  };
}

export function serializeOfficerComplaint(entity: ComplaintEntity): OfficerComplaintDto {
  const publicBase = serializePublicComplaint(entity);
  return {
    ...publicBase,
    citizenId: entity.citizenId ?? null,
    citizenName: entity.citizenName,
    citizenPhone: entity.citizenPhone ?? null,
    citizenEmail: entity.citizenEmail ?? null,
    exactLocation: {
      lat: entity.exactLocation.lat,
      lng: entity.exactLocation.lng,
    },
    assignedOfficerId: entity.assignedOfficerId ?? null,
    escalatedAt: formatDate(entity.escalatedAt),
    rawText: entity.rawText ?? null,
    updatedAt: formatDate(entity.updatedAt) ?? new Date().toISOString(),
  };
}

export function canAccessPrivilegedComplaint(
  entity: ComplaintEntity,
  user?: AuthUser | null
): boolean {
  if (!user) {
    return false;
  }

  // Admin has universal privileged access
  if (user.role === 'admin') {
    return true;
  }

  // Department Head has access to complaints in their department
  if (user.role === 'dept_head') {
    return !user.departmentId || user.departmentId === entity.departmentId;
  }

  // Ward Officer has access only to complaints in their assigned ward
  if (user.role === 'ward_officer') {
    const wardMatches = user.wardId ? user.wardId === entity.wardId : false;
    const deptMatches = user.departmentId ? user.departmentId === entity.departmentId : true;
    return wardMatches && deptMatches;
  }

  // Citizen has privileged access ONLY if they are the original complainant
  if (user.role === 'citizen') {
    return Boolean(user.id && entity.citizenId && user.id === entity.citizenId);
  }

  return false;
}

export function serializeComplaint(
  entity: ComplaintEntity,
  user?: AuthUser | null
): PublicComplaintDto | OfficerComplaintDto {
  if (canAccessPrivilegedComplaint(entity, user)) {
    return serializeOfficerComplaint(entity);
  }
  return serializePublicComplaint(entity);
}

export function serializeComplaintList(
  entities: readonly ComplaintEntity[],
  user?: AuthUser | null
): readonly (PublicComplaintDto | OfficerComplaintDto)[] {
  return entities.map((entity) => serializeComplaint(entity, user));
}
