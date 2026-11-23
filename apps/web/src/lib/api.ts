import type {
  Role,
  DepartmentName,
  ComplaintCategory,
  UrgencyLevel,
  ComplaintStatus,
} from '@jansetu/shared';

export type DepartmentCode = DepartmentName | string;
export type CategoryCode = ComplaintCategory | string;

export interface ApiProblemDetails {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly invalidParams?: Record<string, string[]>;
  readonly issues?: readonly { readonly path: readonly (string | number)[]; readonly message: string }[];
}

export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly title: string;
  readonly detail: string;
  readonly fieldErrors: Record<string, string[]>;
  readonly raw: unknown;

  constructor(statusCode: number, problem: ApiProblemDetails, raw?: unknown) {
    const title = problem.title || (statusCode >= 500 ? 'Server Error' : 'Request Error');
    const detail = problem.detail || 'An unexpected error occurred while communicating with JanSetu API';
    super(`${title} (${statusCode}): ${detail}`);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.title = title;
    this.detail = detail;
    this.raw = raw;

    const fieldErrors: Record<string, string[]> = {};
    if (problem.invalidParams) {
      Object.assign(fieldErrors, problem.invalidParams);
    }
    if (problem.issues && Array.isArray(problem.issues)) {
      for (const issue of problem.issues) {
        const key = issue.path.join('.') || 'general';
        fieldErrors[key] = fieldErrors[key] ? [...fieldErrors[key], issue.message] : [issue.message];
      }
    }
    this.fieldErrors = fieldErrors;
  }
}

export interface RequestOptions extends RequestInit {
  readonly timeoutMs?: number;
  readonly params?: Record<string, string | number | boolean | undefined | null>;
}

export interface AuthUserDto {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly phone: string | null;
  readonly wardId: string | null;
  readonly departmentId: string | null;
  readonly image: string | null;
}

export interface AuthSessionDto {
  readonly id: string;
  readonly userId: string;
  readonly token: string;
  readonly expiresAt: string | Date;
}

export interface AuthResponseDto {
  readonly user: AuthUserDto;
  readonly session: AuthSessionDto;
}

export interface MetaResponseDto {
  readonly departments: readonly {
    readonly code: DepartmentCode;
    readonly nameEn: string;
    readonly nameHi: string;
    readonly defaultSlaHours: number;
  }[];
  readonly categories: readonly {
    readonly code: CategoryCode;
    readonly defaultDepartment: DepartmentCode;
    readonly defaultUrgency: UrgencyLevel;
  }[];
  readonly urgencyPolicies: Record<UrgencyLevel, { readonly defaultHours: number; readonly description: string }>;
  readonly version: string;
}

export interface ComplaintDto {
  readonly id: string;
  readonly trackingCode: string;
  readonly clusterId: string | null;
  readonly departmentCode?: DepartmentCode;
  readonly departmentId?: string;
  readonly category: CategoryCode;
  readonly urgency: UrgencyLevel;
  readonly status: ComplaintStatus;
  readonly title?: string;
  readonly description: string;
  readonly publicLocation: {
    readonly wardId?: string | null;
    readonly approximateAddress?: string | null;
    readonly publicCoordinates?: { readonly latitude: number; readonly longitude: number };
    readonly lat?: number;
    readonly lng?: number;
  };
  readonly exactLocation?: {
    readonly latitude: number;
    readonly longitude: number;
    readonly address?: string | null;
    readonly lat?: number;
    readonly lng?: number;
  };
  readonly photoUrl?: string | null;
  readonly mediaUrls?: readonly string[];
  readonly audioUrl?: string | null;
  readonly slaDueAt: string;
  readonly escalationLevel?: number;
  readonly createdAt: string;
  readonly updatedAt?: string;
  readonly reporterPhone?: string | null;
  readonly reporterName?: string | null;
}

