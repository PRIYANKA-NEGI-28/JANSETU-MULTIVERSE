import {
  calculateSlaDeadline,
  canTransitionStatus,
  isValidStatusTransition,
  type ComplaintCategory,
  type ComplaintStatus,
  type Role,
  type UrgencyLevel,
} from '@jansetu/shared';
import {
  obfuscatePublicCoords,
  type AppDatabase,
  getDatabase,
  complaints as complaintsTable,
  complaintClusters as clustersTable,
  complaintEvents as eventsTable,
  wards as wardsTable,
  departments as departmentsTable,
  resolveWardByCoords,
  findNearbyOpenCluster,
} from '@jansetu/db';
import { eq, and, sql } from 'drizzle-orm';
import type { ValidatedEnv } from '../config/env.js';
import type { ComplaintEntity, LocationCoords } from '../serializers/complaint.js';
import type { ClusterEntity } from '../serializers/cluster.js';
import { HttpError } from '../middleware/error-handler.js';

export interface CreateComplaintParams {
  readonly idempotencyKey: string;
  readonly citizenId?: string | null;
  readonly citizenName: string;
  readonly citizenPhone?: string | null;
  readonly citizenEmail?: string | null;
  readonly category: ComplaintCategory;
  readonly urgency: UrgencyLevel;
  readonly departmentId?: string;
  readonly departmentName?: string;
  readonly wardId?: string;
  readonly wardName?: string;
  readonly area: string;
  readonly text: string;
  readonly summary?: string;
  readonly language?: 'en' | 'hi';
  readonly lat: number;
  readonly lng: number;
  readonly photoUrl?: string | null;
}

export interface ComplaintFilterParams {
  readonly page?: number;
  readonly limit?: number;
  readonly status?: ComplaintStatus;
  readonly wardId?: string;
  readonly departmentId?: string;
  readonly urgency?: UrgencyLevel;
  readonly search?: string;
}

export interface BoundingBoxParams {
  readonly minLat: number;
  readonly minLng: number;
  readonly maxLat: number;
  readonly maxLng: number;
  readonly status?: ComplaintStatus;
  readonly departmentId?: string;
}

export interface ClusterTimelineEvent {
  readonly id: string;
  readonly complaintId: string;
  readonly actorId: string | null;
  readonly actorRole: string;
  readonly eventType: string;
  readonly fromStatus: string | null;
  readonly toStatus: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
}

export interface DepartmentAnalytics {
  readonly id: string;
  readonly name: string;
  readonly totalComplaints: number;
  readonly resolvedComplaints: number;
  readonly pendingComplaints: number;
  readonly resolutionRatePercent: number;
}

export interface AdminAnalyticsSummary {
  readonly totalComplaints: number;
  readonly totalClusters: number;
  readonly resolvedComplaints: number;
  readonly activeComplaints: number;
  readonly overallResolutionRatePercent: number;
  readonly statusBreakdown: Record<ComplaintStatus, number>;
  readonly urgencyBreakdown: Record<UrgencyLevel, number>;
  readonly departmentAnalytics: readonly DepartmentAnalytics[];
}

export interface SlaBreachItem {
  readonly complaintId: string;
  readonly trackingCode: string;
  readonly title: string;
  readonly category: string;
  readonly urgency: string;
  readonly status: string;
  readonly wardId: string;
  readonly departmentId: string;
  readonly slaDueAt: string;
  readonly overdueHours: number;
}

export class ComplaintStore {
  private inMemoryComplaints = new Map<string, ComplaintEntity>();
  private inMemoryClusters = new Map<string, ClusterEntity>();
  private inMemoryEvents: ClusterTimelineEvent[] = [];

  constructor() {
    this.seedDemoData();
  }

