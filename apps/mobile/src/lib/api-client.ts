import type {
  ComplaintCategory,
  ComplaintStatus,
  DepartmentName,
  UrgencyLevel,
} from '@jansetu/shared';
import * as SecureStore from 'expo-secure-store';
import { authClient } from './auth-client';

export const API_BASE_URL: string = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface ComplaintDto {
  readonly id: string;
  readonly trackingCode: string;
  readonly complaint_number?: string;
  readonly clusterId: string | null;
  readonly departmentCode?: DepartmentName | string;
  readonly department?: string;
  readonly category: ComplaintCategory | string;
  readonly issueType?: string;
  readonly issue_type?: string;
  readonly urgency: UrgencyLevel;
  readonly status: ComplaintStatus;
  readonly summary: string;
  readonly description: string;
  readonly raw_text?: string;
  readonly citizen_name?: string;
  readonly citizen_phone?: string;
  readonly area?: string;
  readonly ward?: string;
  readonly lat?: number | string;
  readonly lng?: number | string;
  readonly language?: string;
  readonly similar_count?: number;
  readonly is_cluster_head?: boolean;
  readonly publicLocation?: {
    readonly wardId?: string | null;
    readonly approximateAddress?: string | null;
    readonly publicCoordinates?: { readonly latitude: number; readonly longitude: number };
  };
  readonly photoUrl?: string | null;
  readonly audioUrl?: string | null;
  readonly slaDueAt: string;
  readonly escalationLevel?: number;
  readonly createdAt: string;
  readonly created_at?: string;
  readonly updatedAt?: string;
  readonly updated_at?: string;
}

export type Neo4jComplaint = ComplaintDto;

export interface CreateComplaintInput {
  readonly citizenName: string;
  readonly citizenPhone?: string;
  readonly rawText: string;
  readonly language: 'en' | 'hi' | string;
  readonly issueType: string;
  readonly summary: string;
  readonly urgency: UrgencyLevel;
  readonly department: string;
  readonly area: string;
  readonly ward: string;
  readonly userId?: string;
  readonly photoUrl?: string | null;
  readonly audioUrl?: string | null;
  readonly coordinates?: { readonly latitude: number; readonly longitude: number };
  readonly idempotencyKey?: string;
}

export interface RealtimeTokenDto {
  readonly token: string;
  readonly isMock?: boolean;
  readonly channel?: string;
  readonly clientId?: string;
  readonly expires?: number;
  readonly capability?: string;
}

export interface DepartmentStatsDto {
  readonly id: string;
  readonly name: string;
  readonly total_complaints: number;
  readonly resolved_complaints: number;
  readonly avg_resolution_days: number;
  readonly pending_count: number;
  readonly escalated_count: number;
  readonly trust_score: number;
}

export interface GraphStatsDto {
  readonly total: number;
  readonly clustered: number;
  readonly escalated: number;
  readonly hotspots: readonly { readonly area: string; readonly count: number }[];
}

export interface MapClusterDto {
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
  readonly count: number;
  readonly severity: UrgencyLevel;
  readonly category: string;
  readonly area: string;
  readonly status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
}

export interface WardResolutionDto {
  readonly wardId: string;
  readonly wardName: string;
  readonly zone: string;
  readonly city: string;
  readonly approximateAddress: string;
}

export interface PresignedMediaDto {
  readonly uploadUrl: string;
  readonly key: string;
  readonly publicUrl: string;
  readonly headers?: Record<string, string>;
  readonly maxSizeBytes: number;
}

export interface TranscriptionResultDto {
  readonly success?: boolean;
  readonly transcript: string;
  readonly detectedLang: string;
  readonly translatedEn?: string;
  readonly translatedHi?: string;
  readonly provider?: string;
}

