import type { ComplaintDto, CreateComplaintInput } from '../lib/api-client';
import { getOfflineDatabase } from './database';
import type {
  CachedComplaintRecord,
  OfflineDatabaseAdapter,
  OutboxItem,
  OutboxRecord,
  SyncResult,
  SyncStatus,
} from './types';

export const MAX_SYNC_RETRIES = 5;
export const BASE_RETRY_DELAY_MS = 1000;
export const MAX_RETRY_DELAY_MS = 30000;

export function calculateBackoffDelay(
  retryCount: number,
  baseDelayMs = BASE_RETRY_DELAY_MS,
  maxDelayMs = MAX_RETRY_DELAY_MS
): number {
  if (retryCount <= 0) return baseDelayMs;
  const delay = baseDelayMs * Math.pow(2, retryCount);
  return Math.min(delay, maxDelayMs);
}

export function generateUUID(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function parseOutboxRecord(record: OutboxRecord): OutboxItem {
  let parsedPayload: CreateComplaintInput;
  try {
    parsedPayload = JSON.parse(record.payload) as CreateComplaintInput;
  } catch {
    parsedPayload = {
      citizenName: 'Anonymous',
      rawText: 'Corrupted payload',
      language: 'en',
      issueType: 'Other',
      summary: '',
      urgency: 'MEDIUM',
      department: 'General',
      area: 'Delhi NCR',
      ward: 'ward-04',
    };
  }

  let parsedImages: string[];
  try {
    parsedImages = JSON.parse(record.local_image_uris) as string[];
  } catch {
    parsedImages = [];
  }

  return {
    id: record.id,
    idempotencyKey: record.idempotency_key,
    payload: parsedPayload,
    localImageUris: parsedImages,
    retryCount: record.retry_count,
    lastError: record.last_error,
    syncStatus: record.sync_status,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function complaintDtoToCachedRecord(dto: ComplaintDto): CachedComplaintRecord {
  const now = new Date().toISOString();
  return {
    id: dto.id,
    tracking_code: dto.trackingCode || dto.id,
    citizen_phone: dto.citizen_phone || null,
    title: dto.summary || dto.description || 'Grievance',
    description: dto.description || dto.summary || '',
    status: dto.status || 'PENDING',
    category: String(dto.category || 'General Complaint'),
    urgency: String(dto.urgency || 'MEDIUM'),
    ward_id: dto.publicLocation?.wardId || dto.ward || null,
    ward_name: dto.ward || null,
    latitude: dto.publicLocation?.publicCoordinates?.latitude ?? (typeof dto.lat === 'number' ? dto.lat : null),
    longitude: dto.publicLocation?.publicCoordinates?.longitude ?? (typeof dto.lng === 'number' ? dto.lng : null),
    media_urls: JSON.stringify(dto.photoUrl ? [dto.photoUrl] : []),
    data_json: JSON.stringify(dto),
    created_at: dto.createdAt || dto.created_at || now,
    updated_at: dto.updatedAt || dto.updated_at || now,
  };
}

export async function enqueueComplaint(
  payload: CreateComplaintInput,
  localImageUris: readonly string[] = [],
  idempotencyKey?: string,
  db: OfflineDatabaseAdapter = getOfflineDatabase()
): Promise<OutboxItem> {
  await db.init();
  const key = idempotencyKey || payload.idempotencyKey || generateUUID();
  const now = new Date().toISOString();

  const record: OutboxRecord = {
    id: `outbox_${key}`,
    idempotency_key: key,
    payload: JSON.stringify({ ...payload, idempotencyKey: key }),
    local_image_uris: JSON.stringify(localImageUris),
    retry_count: 0,
    last_error: null,
    sync_status: 'PENDING',
    created_at: now,
    updated_at: now,
  };

  await db.insertOutbox(record);
  return parseOutboxRecord(record);
}

export async function processSingleOutboxItem(
  item: OutboxItem,
  db: OfflineDatabaseAdapter = getOfflineDatabase(),
  customUploader?: (uri: string) => Promise<{ publicUrl: string }>,
  customCreator?: (payload: CreateComplaintInput) => Promise<{ trackingCode: string; id: string }>
): Promise<{ readonly success: boolean; readonly error?: string; readonly complaint?: ComplaintDto }> {
  // 1. Mark status as SYNCING
  await db.updateOutboxStatus(item.idempotencyKey, 'SYNCING', null, false);

  try {
    let finalPhotoUrl = item.payload.photoUrl;

    // 2. Upload any local images to Cloudflare R2
    if (item.localImageUris && item.localImageUris.length > 0 && !finalPhotoUrl) {
      for (const uri of item.localImageUris) {
        if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('/')) {
          try {
            const uploadFn = customUploader || (await import('../lib/api-client')).uploadImageToR2;
            const res = await uploadFn(uri);
            if (res.publicUrl) {
              finalPhotoUrl = res.publicUrl;
              break;
            }
          } catch (uploadErr) {
            // Log and allow fallback or bubble error
            const errText = uploadErr instanceof Error ? uploadErr.message : 'Media upload failed';
            throw new Error(`Local media upload failed: ${errText}`);
          }
        }
      }
    }

    // 3. Post complaint with preserved idempotencyKey
    const createFn = customCreator || (await import('../lib/api-client')).createComplaint;
    const submissionPayload: CreateComplaintInput = {
      ...item.payload,
      idempotencyKey: item.idempotencyKey,
      photoUrl: finalPhotoUrl || item.payload.photoUrl || null,
    };

    const result = await createFn(submissionPayload);

    // 4. Mark status as SYNCED
    await db.updateOutboxStatus(item.idempotencyKey, 'SYNCED', null, false);

    // 5. Cache the synced complaint
    const syncedComplaint: ComplaintDto = {
      id: result.id,
      trackingCode: result.trackingCode,
      category: item.payload.issueType,
      urgency: item.payload.urgency,
      status: 'PENDING',
      summary: item.payload.summary,
      description: item.payload.rawText,
      citizen_name: item.payload.citizenName,
      citizen_phone: item.payload.citizenPhone,
      area: item.payload.area,
      ward: item.payload.ward,
      photoUrl: finalPhotoUrl || null,
      audioUrl: item.payload.audioUrl || null,
      slaDueAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      clusterId: null,
      createdAt: new Date().toISOString(),
    };

    await db.upsertCachedComplaint(complaintDtoToCachedRecord(syncedComplaint));

    return { success: true, complaint: syncedComplaint };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Network sync error';
    const nextRetry = item.retryCount + 1;

    if (nextRetry >= MAX_SYNC_RETRIES) {
      // Mark permanently FAILED (requires manual user retry)
      await db.updateOutboxStatus(item.idempotencyKey, 'FAILED', errorMsg, false);
    } else {
      // Revert to PENDING with incremented retry count for backoff
      await db.updateOutboxStatus(item.idempotencyKey, 'PENDING', errorMsg, true);
    }

    return { success: false, error: errorMsg };
  }
}

export async function processOutboxQueue(
  options?: {
    readonly db?: OfflineDatabaseAdapter;
    readonly force?: boolean;
    readonly maxItems?: number;
    readonly customUploader?: (uri: string) => Promise<{ publicUrl: string }>;
    readonly customCreator?: (payload: CreateComplaintInput) => Promise<{ trackingCode: string; id: string }>;
  }
): Promise<SyncResult> {
  const db = options?.db || getOfflineDatabase();
  await db.init();

  const statusesToSync: SyncStatus[] = options?.force
    ? ['PENDING', 'FAILED']
    : ['PENDING'];

  const records = await db.getOutboxItems(statusesToSync);
  const items = records.map(parseOutboxRecord);

  let succeeded = 0;
  let failed = 0;
  const errors: { idempotencyKey: string; error: string }[] = [];

  const limit = options?.maxItems ? Math.min(options.maxItems, items.length) : items.length;

  for (let i = 0; i < limit; i++) {
    const item = items[i];
    const res = await processSingleOutboxItem(
      item,
      db,
      options?.customUploader,
      options?.customCreator
    );
    if (res.success) {
      succeeded++;
    } else {
      failed++;
      errors.push({
        idempotencyKey: item.idempotencyKey,
        error: res.error || 'Sync failed',
      });
    }
  }

  return {
    processed: succeeded + failed,
    succeeded,
    failed,
    errors,
  };
}

export async function getCachedComplaintsList(
  db: OfflineDatabaseAdapter = getOfflineDatabase()
): Promise<ComplaintDto[]> {
  await db.init();
  const records = await db.getCachedComplaints();
  return records.map((r) => {
    try {
      return JSON.parse(r.data_json) as ComplaintDto;
    } catch {
      return {
        id: r.id,
        trackingCode: r.tracking_code,
        category: r.category,
        urgency: r.urgency as ComplaintDto['urgency'],
        status: r.status as ComplaintDto['status'],
        summary: r.title,
        description: r.description,
        ward: r.ward_name || undefined,
        area: r.ward_name || undefined,
        slaDueAt: new Date().toISOString(),
        clusterId: null,
        createdAt: r.created_at,
      };
    }
  });
}