  private seedDemoData(): void {
    const cluster1: ClusterEntity = {
      id: 'cluster-indirapuram-elec',
      title: 'Streetlight outage cluster on Kala Patthar Road',
      departmentId: 'dept-elec',
      wardId: 'ward-12',
      status: 'IN_PROGRESS',
      centroid: { lat: 28.636, lng: 77.371 },
      complaintCount: 2,
      lastActivityAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedOfficerId: 'officer.ward12@jansetu.gov.in',
      internalNotes: 'Replacement bulbs requested from central depot.',
    };
    this.inMemoryClusters.set(cluster1.id, cluster1);

    const comp1: ComplaintEntity = {
      id: 'comp-seed-01',
      trackingCode: 'JS-20261123-0101',
      idempotencyKey: 'idem-seed-01',
      citizenId: 'user-pooja',
      citizenName: 'Pooja Sharma',
      citizenPhone: '+919876543210',
      citizenEmail: 'pooja.sharma@example.com',
      departmentId: 'dept-elec',
      wardId: 'ward-12',
      clusterId: cluster1.id,
      category: 'Street Light',
      urgency: 'HIGH',
      status: 'IN_PROGRESS',
      title: 'Dark stretch on Kala Patthar road near roundabout',
      description: 'Multiple street lights are non-functional creating road safety hazard.',
      rawText: 'Kala Patthar road street lights completely dark.',
      language: 'en',
      exactLocation: { lat: 28.6362, lng: 77.3712 },
      publicLocation: { lat: 28.636, lng: 77.371 },
      photoUrl: null,
      assignedOfficerId: 'officer.ward12@jansetu.gov.in',
      slaDueAt: new Date(Date.now() + 24 * 3600 * 1000),
      resolvedAt: null,
      escalatedAt: null,
      createdAt: new Date(Date.now() - 3600 * 1000),
      updatedAt: new Date(),
    };
    this.inMemoryComplaints.set(comp1.id, comp1);

    this.inMemoryEvents.push({
      id: 'event-seed-01',
      complaintId: comp1.id,
      actorId: comp1.citizenId ?? null,
      actorRole: 'citizen',
      eventType: 'COMPLAINT_CREATED',
      fromStatus: null,
      toStatus: 'PENDING',
      notes: 'Initial citizen complaint filed',
      createdAt: comp1.createdAt instanceof Date ? comp1.createdAt.toISOString() : comp1.createdAt,
    });
  }

