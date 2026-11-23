import type { ComplaintDto, CreateComplaintInput } from '../lib/api-client';

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface OutboxRecord {
  readonly id: string;
  readonly idempotency_key: string;
  readonly payload: string; // JSON string of CreateComplaintInput
  readonly local_image_uris: string; // JSON string of string[]
  readonly retry_count: number;
  readonly last_error: string | null;
  readonly sync_status: SyncStatus;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface OutboxItem {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly payload: CreateComplaintInput;
  readonly localImageUris: readonly string[];
  readonly retryCount: number;
  readonly lastError: string | null;
  readonly syncStatus: SyncStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CachedComplaintRecord {
  readonly id: string;
  readonly tracking_code: string;
  readonly citizen_phone: string | null;
  readonly title: string;
  readonly description: string;
  readonly status: string;
  readonly category: string;
  readonly urgency: string;
  readonly ward_id: string | null;
  readonly ward_name: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly media_urls: string; // JSON string of string[]
  readonly data_json: string; // JSON string of ComplaintDto
  readonly created_at: string;
  readonly updated_at: string;
}

export interface OfflineDatabaseAdapter {
  init(): Promise<void>;
  insertOutbox(record: OutboxRecord): Promise<void>;
  getOutboxItems(filterStatus?: SyncStatus[]): Promise<OutboxRecord[]>;
  getOutboxItemByIdempotencyKey(key: string): Promise<OutboxRecord | null>;
  updateOutboxStatus(
    key: string,
    status: SyncStatus,
    lastError?: string | null,
    incrementRetry?: boolean
  ): Promise<void>;
  deleteOutboxItem(key: string): Promise<void>;
  upsertCachedComplaint(record: CachedComplaintRecord): Promise<void>;
  getCachedComplaints(): Promise<CachedComplaintRecord[]>;
  getCachedComplaintByTrackingCode(trackingCode: string): Promise<CachedComplaintRecord | null>;
  clearAll(): Promise<void>;
}

export interface SyncResult {
  readonly processed: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly errors: readonly { readonly idempotencyKey: string; readonly error: string }[];
}
