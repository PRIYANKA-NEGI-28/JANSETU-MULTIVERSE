import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  CachedComplaintRecord,
  OfflineDatabaseAdapter,
  OutboxRecord,
  SyncStatus,
} from './types';

export class MemoryDatabaseAdapter implements OfflineDatabaseAdapter {
  private outbox = new Map<string, OutboxRecord>();
  private cache = new Map<string, CachedComplaintRecord>();

  async init(): Promise<void> {
    // In-memory initialization is a no-op
  }

  async insertOutbox(record: OutboxRecord): Promise<void> {
    this.outbox.set(record.idempotency_key, { ...record });
  }

  async getOutboxItems(filterStatus?: SyncStatus[]): Promise<OutboxRecord[]> {
    const all = Array.from(this.outbox.values());
    if (!filterStatus || filterStatus.length === 0) {
      return all.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return all
      .filter((r) => filterStatus.includes(r.sync_status))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async getOutboxItemByIdempotencyKey(key: string): Promise<OutboxRecord | null> {
    const item = this.outbox.get(key);
    return item ? { ...item } : null;
  }

  async updateOutboxStatus(
    key: string,
    status: SyncStatus,
    lastError: string | null = null,
    incrementRetry = false
  ): Promise<void> {
    const item = this.outbox.get(key);
    if (!item) return;
    const updated: OutboxRecord = {
      ...item,
      sync_status: status,
      last_error: lastError,
      retry_count: incrementRetry ? item.retry_count + 1 : item.retry_count,
      updated_at: new Date().toISOString(),
    };
    this.outbox.set(key, updated);
  }

  async deleteOutboxItem(key: string): Promise<void> {
    this.outbox.delete(key);
  }

  async upsertCachedComplaint(record: CachedComplaintRecord): Promise<void> {
    this.cache.set(record.tracking_code, { ...record });
  }

  async getCachedComplaints(): Promise<CachedComplaintRecord[]> {
    return Array.from(this.cache.values()).sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  }

  async getCachedComplaintByTrackingCode(trackingCode: string): Promise<CachedComplaintRecord | null> {
    const item = this.cache.get(trackingCode);
    return item ? { ...item } : null;
  }

  async clearAll(): Promise<void> {
    this.outbox.clear();
    this.cache.clear();
  }
}

export class ExpoSQLiteDatabaseAdapter implements OfflineDatabaseAdapter {
  private dbInstance: SQLiteDatabase | null = null;
  private readonly dbName: string;

  constructor(dbName = 'jansetu_offline.db') {
    this.dbName = dbName;
  }

  private async getDb(): Promise<SQLiteDatabase> {
    if (this.dbInstance) return this.dbInstance;
    const SQLite = await import('expo-sqlite');
    this.dbInstance = await SQLite.openDatabaseAsync(this.dbName);
    return this.dbInstance;
  }

  async init(): Promise<void> {
    const db = await this.getDb();
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS pending_complaints (
        id TEXT PRIMARY KEY,
        idempotency_key TEXT UNIQUE NOT NULL,
        payload TEXT NOT NULL,
        local_image_uris TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        sync_status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_outbox_status ON pending_complaints(sync_status);

      CREATE TABLE IF NOT EXISTS cached_complaints (
        id TEXT PRIMARY KEY,
        tracking_code TEXT UNIQUE NOT NULL,
        citizen_phone TEXT,
        title TEXT,
        description TEXT,
        status TEXT NOT NULL,
        category TEXT NOT NULL,
        urgency TEXT NOT NULL,
        ward_id TEXT,
        ward_name TEXT,
        latitude REAL,
        longitude REAL,
        media_urls TEXT,
        data_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cached_tracking ON cached_complaints(tracking_code);
    `);
  }

  async insertOutbox(record: OutboxRecord): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO pending_complaints (
        id, idempotency_key, payload, local_image_uris, retry_count, last_error, sync_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.idempotency_key,
        record.payload,
        record.local_image_uris,
        record.retry_count,
        record.last_error,
        record.sync_status,
        record.created_at,
        record.updated_at,
      ]
    );
  }

  async getOutboxItems(filterStatus?: SyncStatus[]): Promise<OutboxRecord[]> {
    const db = await this.getDb();
    if (!filterStatus || filterStatus.length === 0) {
      return (await db.getAllAsync(
        'SELECT * FROM pending_complaints ORDER BY created_at ASC'
      )) as OutboxRecord[];
    }
    const placeholders = filterStatus.map(() => '?').join(',');
    return (await db.getAllAsync(
      `SELECT * FROM pending_complaints WHERE sync_status IN (${placeholders}) ORDER BY created_at ASC`,
      filterStatus
    )) as OutboxRecord[];
  }

  async getOutboxItemByIdempotencyKey(key: string): Promise<OutboxRecord | null> {
    const db = await this.getDb();
    const result = (await db.getFirstAsync(
      'SELECT * FROM pending_complaints WHERE idempotency_key = ?',
      [key]
    )) as OutboxRecord | null;
    return result || null;
  }

  async updateOutboxStatus(
    key: string,
    status: SyncStatus,
    lastError: string | null = null,
    incrementRetry = false
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    if (incrementRetry) {
      await db.runAsync(
        `UPDATE pending_complaints 
         SET sync_status = ?, last_error = ?, retry_count = retry_count + 1, updated_at = ?
         WHERE idempotency_key = ?`,
        [status, lastError, now, key]
      );
    } else {
      await db.runAsync(
        `UPDATE pending_complaints 
         SET sync_status = ?, last_error = ?, updated_at = ?
         WHERE idempotency_key = ?`,
        [status, lastError, now, key]
      );
    }
  }

  async deleteOutboxItem(key: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM pending_complaints WHERE idempotency_key = ?', [key]);
  }

  async upsertCachedComplaint(record: CachedComplaintRecord): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO cached_complaints (
        id, tracking_code, citizen_phone, title, description, status, category, urgency,
        ward_id, ward_name, latitude, longitude, media_urls, data_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.tracking_code,
        record.citizen_phone,
        record.title,
        record.description,
        record.status,
        record.category,
        record.urgency,
        record.ward_id,
        record.ward_name,
        record.latitude,
        record.longitude,
        record.media_urls,
        record.data_json,
        record.created_at,
        record.updated_at,
      ]
    );
  }

  async getCachedComplaints(): Promise<CachedComplaintRecord[]> {
    const db = await this.getDb();
    return (await db.getAllAsync(
      'SELECT * FROM cached_complaints ORDER BY created_at DESC'
    )) as CachedComplaintRecord[];
  }

  async getCachedComplaintByTrackingCode(trackingCode: string): Promise<CachedComplaintRecord | null> {
    const db = await this.getDb();
    const result = (await db.getFirstAsync(
      'SELECT * FROM cached_complaints WHERE tracking_code = ? OR id = ?',
      [trackingCode, trackingCode]
    )) as CachedComplaintRecord | null;
    return result || null;
  }

  async clearAll(): Promise<void> {
    const db = await this.getDb();
    await db.execAsync(`
      DELETE FROM pending_complaints;
      DELETE FROM cached_complaints;
    `);
  }
}

let activeAdapter: OfflineDatabaseAdapter | null = null;

export function getOfflineDatabase(): OfflineDatabaseAdapter {
  if (activeAdapter) return activeAdapter;

  // Use ExpoSQLite adapter by default, or memory adapter in Node/test
  try {
    activeAdapter = new ExpoSQLiteDatabaseAdapter();
  } catch {
    activeAdapter = new MemoryDatabaseAdapter();
  }
  return activeAdapter;
}

export function setOfflineDatabase(adapter: OfflineDatabaseAdapter): void {
  activeAdapter = adapter;
}