  async createComplaint(
    params: CreateComplaintParams,
    env?: ValidatedEnv
  ): Promise<ComplaintEntity> {
    // 1. Idempotency Check: return existing record on duplicate idempotencyKey
    const existing = await this.findComplaintByIdempotencyKey(params.idempotencyKey, env);
    if (existing) {
      return existing;
    }

    const now = new Date();
    const publicCoords = obfuscatePublicCoords(params.lat, params.lng);
    let resolvedWardId = params.wardId ?? 'ward-04';
    const deptId = params.departmentId ?? 'dept-elec';

    // 2. Spatial resolution if database is available
    if (env?.DATABASE_URL) {
      try {
        const db = getDatabase(env.DATABASE_URL);
        const wardMatch = await resolveWardByCoords(db, params.lat, params.lng);
        if (wardMatch) {
          resolvedWardId = wardMatch.id;
        }
      } catch {
        // Fall back cleanly to provided or default wardId
      }
    }

    // 3. Cluster deduplication: match open cluster within 150m and 7 days
    let matchedClusterId: string | null = null;
    let openCluster = await this.findOpenClusterNear(
      params.lat,
      params.lng,
      deptId,
      150,
      env
    );

    if (openCluster) {
      matchedClusterId = openCluster.id;
      await this.incrementClusterReportCount(openCluster.id, params.urgency, env);
    } else {
      const newClusterId = `cluster-${crypto.randomUUID()}`;
      const newCluster: ClusterEntity = {
        id: newClusterId,
        title: `${params.category} cluster near ${params.area}`,
        departmentId: deptId,
        wardId: resolvedWardId,
        status: 'PENDING',
        centroid: publicCoords,
        complaintCount: 1,
        lastActivityAt: now,
        createdAt: now,
        updatedAt: now,
        assignedOfficerId: null,
        internalNotes: null,
      };
      await this.saveCluster(newCluster, env);
      matchedClusterId = newClusterId;
    }

    // 4. Calculate SLA deadline
    const slaDueAt = calculateSlaDeadline(now, params.category, params.urgency);

    // 5. Generate human-readable tracking code
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const trackingCode = `JS-${dateStr}-${randSuffix}`;

    const newComplaint: ComplaintEntity = {
      id: `comp-${crypto.randomUUID()}`,
      trackingCode,
      idempotencyKey: params.idempotencyKey,
      citizenId: params.citizenId ?? null,
      citizenName: params.citizenName,
      citizenPhone: params.citizenPhone ?? null,
      citizenEmail: params.citizenEmail ?? null,
      departmentId: deptId,
      wardId: resolvedWardId,
      clusterId: matchedClusterId,
      category: params.category,
      urgency: params.urgency,
      status: 'PENDING',
      title: params.summary || `${params.category} reported at ${params.area}`,
      description: params.text,
      rawText: params.text,
      language: params.language ?? 'en',
      exactLocation: { lat: params.lat, lng: params.lng },
      publicLocation: publicCoords,
      photoUrl: params.photoUrl ?? null,
      assignedOfficerId: null,
      slaDueAt,
      resolvedAt: null,
      escalatedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    // 6. Append audit event
    const auditEvent: ClusterTimelineEvent = {
      id: `event-${crypto.randomUUID()}`,
      complaintId: newComplaint.id,
      actorId: params.citizenId ?? null,
      actorRole: 'citizen',
      eventType: 'COMPLAINT_CREATED',
      fromStatus: null,
      toStatus: 'PENDING',
      notes: `Complaint filed in ward ${resolvedWardId}`,
      createdAt: now.toISOString(),
    };

    // 7. Persist to DB or Memory Store
    if (env?.DATABASE_URL) {
      try {
        const db = getDatabase(env.DATABASE_URL);
        await db.transaction(async (tx) => {
          await tx.insert(complaintsTable).values({
            id: newComplaint.id,
            trackingCode: newComplaint.trackingCode,
            idempotencyKey: newComplaint.idempotencyKey ?? params.idempotencyKey,
            citizenId: newComplaint.citizenId,
            departmentId: newComplaint.departmentId,
            wardId: newComplaint.wardId,
            clusterId: newComplaint.clusterId,
            category: newComplaint.category,
            urgency: newComplaint.urgency,
            status: newComplaint.status,
            title: newComplaint.title,
            description: newComplaint.description,
            rawText: newComplaint.rawText ?? '',
            language: newComplaint.language ?? 'en',
            citizenName: newComplaint.citizenName,
            citizenPhone: newComplaint.citizenPhone,
            exactLocation: newComplaint.exactLocation,
            publicLocation: newComplaint.publicLocation,
            photoUrl: newComplaint.photoUrl,
            slaDueAt: new Date(newComplaint.slaDueAt),
            createdAt: now,
            updatedAt: now,
          });

          await tx.insert(eventsTable).values({
            id: auditEvent.id,
            complaintId: auditEvent.complaintId,
            actorId: auditEvent.actorId,
            actorRole: auditEvent.actorRole,
            eventType: auditEvent.eventType,
            fromStatus: auditEvent.fromStatus,
            toStatus: auditEvent.toStatus,
            notes: auditEvent.notes,
            createdAt: now,
          });
        });
      } catch {
        // Fall back to in-memory store
      }
    }

    this.inMemoryComplaints.set(newComplaint.id, newComplaint);
    this.inMemoryEvents.push(auditEvent);

    return newComplaint;
  }

  async findComplaintById(id: string, env?: ValidatedEnv): Promise<ComplaintEntity | null> {
    if (env?.DATABASE_URL) {
      try {
        const db = getDatabase(env.DATABASE_URL);
        const result = await db.select().from(complaintsTable).where(eq(complaintsTable.id, id)).limit(1);
        if (result[0]) return result[0] as unknown as ComplaintEntity;
      } catch {
        // fallback
      }
    }
    return this.inMemoryComplaints.get(id) ?? null;
  }

  async findComplaintByTrackingCode(code: string, env?: ValidatedEnv): Promise<ComplaintEntity | null> {
    if (env?.DATABASE_URL) {
      try {
        const db = getDatabase(env.DATABASE_URL);
        const result = await db.select().from(complaintsTable).where(eq(complaintsTable.trackingCode, code)).limit(1);
        if (result[0]) return result[0] as unknown as ComplaintEntity;
      } catch {
        // fallback
      }
    }
    for (const comp of this.inMemoryComplaints.values()) {
      if (comp.trackingCode === code) return comp;
    }
    return null;
  }

  async findComplaintByIdempotencyKey(key: string, env?: ValidatedEnv): Promise<ComplaintEntity | null> {
    if (env?.DATABASE_URL) {
      try {
        const db = getDatabase(env.DATABASE_URL);
        const result = await db.select().from(complaintsTable).where(eq(complaintsTable.idempotencyKey, key)).limit(1);
        if (result[0]) return result[0] as unknown as ComplaintEntity;
      } catch {
        // fallback
      }
    }
    for (const comp of this.inMemoryComplaints.values()) {
      if (comp.idempotencyKey === key) return comp;
    }
    return null;
  }

  async queryComplaints(
    filters: ComplaintFilterParams,
    env?: ValidatedEnv
  ): Promise<{ items: ComplaintEntity[]; total: number }> {
    let all = Array.from(this.inMemoryComplaints.values());

    if (filters.status) {
      all = all.filter((c) => c.status === filters.status);
    }
    if (filters.wardId) {
      all = all.filter((c) => c.wardId === filters.wardId);
    }
    if (filters.departmentId) {
      all = all.filter((c) => c.departmentId === filters.departmentId);
    }
    if (filters.urgency) {
      all = all.filter((c) => c.urgency === filters.urgency);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      all = all.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.trackingCode.toLowerCase().includes(q)
      );
    }

    const total = all.length;
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.max(1, Math.min(100, filters.limit ?? 20));
    const offset = (page - 1) * limit;
    const items = all.slice(offset, offset + limit);

    return { items, total };
  }