export interface CreateComplaintInputPayload {
  readonly idempotencyKey?: string;
  readonly text?: string;
  readonly description?: string;
  readonly departmentCode?: DepartmentCode;
  readonly department?: string;
  readonly departmentId?: string;
  readonly category?: CategoryCode;
  readonly issue_type?: CategoryCode;
  readonly urgency?: UrgencyLevel;
  readonly latitude?: number;
  readonly lat?: number;
  readonly longitude?: number;
  readonly lng?: number;
  readonly wardId?: string;
  readonly ward?: string;
  readonly area?: string;
  readonly city?: string;
  readonly photo_url?: string | null;
  readonly mediaUrls?: readonly string[];
  readonly audioUrl?: string;
  readonly reporterName?: string;
  readonly name?: string;
  readonly reporterPhone?: string;
  readonly phone?: string;
  readonly language?: 'en' | 'hi';
}

export interface ClusterTimelineEventDto {
  readonly id: string;
  readonly eventType: string;
  readonly actorId: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly createdAt: string;
}

export interface ClusterTimelineResponseDto {
  readonly clusterId: string;
  readonly events: readonly ClusterTimelineEventDto[];
}

export interface MapClusterDto {
  readonly id: string;
  readonly title?: string;
  readonly departmentCode?: DepartmentCode;
  readonly departmentId?: string;
  readonly status: ComplaintStatus;
  readonly urgency?: UrgencyLevel;
  readonly complaintCount: number;
  readonly centroid: {
    readonly latitude?: number;
    readonly longitude?: number;
    readonly lat?: number;
    readonly lng?: number;
  };
  readonly wardId: string | null;
  readonly updatedAt?: string;
  readonly lastActivityAt?: string;
  readonly createdAt?: string;
}

export interface RtiApplicationDto {
  readonly id: string;
  readonly applicantName: string;
  readonly address: string;
  readonly contactNumber: string;
  readonly email?: string;
  readonly authorityName: string;
  readonly subject: string;
  readonly description: string;
  readonly status: string;
  readonly isBplExempt: boolean;
  readonly bplCardNo?: string;
  readonly clusterId?: string | null;
  readonly englishDraft?: string;
  readonly hindiDraft?: string;
  readonly createdAt: string;
  readonly questions?: readonly { readonly id: string; readonly questionText: string }[];
}

export interface RtiDraftDto {
  readonly id?: string;
  readonly subject: string;
  readonly authorityName: string;
  readonly language: 'en' | 'hi';
  readonly statutoryText: string;
  readonly questions: readonly string[];
  readonly isBplExempt: boolean;
  readonly bplCardNumber?: string;
  readonly englishDraft: string;
  readonly hindiDraft: string;
  readonly pdfUrl?: string;
}

export interface AiClassificationDto {
  readonly departmentCode: DepartmentCode;
  readonly category: CategoryCode;
  readonly urgency: UrgencyLevel;
  readonly summaryEn: string;
  readonly summaryHi: string;
  readonly confidence: number;
}

export interface AiClassifyResponseDto {
  readonly success: boolean;
  readonly classification: AiClassificationDto;
  readonly provider: string;
  readonly latencyMs: number;
  readonly fallbackReason: string | null;
}

export interface AiRtiDraftResponseDto {
  readonly success: boolean;
  readonly draft: RtiDraftDto;
  readonly provider: string;
  readonly latencyMs: number;
  readonly fallbackReason: string | null;
}

export interface PresignedMediaResponseDto {
  readonly uploadUrl: string;
  readonly key: string;
  readonly publicUrl: string;
  readonly headers: Record<string, string>;
  readonly maxSizeBytes: number;
}

export interface RealtimeTokenDto {
  readonly token: string;
  readonly expiresAt: number;
  readonly clientId: string;
  readonly channels: readonly string[];
  readonly isMock?: boolean;
}

export interface DepartmentAnalyticsDto {
  readonly id: string;
  readonly name: string;
  readonly totalComplaints: number;
  readonly resolvedComplaints: number;
  readonly pendingComplaints: number;
  readonly resolutionRatePercent: number;
}