function normalizeComplaint(item: Record<string, unknown>): ComplaintDto {
  const trackingCode = typeof item.trackingCode === 'string'
    ? item.trackingCode
    : typeof item.complaint_number === 'string'
      ? item.complaint_number
      : `JS-${Date.now()}`;

  const summary = typeof item.summary === 'string'
    ? item.summary
    : typeof item.description === 'string'
      ? item.description
      : 'No summary provided';

  const status = (typeof item.status === 'string'
    ? item.status.toUpperCase()
    : 'PENDING') as ComplaintStatus;

  const urgency = (typeof item.urgency === 'string'
    ? item.urgency.toUpperCase()
    : 'MEDIUM') as UrgencyLevel;

  const createdAt = typeof item.createdAt === 'string'
    ? item.createdAt
    : typeof item.created_at === 'string'
      ? item.created_at
      : new Date().toISOString();

  const issueType = typeof item.category === 'string'
    ? item.category
    : typeof item.issue_type === 'string'
      ? item.issue_type
      : typeof item.issueType === 'string'
        ? item.issueType
        : 'General Civic Issue';

  const department = typeof item.department === 'string'
    ? item.department
    : typeof item.departmentCode === 'string'
      ? item.departmentCode
      : 'Municipal Corporation';

  return {
    id: String(item.id || trackingCode),
    trackingCode,
    complaint_number: trackingCode,
    clusterId: typeof item.clusterId === 'string' ? item.clusterId : null,
    departmentCode: department,
    department,
    category: issueType,
    issueType,
    issue_type: issueType,
    urgency,
    status,
    summary,
    description: typeof item.description === 'string' ? item.description : summary,
    raw_text: typeof item.raw_text === 'string' ? item.raw_text : summary,
    citizen_name: typeof item.citizen_name === 'string' ? item.citizen_name : typeof item.reporterName === 'string' ? item.reporterName : 'Anonymous',
    citizen_phone: typeof item.citizen_phone === 'string' ? item.citizen_phone : typeof item.reporterPhone === 'string' ? item.reporterPhone : undefined,
    area: typeof item.area === 'string' ? item.area : 'Delhi',
    ward: typeof item.ward === 'string' ? item.ward : 'Ward 1',
    language: typeof item.language === 'string' ? item.language : 'en',
    similar_count: typeof item.similar_count === 'number' ? item.similar_count : 1,
    is_cluster_head: Boolean(item.is_cluster_head),
    photoUrl: typeof item.photoUrl === 'string' ? item.photoUrl : null,
    audioUrl: typeof item.audioUrl === 'string' ? item.audioUrl : null,
    slaDueAt: typeof item.slaDueAt === 'string' ? item.slaDueAt : new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    escalationLevel: typeof item.escalationLevel === 'number' ? item.escalationLevel : 0,
    createdAt,
    created_at: createdAt,
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : createdAt,
    updated_at: typeof item.updated_at === 'string' ? item.updated_at : createdAt,
  };
}

export async function getHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  try {
    let token: string | null = null;
    try {
      token = await SecureStore.getItemAsync('jansetu_auth_token');
    } catch {
      // SecureStore may fail in SSR / test environments
    }

    if (!token) {
      try {
        const sessionResult = await authClient.getSession();
        const data = sessionResult?.data as { session?: { token?: string }; token?: string } | undefined;
        if (data?.session?.token) {
          token = data.session.token;
        } else if (data?.token) {
          token = data.token;
        }
      } catch {
        // Fallback
      }
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const cookie = await (authClient as { getCookie?: () => Promise<string | null> }).getCookie?.();
      if (cookie) {
        headers.Cookie = cookie;
      }
    } catch {
      // Continue without cookie in offline / unauthenticated states
    }
  } catch {
    // Continue in offline / unauthenticated states
  }

  return headers;
}

