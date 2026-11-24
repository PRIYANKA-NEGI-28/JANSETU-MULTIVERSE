import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryDatabaseAdapter } from '../database';
import {
  calculateBackoffDelay,
  enqueueComplaint,
  parseOutboxRecord,
  processSingleOutboxItem,
  processOutboxQueue,
  MAX_SYNC_RETRIES,
  MAX_RETRY_DELAY_MS,
} from '../syncEngine';
import type { CreateComplaintInput } from '../../lib/api-client';

describe('Offline Outbox & Sync Engine', () => {
  let db: MemoryDatabaseAdapter;

  const mockComplaintInput: CreateComplaintInput = {
    citizenName: 'Rahul Sharma',
    citizenPhone: '9876543210',
    rawText: 'Severe waterlogging and open manhole near block C market',
    language: 'en',
    issueType: 'Drainage & Sewage',
    summary: 'Waterlogging and open manhole',
    urgency: 'HIGH',
    department: 'Delhi Jal Board',
    area: 'Lajpat Nagar',
    ward: 'ward-04',
  };

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await db.init();
  });

  describe('1. Retry Backoff Logic (calculateBackoffDelay)', () => {
    it('returns base delay for retry count 0 or negative values', () => {
      expect(calculateBackoffDelay(0)).toBe(1000);
      expect(calculateBackoffDelay(-1)).toBe(1000);
      expect(calculateBackoffDelay(-5)).toBe(1000);
    });

    it('calculates exponential delay 2^retryCount * baseDelay', () => {
      expect(calculateBackoffDelay(1)).toBe(2000); // 1000 * 2^1
      expect(calculateBackoffDelay(2)).toBe(4000); // 1000 * 2^2
      expect(calculateBackoffDelay(3)).toBe(8000); // 1000 * 2^3
      expect(calculateBackoffDelay(4)).toBe(16000); // 1000 * 2^4
    });

    it('strictly caps the backoff delay at maxDelayMs (30,000ms)', () => {
      // 1000 * 2^5 = 32000 > 30000 -> capped at 30000
      expect(calculateBackoffDelay(5)).toBe(MAX_RETRY_DELAY_MS);
      expect(calculateBackoffDelay(6)).toBe(MAX_RETRY_DELAY_MS);
      expect(calculateBackoffDelay(10)).toBe(MAX_RETRY_DELAY_MS);
      expect(calculateBackoffDelay(20)).toBe(MAX_RETRY_DELAY_MS);
    });

    it('respects custom base and max delay parameters', () => {
      const customBase = 500;
      const customMax = 5000;

      expect(calculateBackoffDelay(0, customBase, customMax)).toBe(500);
      expect(calculateBackoffDelay(1, customBase, customMax)).toBe(1000);
      expect(calculateBackoffDelay(2, customBase, customMax)).toBe(2000);
      expect(calculateBackoffDelay(3, customBase, customMax)).toBe(4000);
      expect(calculateBackoffDelay(4, customBase, customMax)).toBe(5000); // capped
    });
  });

  describe('2. Outbox State Transitions & Persistence', () => {
    it('enqueues complaint into outbox with PENDING status and retry count 0', async () => {
      const item = await enqueueComplaint(mockComplaintInput, ['file:///photo1.jpg'], undefined, db);

      expect(item.syncStatus).toBe('PENDING');
      expect(item.retryCount).toBe(0);
      expect(item.lastError).toBeNull();
      expect(item.idempotencyKey).toBeDefined();
      expect(item.idempotencyKey.length).toBeGreaterThan(10);
      expect(item.localImageUris).toEqual(['file:///photo1.jpg']);

      const stored = await db.getOutboxItemByIdempotencyKey(item.idempotencyKey);
      expect(stored).not.toBeNull();
      expect(stored?.sync_status).toBe('PENDING');
      expect(stored?.retry_count).toBe(0);
    });

    it('transitions PENDING -> SYNCED upon successful submission and caches the complaint', async () => {
      const item = await enqueueComplaint(mockComplaintInput, [], undefined, db);

      const customCreator = async (_payload: CreateComplaintInput) => {
        return {
          trackingCode: 'JS-2026-DEL-8888',
          id: 'complaint_8888',
        };
      };

      const result = await processSingleOutboxItem(item, db, undefined, customCreator);

      expect(result.success).toBe(true);
      expect(result.complaint?.trackingCode).toBe('JS-2026-DEL-8888');

      // Verify status in DB transitioned to SYNCED
      const updated = await db.getOutboxItemByIdempotencyKey(item.idempotencyKey);
      expect(updated?.sync_status).toBe('SYNCED');
      expect(updated?.last_error).toBeNull();

      // Verify cached in SQLite cached_complaints table
      const cached = await db.getCachedComplaintByTrackingCode('JS-2026-DEL-8888');
      expect(cached).not.toBeNull();
      expect(cached?.title).toBe(mockComplaintInput.summary);
      expect(cached?.status).toBe('PENDING');
    });

    it('transitions PENDING -> PENDING (with incremented retry count) on transient failure', async () => {
      const item = await enqueueComplaint(mockComplaintInput, [], undefined, db);

      const failingCreator = async () => {
        throw new Error('503 Service Unavailable: Database lock');
      };

      const result = await processSingleOutboxItem(item, db, undefined, failingCreator);

      expect(result.success).toBe(false);
      expect(result.error).toContain('503 Service Unavailable');

      const updated = await db.getOutboxItemByIdempotencyKey(item.idempotencyKey);
      expect(updated?.sync_status).toBe('PENDING');
      expect(updated?.retry_count).toBe(1);
      expect(updated?.last_error).toContain('503 Service Unavailable');
    });

    it('transitions to FAILED when retry count reaches MAX_SYNC_RETRIES (5)', async () => {
      const item = await enqueueComplaint(mockComplaintInput, [], undefined, db);

      const failingCreator = async () => {
        throw new Error('Network timeout (ETIMEDOUT)');
      };

      // Simulate 5 successive failures
      let currentItem = item;
      for (let attempt = 1; attempt <= MAX_SYNC_RETRIES; attempt++) {
        const res = await processSingleOutboxItem(currentItem, db, undefined, failingCreator);
        expect(res.success).toBe(false);

        const record = await db.getOutboxItemByIdempotencyKey(item.idempotencyKey);
        expect(record).not.toBeNull();
        if (attempt < MAX_SYNC_RETRIES) {
          expect(record?.sync_status).toBe('PENDING');
          expect(record?.retry_count).toBe(attempt);
        } else {
          expect(record?.sync_status).toBe('FAILED');
          expect(record?.last_error).toContain('Network timeout');
        }
        currentItem = parseOutboxRecord(record!);
      }
    });

    it('allows a FAILED item to be re-synced and transition to SYNCED', async () => {
      const item = await enqueueComplaint(mockComplaintInput, [], undefined, db);

      // Force to FAILED state
      await db.updateOutboxStatus(item.idempotencyKey, 'FAILED', 'Fatal network crash', false);

      const failedRecord = await db.getOutboxItemByIdempotencyKey(item.idempotencyKey);
      expect(failedRecord?.sync_status).toBe('FAILED');

      // Now sync succeeds
      const recoveryCreator = async () => ({
        trackingCode: 'JS-2026-RECOVERED',
        id: 'complaint_recovered',
      });

      const res = await processSingleOutboxItem(
        parseOutboxRecord(failedRecord!),
        db,
        undefined,
        recoveryCreator
      );
      expect(res.success).toBe(true);

      const recovered = await db.getOutboxItemByIdempotencyKey(item.idempotencyKey);
      expect(recovered?.sync_status).toBe('SYNCED');
    });
  });

  describe('3. Idempotency Key Preservation Across Retries', () => {
    it('strictly preserves the caller-provided idempotencyKey', async () => {
      const explicitKey = 'client-idempotent-uuid-9999';
      const item = await enqueueComplaint(
        mockComplaintInput,
        [],
        explicitKey,
        db
      );

      expect(item.idempotencyKey).toBe(explicitKey);
      const record = await db.getOutboxItemByIdempotencyKey(explicitKey);
      expect(record?.idempotency_key).toBe(explicitKey);
    });

    it('preserves the EXACT same idempotency key across all retry attempts', async () => {
      const capturedKeys: string[] = [];

      const trackingCreator = async (payload: CreateComplaintInput) => {
        if (payload.idempotencyKey) {
          capturedKeys.push(payload.idempotencyKey);
        }
        if (capturedKeys.length < 3) {
          throw new Error('Temporary gateway timeout 504');
        }
        return {
          trackingCode: 'JS-2026-IDEM-OK',
          id: 'complaint_idem',
        };
      };

      const item = await enqueueComplaint(mockComplaintInput, [], undefined, db);
      const initialKey = item.idempotencyKey;
      expect(initialKey).toBeDefined();

      // Attempt 1: Fails
      let record = await db.getOutboxItemByIdempotencyKey(initialKey);
      await processSingleOutboxItem(parseOutboxRecord(record!), db, undefined, trackingCreator);

      // Attempt 2: Fails
      record = await db.getOutboxItemByIdempotencyKey(initialKey);
      await processSingleOutboxItem(parseOutboxRecord(record!), db, undefined, trackingCreator);

      // Attempt 3: Succeeds
      record = await db.getOutboxItemByIdempotencyKey(initialKey);
      const successRes = await processSingleOutboxItem(
        parseOutboxRecord(record!),
        db,
        undefined,
        trackingCreator
      );

      expect(successRes.success).toBe(true);
      expect(capturedKeys.length).toBe(3);

      // CRITICAL ASSERTION: All 3 attempts MUST have received the IDENTICAL idempotency key
      expect(capturedKeys[0]).toBe(initialKey);
      expect(capturedKeys[1]).toBe(initialKey);
      expect(capturedKeys[2]).toBe(initialKey);

      // Outbox item's key remains immutable in database
      const finalRecord = await db.getOutboxItemByIdempotencyKey(initialKey);
      expect(finalRecord?.idempotency_key).toBe(initialKey);
      expect(finalRecord?.sync_status).toBe('SYNCED');
    });
  });

  describe('4. Batch Queue Processing & Media Upload', () => {
    it('uploads local media before submitting complaint', async () => {
      const uploadedUris: string[] = [];
      const customUploader = async (uri: string) => {
        uploadedUris.push(uri);
        return { publicUrl: 'https://r2.jansetu.gov.in/complaints/waterlog.jpg' };
      };

      let submittedPhotoUrl: string | null = null;
      const customCreator = async (payload: CreateComplaintInput) => {
        submittedPhotoUrl = payload.photoUrl || null;
        return {
          trackingCode: 'JS-PHOTO-TEST',
          id: 'comp_photo',
        };
      };

      const item = await enqueueComplaint(
        mockComplaintInput,
        ['file:///local/storage/waterlog.jpg'],
        undefined,
        db
      );

      const res = await processSingleOutboxItem(item, db, customUploader, customCreator);

      expect(res.success).toBe(true);
      expect(uploadedUris).toEqual(['file:///local/storage/waterlog.jpg']);
      expect(submittedPhotoUrl).toBe('https://r2.jansetu.gov.in/complaints/waterlog.jpg');
    });

    it('processes batch queue and handles mixed successes and failures', async () => {
      // Item 1: will succeed
      await enqueueComplaint(
        { ...mockComplaintInput, summary: 'Item 1' },
        [],
        'item-1-success',
        db
      );

      // Item 2: will fail
      await enqueueComplaint(
        { ...mockComplaintInput, summary: 'Item 2' },
        [],
        'item-2-fail',
        db
      );

      const customCreator = async (payload: CreateComplaintInput) => {
        if (payload.idempotencyKey === 'item-2-fail') {
          throw new Error('Connection refused to API');
        }
        return {
          trackingCode: `JS-${payload.idempotencyKey}`,
          id: `id_${payload.idempotencyKey}`,
        };
      };

      const result = await processOutboxQueue({
        db,
        customCreator,
      });

      expect(result.processed).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]?.idempotencyKey).toBe('item-2-fail');

      const item1 = await db.getOutboxItemByIdempotencyKey('item-1-success');
      expect(item1?.sync_status).toBe('SYNCED');

      const item2 = await db.getOutboxItemByIdempotencyKey('item-2-fail');
      expect(item2?.sync_status).toBe('PENDING');
      expect(item2?.retry_count).toBe(1);
    });
  });
});