  async findClusterById(id: string, env?: ValidatedEnv): Promise<ClusterEntity | null> {
    return this.inMemoryClusters.get(id) ?? null;
  }

  async saveCluster(cluster: ClusterEntity, env?: ValidatedEnv): Promise<void> {
    this.inMemoryClusters.set(cluster.id, cluster);
  }

  async queryClustersByBoundingBox(
    bbox: BoundingBoxParams,
    env?: ValidatedEnv
  ): Promise<ClusterEntity[]> {
    let clusters = Array.from(this.inMemoryClusters.values());

    clusters = clusters.filter(
      (c) =>
        c.centroid.lat >= bbox.minLat &&
        c.centroid.lat <= bbox.maxLat &&
        c.centroid.lng >= bbox.minLng &&
        c.centroid.lng <= bbox.maxLng
    );

    if (bbox.status) {
      clusters = clusters.filter((c) => c.status === bbox.status);
    }
    if (bbox.departmentId) {
      clusters = clusters.filter((c) => c.departmentId === bbox.departmentId);
    }

    return clusters;
  }

  async assignCluster(
    clusterId: string,
    officerId: string,
    notes?: string,
    actorId?: string,
    actorRole: Role = 'admin',
    env?: ValidatedEnv
  ): Promise<ClusterEntity> {
    const cluster = this.inMemoryClusters.get(clusterId);
    if (!cluster) {
      throw new HttpError(404, 'Not Found', `Cluster '${clusterId}' not found`);
    }

    const updated: ClusterEntity = {
      ...cluster,
      assignedOfficerId: officerId,
      status: cluster.status === 'PENDING' ? 'ASSIGNED' : cluster.status,
      internalNotes: notes ?? cluster.internalNotes,
      updatedAt: new Date(),
    };
    this.inMemoryClusters.set(clusterId, updated);

    // Update linked complaints
    for (const [id, comp] of this.inMemoryComplaints.entries()) {
      if (comp.clusterId === clusterId) {
        const updatedComp: ComplaintEntity = {
          ...comp,
          assignedOfficerId: officerId,
          status: comp.status === 'PENDING' ? 'ASSIGNED' : comp.status,
          updatedAt: new Date(),
        };
        this.inMemoryComplaints.set(id, updatedComp);

        this.inMemoryEvents.push({
          id: `event-${crypto.randomUUID()}`,
          complaintId: id,
          actorId: actorId ?? null,
          actorRole,
          eventType: 'OFFICER_ASSIGNED',
          fromStatus: comp.status,
          toStatus: updatedComp.status,
          notes: notes ?? `Assigned to officer ${officerId}`,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return updated;
  }

  async updateClusterStatus(
    clusterId: string,
    targetStatus: ComplaintStatus,
    notes?: string,
    actorId?: string,
    actorRole: Role = 'admin',
    env?: ValidatedEnv
  ): Promise<ClusterEntity> {
    const cluster = this.inMemoryClusters.get(clusterId);
    if (!cluster) {
      throw new HttpError(404, 'Not Found', `Cluster '${clusterId}' not found`);
    }

    const currentStatus = cluster.status as ComplaintStatus;
    if (!isValidStatusTransition(currentStatus, targetStatus)) {
      throw new HttpError(
        400,
        'Invalid Status Transition',
        `State machine prohibits transition from '${currentStatus}' to '${targetStatus}'`
      );
    }

    if (!canTransitionStatus(actorRole, currentStatus, targetStatus)) {
      throw new HttpError(
        403,
        'Forbidden',
        `Role '${actorRole}' is not permitted to transition status from '${currentStatus}' to '${targetStatus}'`
      );
    }

    const now = new Date();
    const updated: ClusterEntity = {
      ...cluster,
      status: targetStatus,
      internalNotes: notes ?? cluster.internalNotes,
      updatedAt: now,
    };
    this.inMemoryClusters.set(clusterId, updated);

    // Propagate status update to linked complaints
    for (const [id, comp] of this.inMemoryComplaints.entries()) {
      if (comp.clusterId === clusterId) {
        const updatedComp: ComplaintEntity = {
          ...comp,
          status: targetStatus,
          resolvedAt: targetStatus === 'RESOLVED' ? now : comp.resolvedAt,
          escalatedAt: targetStatus === 'ESCALATED' ? now : comp.escalatedAt,
          updatedAt: now,
        };
        this.inMemoryComplaints.set(id, updatedComp);

        this.inMemoryEvents.push({
          id: `event-${crypto.randomUUID()}`,
          complaintId: id,
          actorId: actorId ?? null,
          actorRole,
          eventType: 'STATUS_UPDATED',
          fromStatus: currentStatus,
          toStatus: targetStatus,
          notes: notes ?? `Status transitioned to ${targetStatus}`,
          createdAt: now.toISOString(),
        });
      }
    }

    return updated;
  }

  async getClusterTimeline(clusterId: string): Promise<ClusterTimelineEvent[]> {
    const linkedComplaintIds = new Set<string>();
    for (const comp of this.inMemoryComplaints.values()) {
      if (comp.clusterId === clusterId) {
        linkedComplaintIds.add(comp.id);
      }
    }

    return this.inMemoryEvents
      .filter((ev) => linkedComplaintIds.has(ev.complaintId))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async getAnalytics(): Promise<AdminAnalyticsSummary> {
    const complaints = Array.from(this.inMemoryComplaints.values());
    const totalComplaints = complaints.length;
    const resolvedComplaints = complaints.filter((c) => c.status === 'RESOLVED').length;
    const activeComplaints = totalComplaints - resolvedComplaints;
    const overallResolutionRatePercent =
      totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 0;

    const statusBreakdown: Record<ComplaintStatus, number> = {
      PENDING: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      ESCALATED: 0,
      REOPENED: 0,
    };
    for (const c of complaints) {
      const s = c.status as ComplaintStatus;
      if (statusBreakdown[s] !== undefined) statusBreakdown[s]++;
    }

    const urgencyBreakdown: Record<UrgencyLevel, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    for (const c of complaints) {
      const u = c.urgency as UrgencyLevel;
      if (urgencyBreakdown[u] !== undefined) urgencyBreakdown[u]++;
    }

    const deptMap = new Map<string, { total: number; resolved: number }>();
    for (const c of complaints) {
      const entry = deptMap.get(c.departmentId) ?? { total: 0, resolved: 0 };
      entry.total++;
      if (c.status === 'RESOLVED') entry.resolved++;
      deptMap.set(c.departmentId, entry);
    }

    const departmentAnalytics: DepartmentAnalytics[] = Array.from(deptMap.entries()).map(
      ([deptId, data]) => ({
        id: deptId,
        name: deptId === 'dept-elec' ? 'Electrical Division' : deptId,
        totalComplaints: data.total,
        resolvedComplaints: data.resolved,
        pendingComplaints: data.total - data.resolved,
        resolutionRatePercent: data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0,
      })
    );

    return {
      totalComplaints,
      totalClusters: this.inMemoryClusters.size,
      resolvedComplaints,
      activeComplaints,
      overallResolutionRatePercent,
      statusBreakdown,
      urgencyBreakdown,
      departmentAnalytics,
    };
  }

  async getSlaBreaches(): Promise<SlaBreachItem[]> {
    const nowMs = Date.now();
    const breaches: SlaBreachItem[] = [];

    for (const comp of this.inMemoryComplaints.values()) {
      if (comp.status === 'RESOLVED') continue;
      const dueMs = new Date(comp.slaDueAt).getTime();
      if (nowMs > dueMs) {
        const overdueHours = Number(((nowMs - dueMs) / (1000 * 3600)).toFixed(1));
        breaches.push({
          complaintId: comp.id,
          trackingCode: comp.trackingCode,
          title: comp.title,
          category: comp.category,
          urgency: comp.urgency,
          status: comp.status,
          wardId: comp.wardId,
          departmentId: comp.departmentId,
          slaDueAt: comp.slaDueAt instanceof Date ? comp.slaDueAt.toISOString() : comp.slaDueAt,
          overdueHours,
        });
      }
    }

    return breaches;
  }

  private async findOpenClusterNear(
    lat: number,
    lng: number,
    departmentId: string,
    radiusMeters: number,
    env?: ValidatedEnv
  ): Promise<ClusterEntity | null> {
    if (env?.DATABASE_URL) {
      try {
        const db = getDatabase(env.DATABASE_URL);
        const match = await findNearbyOpenCluster(db, lat, lng, departmentId, radiusMeters, 7);
        if (match) {
          return {
            id: match.id,
            title: match.title,
            departmentId: match.departmentId,
            wardId: match.wardId,
            status: match.status,
            centroid: match.centroid as LocationCoords,
            complaintCount: match.complaintCount,
            lastActivityAt: match.lastActivityAt,
            createdAt: match.createdAt,
            updatedAt: match.updatedAt,
          };
        }
      } catch {
        // fallback to memory
      }
    }

    // In-memory distance check (Haversine formula approximation)
    for (const cluster of this.inMemoryClusters.values()) {
      if (cluster.departmentId !== departmentId || cluster.status === 'RESOLVED') continue;
      const dLat = (cluster.centroid.lat - lat) * 111320;
      const dLng = (cluster.centroid.lng - lng) * 111320 * Math.cos((lat * Math.PI) / 180);
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      if (dist <= radiusMeters) {
        return cluster;
      }
    }
    return null;
  }

  private async incrementClusterReportCount(
    clusterId: string,
    newUrgency: UrgencyLevel,
    env?: ValidatedEnv
  ): Promise<void> {
    const cluster = this.inMemoryClusters.get(clusterId);
    if (!cluster) return;

    const updated: ClusterEntity = {
      ...cluster,
      complaintCount: cluster.complaintCount + 1,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    };
    this.inMemoryClusters.set(clusterId, updated);
  }

  reset(): void {
    this.inMemoryComplaints.clear();
    this.inMemoryClusters.clear();
    this.inMemoryEvents = [];
    this.seedDemoData();
  }
}

const defaultComplaintStore = new ComplaintStore();

export function getComplaintStore(): ComplaintStore {
  return defaultComplaintStore;
}