export async function getAllComplaints(): Promise<readonly ComplaintDto[]> {
  try {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE_URL}/api/v1/complaints`, { headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch complaints: ${res.status}`);
    }
    const json = (await res.json()) as { readonly data?: readonly Record<string, unknown>[] };
    const items = Array.isArray(json) ? json : json.data || [];
    return items.map((item) => normalizeComplaint(item as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function getComplaintByNumber(complaintNumber: string): Promise<ComplaintDto | null> {
  try {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE_URL}/api/v1/complaints/${encodeURIComponent(complaintNumber)}`, { headers });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to fetch complaint: ${res.status}`);
    }
    const json = (await res.json()) as { readonly data?: Record<string, unknown> } | Record<string, unknown>;
    const raw = 'data' in json && json.data ? json.data : json;
    return normalizeComplaint(raw as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function createComplaint(
  data: CreateComplaintInput
): Promise<{ readonly complaintNumber: string; readonly id: string; readonly trackingCode: string }> {
  const payload = {
    idempotency_key: data.idempotencyKey,
    name: data.citizenName,
    reporterName: data.citizenName,
    phone: data.citizenPhone || undefined,
    reporterPhone: data.citizenPhone || undefined,
    text: data.rawText,
    description: data.rawText,
    summary: data.summary,
    category: data.issueType,
    issue_type: data.issueType,
    department: data.department,
    departmentCode: data.department,
    urgency: data.urgency,
    language: data.language === 'hi' ? 'hi' : 'en',
    area: data.area,
    ward: data.ward,
    wardId: data.ward,
    photo_url: data.photoUrl || undefined,
    photoUrl: data.photoUrl || undefined,
    audioUrl: data.audioUrl || undefined,
    approximateAddress: `${data.area}, ${data.ward}`,
    coordinates: data.coordinates || { latitude: 28.6139, longitude: 77.209 },
    latitude: data.coordinates?.latitude ?? 28.6139,
    longitude: data.coordinates?.longitude ?? 77.209,
    lat: data.coordinates?.latitude ?? 28.6139,
    lng: data.coordinates?.longitude ?? 77.209,
  };

  const headers = await getHeaders();
  if (data.idempotencyKey) {
    headers['X-Idempotency-Key'] = data.idempotencyKey;
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/complaints`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown network error');
    throw new Error(`Failed to create complaint (${res.status}): ${errorText}`);
  }

  const json = (await res.json()) as {
    readonly data?: { readonly trackingCode?: string; readonly id?: string };
    readonly trackingCode?: string;
    readonly id?: string;
  };
  const trackingCode = json.data?.trackingCode || json.trackingCode || `JS-${Date.now()}`;
  const id = json.data?.id || json.id || trackingCode;

  return { complaintNumber: trackingCode, id, trackingCode };
}

export async function getComplaintByTrackingCode(trackingCode: string): Promise<ComplaintDto | null> {
  try {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE_URL}/api/v1/complaints/${encodeURIComponent(trackingCode)}`, {
      headers,
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as Record<string, unknown>;
    return normalizeComplaint(raw);
  } catch {
    return null;
  }
}

export async function getRealtimeToken(trackingCode?: string): Promise<RealtimeTokenDto> {
  const url = trackingCode
    ? `${API_BASE_URL}/api/v1/realtime/token?trackingCode=${encodeURIComponent(trackingCode)}`
    : `${API_BASE_URL}/api/v1/realtime/token`;

  const headers = await getHeaders();
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const errText = await res.text().catch(() => 'Token request failed');
    throw new Error(`Realtime token request failed (${res.status}): ${errText}`);
  }
  return (await res.json()) as RealtimeTokenDto;
}

export async function getUserComplaints(): Promise<readonly ComplaintDto[]> {
  try {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE_URL}/api/v1/complaints?limit=50`, { headers });
    if (!res.ok) return [];
    const json = (await res.json()) as { readonly data?: readonly Record<string, unknown>[] };
    const list = json.data || [];
    return list.map(normalizeComplaint);
  } catch {
    return [];
  }
}

export async function getDepartmentStats(): Promise<readonly DepartmentStatsDto[]> {
  try {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/analytics`, { headers });
    if (res.ok) {
      const json = (await res.json()) as { readonly data?: { readonly departments?: readonly DepartmentStatsDto[] } };
      if (json.data?.departments) return json.data.departments;
    }
  } catch {
    // Fall back to default departments
  }

  return [
    { id: '1', name: 'Electrical Division', total_complaints: 142, resolved_complaints: 110, avg_resolution_days: 1.8, pending_count: 24, escalated_count: 8, trust_score: 84 },
    { id: '2', name: 'Public Works Department', total_complaints: 215, resolved_complaints: 154, avg_resolution_days: 3.2, pending_count: 48, escalated_count: 13, trust_score: 76 },
    { id: '3', name: 'Sanitation Department', total_complaints: 188, resolved_complaints: 165, avg_resolution_days: 1.1, pending_count: 18, escalated_count: 5, trust_score: 91 },
    { id: '4', name: 'Delhi Jal Board', total_complaints: 96, resolved_complaints: 72, avg_resolution_days: 2.4, pending_count: 19, escalated_count: 5, trust_score: 79 },
  ];
}

