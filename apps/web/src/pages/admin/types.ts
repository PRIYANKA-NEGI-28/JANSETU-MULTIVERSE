import type { UrgencyLevel, ComplaintStatus, DepartmentName } from '@jansetu/shared';
import type { DepartmentCode } from '../../lib/api.js';

export type CivicSource = 'ALL' | 'MOBILE' | 'WEB' | 'IOT';

export type IotNodeStatus = 'NORMAL' | 'FAULT_CONFIRMED' | 'OFFLINE';

export interface IotStreetlightNode {
  readonly id: string;
  readonly poleId: string;
  readonly name: string;
  readonly wardId: string;
  readonly wardName: string;
  readonly lat: number;
  readonly lng: number;
  readonly status: IotNodeStatus;
  readonly ldrValue: number;
  readonly voltage: number;
  readonly lastHeartbeat: string;
}

export interface ClusteredComplaintMarker {
  readonly id: string;
  readonly clusterId?: string;
  readonly title: string;
  readonly departmentCode: DepartmentCode;
  readonly departmentName: string;
  readonly wardId: string;
  readonly wardName: string;
  readonly lat: number;
  readonly lng: number;
  readonly urgency: UrgencyLevel;
  readonly status: ComplaintStatus;
  readonly source: 'MOBILE' | 'WEB' | 'IOT';
  readonly complaintCount: number;
  readonly slaDueAt?: string;
  readonly isOverdue?: boolean;
  readonly overdueHours?: number;
}

export interface MapFilterState {
  readonly ward: string;
  readonly department: DepartmentName | 'ALL';
  readonly status: ComplaintStatus | 'ALL';
  readonly urgency: UrgencyLevel | 'ALL';
  readonly source: CivicSource;
  readonly showIotLayer: boolean;
  readonly showClustersOnly: boolean;
}

export interface AdminKpiStats {
  readonly totalIntake: number;
  readonly resolvedCount: number;
  readonly activeCount: number;
  readonly openClusters: number;
  readonly resolvedClusters: number;
  readonly slaComplianceRatePercent: number;
  readonly averageResolutionHours: number;
  readonly activeEscalations: number;
}