export interface SlaBreachItemDto {
  readonly complaintId: string;
  readonly trackingCode: string;
  readonly title?: string;
  readonly category?: string;
  readonly urgency: UrgencyLevel | string;
  readonly status?: string;
  readonly wardId?: string;
  readonly departmentId?: string;
  readonly slaDueAt: string;
  readonly overdueHours?: number;
  readonly escalationLevel?: number;
}

export interface AdminAnalyticsDto {
  readonly totalComplaints?: number;
  readonly totalClusters?: number;
  readonly resolvedComplaints?: number;
  readonly activeComplaints?: number;
  readonly overallResolutionRatePercent?: number;
  readonly statusBreakdown?: Record<ComplaintStatus, number>;
  readonly urgencyBreakdown?: Record<UrgencyLevel, number>;
  readonly departmentAnalytics?: readonly DepartmentAnalyticsDto[];
  readonly averageResolutionHours?: number;
  readonly complaints?: {
    readonly total: number;
    readonly resolved: number;
    readonly pending: number;
    readonly escalated: number;
  };
  readonly clusters?: {
    readonly total: number;
    readonly active: number;
  };
  readonly generatedAt?: string;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;

  constructor(baseUrl = '', defaultTimeoutMs = 15000) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  private getAuthToken(): string | null {
    try {
      return localStorage.getItem('jansetu_token');
    } catch {
      return null;
    }
  }

  public async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { timeoutMs = this.defaultTimeoutMs, params, ...fetchInit } = options;