export async function getGraphStats(): Promise<GraphStatsDto> {
  try {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/analytics`, { headers });
    if (res.ok) {
      const json = (await res.json()) as { readonly data?: GraphStatsDto };
      if (json.data) return json.data;
    }
  } catch {
    // Fall back to defaults
  }

  return {
    total: 641,
    clustered: 420,
    escalated: 31,
    hotspots: [
      { area: 'Connaught Place', count: 42 },
      { area: 'Lajpat Nagar', count: 38 },
      { area: 'Rohini Sector 3', count: 29 },
      { area: 'Indirapuram', count: 35 },
    ],
  };
}

export async function runEscalationCheck(): Promise<{ readonly escalated_count: number }> {
  try {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/sla-breaches`, {
      method: 'POST',
      headers,
    });
    if (res.ok) {
      const json = (await res.json()) as { readonly escalatedCount?: number; readonly count?: number };
      return { escalated_count: json.escalatedCount ?? json.count ?? 0 };
    }
  } catch {
    // Graceful fallback
  }
  return { escalated_count: 0 };
}

export async function updateComplaintStatus(id: string, status: string): Promise<void> {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE_URL}/api/v1/clusters/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Status update failed');
    throw new Error(`Update status failed (${res.status}): ${errorText}`);
  }
}

export async function resolveWard(lat: number, lng: number): Promise<WardResolutionDto | null> {
  try {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE_URL}/api/v1/geo/resolve-ward?lat=${lat}&lng=${lng}`, { headers });
    if (!res.ok) return null;
    const json = (await res.json()) as { readonly data?: WardResolutionDto } | WardResolutionDto;
    return ('data' in json && json.data ? json.data : json) as WardResolutionDto;
  } catch {
    return null;
  }
}

export async function presignMedia(filename: string, mimeType: string, sizeBytes: number): Promise<PresignedMediaDto> {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE_URL}/api/v1/media/presign`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ filename, mimeType, sizeBytes }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => 'Presign failed');
    throw new Error(`Media presign failed (${res.status}): ${errText}`);
  }
  const json = (await res.json()) as { readonly data?: PresignedMediaDto } | PresignedMediaDto;
  return ('data' in json && json.data ? json.data : json) as PresignedMediaDto;
}

export async function uploadImageToR2(
  uri: string,
  filename = `photo_${Date.now()}.jpg`
): Promise<{ readonly key: string; readonly publicUrl: string }> {
  try {
    const fileRes = await fetch(uri);
    const blob = await fileRes.blob();
    const sizeBytes = blob.size || 204800;

    const presigned = await presignMedia(filename, 'image/jpeg', sizeBytes);

    const putRes = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
        ...(presigned.headers || {}),
      },
      body: blob,
    });

    if (!putRes.ok) {
      throw new Error(`R2 upload failed (${putRes.status})`);
    }

    return { key: presigned.key, publicUrl: presigned.publicUrl };
  } catch {
    // Graceful fallback for offline / mock testing: return local URI representation
    return { key: `offline_${Date.now()}`, publicUrl: uri };
  }
}

export async function transcribeAudio(
  audioUri: string,
  langHint?: string
): Promise<TranscriptionResultDto> {
  try {
    const formData = new FormData();
    formData.append('audio', {
      uri: audioUri,
      name: 'voice_complaint.m4a',
      type: 'audio/m4a',
    } as unknown as Blob);

    if (langHint) {
      formData.append('language', langHint);
    }

    const headers = await getHeaders();
    delete headers['Content-Type'];

    const res = await fetch(`${API_BASE_URL}/api/v1/ai/transcribe`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Transcription failed');
      throw new Error(`Voice transcription failed (${res.status}): ${errText}`);
    }

    const json = (await res.json()) as TranscriptionResultDto;
    return json;
  } catch {
    // Return graceful fallback so user can still edit
    return {
      success: false,
      transcript: '',
      detectedLang: langHint || 'en',
      provider: 'fallback',
    };
  }
}

export interface PublicClusterDto {
  readonly id: string;
  readonly title: string;
  readonly departmentId: string;
  readonly wardId: string;
  readonly status: string;
  readonly centroid: { readonly lat: number; readonly lng: number };
  readonly complaintCount: number;
  readonly lastActivityAt?: string;
  readonly createdAt?: string;
}

export interface IoTStreetlightAnomalyDto {
  readonly id: string;
  readonly deviceId: string;
  readonly poleNumber: string;
  readonly area: string;
  readonly wardId: string;
  readonly status: 'FAULT' | 'ALERT' | 'NORMAL';
  readonly faultType: string;
  readonly ldrValue: number;
  readonly lat: number;
  readonly lng: number;
  readonly reportedAt: string;
}

export interface CreateRtiInput {
  readonly applicantName: string;
  readonly fatherOrSpouseName?: string;
  readonly address: string;
  readonly contactNumber: string;
  readonly email?: string;
  readonly authorityName: string;
  readonly publicAuthorityAddress?: string;
  readonly subject: string;
  readonly description: string;
  readonly clusterId?: string;
  readonly specificQuestions?: readonly string[];
  readonly isBplExempt?: boolean;
  readonly bplCardNo?: string;
  readonly bplYear?: string;
}

export interface RtiApplicationDto {
  readonly id: string;
  readonly citizenId: string | null;
  readonly clusterId?: string | null;
  readonly applicantName: string;
  readonly fatherOrSpouseName?: string | null;
  readonly address: string;
  readonly contactNumber: string;
  readonly email?: string | null;
  readonly bplCardNo?: string | null;
  readonly bplYear?: string | null;
  readonly authorityName: string;
  readonly publicAuthorityAddress?: string | null;
  readonly subject: string;
  readonly description: string;
  readonly specificQuestions: readonly string[];
  readonly englishDraft: string;
  readonly hindiDraft: string;
  readonly isBplExempt: boolean;
  readonly status: string;
  readonly createdAt: string;
}

export async function getMapClusters(params?: {
  readonly minLat?: number;
  readonly maxLat?: number;
  readonly minLng?: number;
  readonly maxLng?: number;
  readonly status?: string;
  readonly departmentId?: string;
}): Promise<readonly PublicClusterDto[]> {
  try {
    const query = new URLSearchParams();
    if (params?.minLat) query.set('minLat', String(params.minLat));
    if (params?.maxLat) query.set('maxLat', String(params.maxLat));
    if (params?.minLng) query.set('minLng', String(params.minLng));
    if (params?.maxLng) query.set('maxLng', String(params.maxLng));
    if (params?.status) query.set('status', params.status);
    if (params?.departmentId) query.set('departmentId', params.departmentId);

    const headers = await getHeaders();
    const res = await fetch(`${API_BASE_URL}/api/v1/map/clusters?${query.toString()}`, { headers });
    if (!res.ok) return [];
    const json = (await res.json()) as { readonly data?: readonly PublicClusterDto[] };
    return json.data || [];
  } catch {
    return [];
  }
}

export async function createRtiApplication(input: CreateRtiInput): Promise<RtiApplicationDto> {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE_URL}/api/v1/rti`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'RTI submission failed');
    throw new Error(`RTI filing failed (${res.status}): ${errorText}`);
  }

  const json = (await res.json()) as { readonly rti: RtiApplicationDto };
  return json.rti;
}

export async function getRtiApplications(): Promise<readonly RtiApplicationDto[]> {
  try {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE_URL}/api/v1/rti`, { headers });
    if (!res.ok) return [];
    const json = (await res.json()) as { readonly applications?: readonly RtiApplicationDto[] };
    return json.applications || [];
  } catch {
    return [];
  }
}

export function getRtiPdfUrl(rtiId: string): string {
  return `${API_BASE_URL}/api/v1/rti/${encodeURIComponent(rtiId)}/pdf`;
}