    let url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, val] of Object.entries(params)) {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    const headers = new Headers(fetchInit.headers ?? {});
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    const token = this.getAuthToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const isFormData = fetchInit.body instanceof FormData;
    if (!isFormData && fetchInit.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => {
      controller.abort(new Error(`JanSetu API request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      const res = await fetch(url, {
        ...fetchInit,
        headers,
        credentials: 'include',
        signal: controller.signal,
      });

      if (!res.ok) {
        let problem: ApiProblemDetails = {};
        try {
          problem = (await res.json()) as ApiProblemDetails;
        } catch {
          problem = {
            title: res.statusText,
            detail: `HTTP error ${res.status}`,
          };
        }
        throw new ApiClientError(res.status, problem);
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return (await res.json()) as T;
      }
      return (await res.text()) as unknown as T;
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        throw err;
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ApiClientError(408, {
          title: 'Request Timeout',
          detail: `The request exceeded ${timeoutMs}ms and was aborted`,
        });
      }
      const message = err instanceof Error ? err.message : 'Network error';
      throw new ApiClientError(0, {
        title: 'Network Error',
        detail: message,
      });
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  // --- Auth APIs ---
  readonly auth = {
    signIn: (body: { email: string; password: string }) =>
      this.request<AuthResponseDto>('/api/auth/sign-in/email', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    signUp: (body: {
      name: string;
      email: string;
      password: string;
      role?: Role;
      phone?: string;
      wardId?: string;
      departmentId?: string;
    }) =>
      this.request<AuthResponseDto>('/api/auth/sign-up/email', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    signOut: () =>
      this.request<{ success: boolean }>('/api/auth/sign-out', {
        method: 'POST',
      }),

    getSession: () =>
      this.request<AuthResponseDto | null>('/api/auth/get-session', {
        method: 'GET',
      }),
  };

  // --- Meta APIs ---
  readonly meta = {
    getMeta: () => this.request<MetaResponseDto>('/api/v1/meta'),
  };

  // --- Complaints APIs ---
  readonly complaints = {
    create: (payload: CreateComplaintInputPayload) => {
      const idempotencyKey =
        payload.idempotencyKey ||
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

      const text = payload.text || payload.description || '';
      const name = payload.name || payload.reporterName || 'Citizen';
      const phone = payload.phone || payload.reporterPhone;
      const category = payload.category || payload.issue_type || 'Road Damage';
      const urgency = payload.urgency || 'MEDIUM';
      const department = payload.department || payload.departmentCode || 'Public Works Department (PWD)';
      const area = payload.area || 'Indirapuram';
      const wardId = payload.wardId || payload.ward || 'ward-04';
      const lat = payload.lat ?? payload.latitude ?? 28.628;
      const lng = payload.lng ?? payload.longitude ?? 77.3649;
      const photo_url = payload.photo_url ?? (payload.mediaUrls?.[0] ?? null);

      const normalizedBody = {
        idempotency_key: idempotencyKey,
        name,
        phone,
        text,
        area,
        wardId,
        ward: wardId,
        city: payload.city || 'Ghaziabad / Delhi NCR',
        category,
        issue_type: category,
        urgency,
        department,
        departmentId: payload.departmentId || 'dept-pwd',
        summary: text.slice(0, 150),
        lat,
        latitude: lat,
        lng,
        longitude: lng,
        photo_url,
        language: payload.language || 'en',
      };

      return this.request<ComplaintDto>('/api/v1/complaints', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(normalizedBody),
      });
    },

    list: async (params?: {
      status?: ComplaintStatus;
      department?: DepartmentCode;
      urgency?: UrgencyLevel;
      wardId?: string;
      search?: string;
      page?: number;
      limit?: number;
    }): Promise<{
      complaints: readonly ComplaintDto[];
      total: number;
      page: number;
      limit: number;
    }> => {
      const res = await this.request<{
        data?: readonly ComplaintDto[];
        complaints?: readonly ComplaintDto[];
        items?: readonly ComplaintDto[];
        total?: number;
        pagination?: { total: number; page: number; limit: number };
      }>('/api/v1/complaints', {
        method: 'GET',
        params,
      });

      const items = res.data || res.complaints || res.items || [];
      const total = res.pagination?.total ?? res.total ?? items.length;
      const page = res.pagination?.page ?? params?.page ?? 1;
      const limit = res.pagination?.limit ?? params?.limit ?? 20;

      return {
        complaints: items,
        total,
        page,
        limit,
      };
    },

    getByTrackingCode: (code: string) =>
      this.request<ComplaintDto>(`/api/v1/complaints/${encodeURIComponent(code)}`),
  };

  // --- Clusters & Map APIs ---
  readonly clusters = {
    getTimeline: (clusterId: string) =>
      this.request<ClusterTimelineResponseDto>(`/api/v1/clusters/${encodeURIComponent(clusterId)}/timeline`),

    assign: (clusterId: string, payload: { officerId: string; notes?: string }) =>
      this.request<{ success: boolean }>(`/api/v1/clusters/${encodeURIComponent(clusterId)}/assign`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),

    updateStatus: (clusterId: string, payload: { status: ComplaintStatus; notes?: string }) =>
      this.request<{ success: boolean; newStatus: ComplaintStatus }>(
        `/api/v1/clusters/${encodeURIComponent(clusterId)}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      ),

    getMapClusters: async (params?: {
      minLat?: number;
      maxLat?: number;
      minLng?: number;
      maxLng?: number;
      department?: DepartmentCode;
      status?: ComplaintStatus;
    }): Promise<{ clusters: readonly MapClusterDto[] }> => {
      const res = await this.request<{ clusters?: readonly MapClusterDto[]; data?: readonly MapClusterDto[] }>(
        '/api/v1/map/clusters',
        {
          method: 'GET',
          params,
        }
      );
      const clusters = res.data ?? res.clusters ?? [];
      return { clusters };
    },
  };

  // --- Statutory RTI APIs ---
  readonly rti = {
    create: (payload: {
      applicantName: string;
      fatherOrSpouseName?: string;
      address: string;
      contactNumber: string;
      email?: string;
      authorityName: string;
      publicAuthorityAddress?: string;
      subject: string;
      description: string;
      clusterId?: string;
      specificQuestions?: readonly string[];
      isBplExempt?: boolean;
      bplCardNo?: string;
      bplYear?: string;
    }) =>
      this.request<{ rti: RtiApplicationDto }>('/api/v1/rti', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    list: (params?: { limit?: number }) =>
      this.request<{ applications: readonly RtiApplicationDto[]; total: number }>('/api/v1/rti', {
        method: 'GET',
        params,
      }),

    getPdfUrl: (id: string) => `${this.baseUrl}/api/v1/rti/${encodeURIComponent(id)}/pdf`,

    downloadPdf: async (id: string, filename = `rti-section6-${id}.pdf`): Promise<void> => {
      const token = this.getAuthToken();
      const headers = new Headers();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const res = await fetch(`${this.baseUrl}/api/v1/rti/${encodeURIComponent(id)}/pdf`, {
        headers,
        credentials: 'include',
      });

      if (!res.ok) {
        throw new ApiClientError(res.status, {
          title: 'PDF Download Failed',
          detail: `Server returned HTTP ${res.status}`,
        });
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    },
  };

  // --- AI Gateway APIs ---
  readonly ai = {
    classify: (payload: { text: string; lang?: 'en' | 'hi' | 'auto' }) =>
      this.request<AiClassifyResponseDto>('/api/v1/ai/classify', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    draftRti: (payload: {
      subject: string;
      authorityName: string;
      language: 'en' | 'hi';
      specificQuestions?: readonly string[];
      isBplExempt?: boolean;
      bplCardNumber?: string;
      complaintDetails?: string;
    }) =>
      this.request<AiRtiDraftResponseDto>('/api/v1/ai/rti-draft', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    transcribe: (formData: FormData) =>
      this.request<{
        success: boolean;
        transcript: string;
        detectedLang: string;
        translatedEn: string;
        translatedHi: string;
        provider: string;
      }>('/api/v1/ai/transcribe', {
        method: 'POST',
        body: formData,
      }),

    verifyHazard: (payload: { r2Key: string; claimedCategory?: string }) =>
      this.request<{
        success: boolean;
        verification: {
          isCivicIssue: boolean;
          detectedHazard: string;
          severityBoost: boolean;
          confidence: number;
          labels: readonly string[];
        };
        provider: string;
      }>('/api/v1/ai/verify-hazard', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  };

  // --- Media Presigning & Upload ---
  readonly media = {
    presign: (payload: { filename: string; contentType: string; sizeBytes: number }) =>
      this.request<PresignedMediaResponseDto>('/api/v1/media/presign', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    upload: async (file: File): Promise<{ key: string; publicUrl: string }> => {
      const presigned = await this.media.presign({
        filename: file.name,
        contentType: file.type || 'image/jpeg',
        sizeBytes: file.size,
      });

      const uploadRes = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'image/jpeg',
          ...presigned.headers,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new ApiClientError(uploadRes.status, {
          title: 'Media Upload Failed',
          detail: `Failed to upload media to storage (${uploadRes.statusText})`,
        });
      }

      return {
        key: presigned.key,
        publicUrl: presigned.publicUrl,
      };
    },
  };

  // --- Geo Reverse Ward Resolution ---
  readonly geo = {
    resolveWard: (lat: number, lng: number) =>
      this.request<{
        wardId: string;
        wardName: string;
        zone: string;
        confidence: number;
      }>('/api/v1/geo/resolve-ward', {
        params: { lat, lng },
      }),
  };

  // --- Realtime WebSocket / Ably Token ---
  readonly realtime = {
    getToken: (trackingCode?: string) =>
      this.request<RealtimeTokenDto>('/api/v1/realtime/token', {
        params: { trackingCode },
      }),
  };

  // --- Admin Analytics & SLA ---
  readonly admin = {
    getAnalytics: () => this.request<AdminAnalyticsDto>('/api/v1/admin/analytics'),
    getSlaBreaches: () =>
      this.request<{
        count?: number;
        breaches: readonly SlaBreachItemDto[];
      }>('/api/v1/admin/sla-breaches'),
  };
}

export const api = new ApiClient();
