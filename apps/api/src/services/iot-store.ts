import { obfuscatePublicCoords, getDatabase, iotDevices, iotTelemetry, eq } from '@jansetu/db';
import type { ValidatedEnv } from '../config/env.js';

export interface IotDeviceEntity {
  id: string;
  deviceUid: string;
  deviceType: string;
  wardId: string | null;
  departmentId: string | null;
  location: { lat: number; lng: number };
  status: string; // 'NORMAL' | 'FAULT' | 'OFFLINE'
  batteryLevel?: number | null;
  lastHeartbeatAt?: Date | null;
  activeClusterId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IotTelemetryRecord {
  id: string;
  deviceId: string;
  deviceUid: string;
  idempotencyKey: string;
  eventType: string;
  status: string;
  seq?: number;
  uptimeMs?: number;
  ldrRaw?: number;
  faultDurationMs?: number;
  payload: Record<string, unknown>;
  recordedAt: Date;
}

export class IotStore {
  private inMemoryDevices = new Map<string, IotDeviceEntity>();
  private inMemoryTelemetry: IotTelemetryRecord[] = [];
  private processedIdempotencyKeys = new Set<string>();

  constructor() {
    this.seedDemoData();
  }

  private seedDemoData(): void {
    const dev1: IotDeviceEntity = {
      id: 'iot-dev-01',
      deviceUid: 'UNO_Q_01',
      deviceType: 'STREETLIGHT',
      wardId: 'ward-12',
      departmentId: 'dept-streetlights',
      location: { lat: 28.6412, lng: 77.3712 },
      status: 'NORMAL',
      batteryLevel: 92,
      lastHeartbeatAt: new Date(),
      activeClusterId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const dev2: IotDeviceEntity = {
      id: 'iot-dev-02',
      deviceUid: 'UNO_Q_02',
      deviceType: 'STREETLIGHT',
      wardId: 'ward-04',
      departmentId: 'dept-streetlights',
      location: { lat: 28.6015, lng: 77.3015 },
      status: 'NORMAL',
      batteryLevel: 98,
      lastHeartbeatAt: new Date(),
      activeClusterId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.inMemoryDevices.set(dev1.deviceUid, dev1);
    this.inMemoryDevices.set(dev2.deviceUid, dev2);
  }

  getDeviceSecret(deviceUid: string, env?: ValidatedEnv): string {
    return env?.DEVICE_HMAC_SECRET || 'jansetu-iot-dev-secret';
  }

  async findDeviceByUid(deviceUid: string, env?: ValidatedEnv): Promise<IotDeviceEntity | null> {
    const mem = this.inMemoryDevices.get(deviceUid);
    if (mem) return { ...mem };

    if (env?.DATABASE_URL) {
      try {
        const db = getDatabase(env.DATABASE_URL);
        const [row] = await db.select().from(iotDevices).where(eq(iotDevices.deviceUid, deviceUid)).limit(1);
        if (row) {
          const entity: IotDeviceEntity = {
            id: row.id,
            deviceUid: row.deviceUid,
            deviceType: row.deviceType,
            wardId: row.wardId,
            departmentId: row.departmentId,
            location: { lat: 28.6412, lng: 77.3712 },
            status: row.status,
            batteryLevel: row.batteryLevel,
            lastHeartbeatAt: row.lastHeartbeatAt,
            activeClusterId: null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          };
          this.inMemoryDevices.set(deviceUid, entity);
          return entity;
        }
      } catch {
        // Fall back to in-memory
      }
    }

    // Auto-provision unseeded devices on first contact for zero-friction setup
    const newDev: IotDeviceEntity = {
      id: `iot-dev-${crypto.randomUUID()}`,
      deviceUid,
      deviceType: 'STREETLIGHT',
      wardId: 'ward-12',
      departmentId: 'dept-streetlights',
      location: { lat: 28.6412, lng: 77.3712 },
      status: 'NORMAL',
      batteryLevel: 100,
      lastHeartbeatAt: new Date(),
      activeClusterId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.inMemoryDevices.set(deviceUid, newDev);
    return newDev;
  }

  async isIdempotencyKeyProcessed(idempotencyKey: string): Promise<boolean> {
    return this.processedIdempotencyKeys.has(idempotencyKey);
  }

  async recordTelemetry(record: IotTelemetryRecord, env?: ValidatedEnv): Promise<void> {
    this.processedIdempotencyKeys.add(record.idempotencyKey);
    this.inMemoryTelemetry.push(record);

    if (env?.DATABASE_URL) {
      try {
        const db = getDatabase(env.DATABASE_URL);
        await db.insert(iotTelemetry).values({
          id: record.id,
          deviceId: record.deviceId,
          eventType: record.eventType,
          status: record.status,
          payload: record.payload,
          recordedAt: record.recordedAt,
        });
      } catch {
        // Fall back to in-memory
      }
    }
  }

  async updateDeviceStatus(deviceUid: string, status: string, activeClusterId?: string | null): Promise<IotDeviceEntity | null> {
    const dev = this.inMemoryDevices.get(deviceUid);
    if (!dev) return null;

    const updated: IotDeviceEntity = {
      ...dev,
      status,
      activeClusterId: activeClusterId !== undefined ? activeClusterId : dev.activeClusterId,
      updatedAt: new Date(),
    };
    this.inMemoryDevices.set(deviceUid, updated);
    return updated;
  }

  async updateHeartbeat(deviceUid: string, reportedState?: string): Promise<IotDeviceEntity | null> {
    let dev: IotDeviceEntity | null | undefined = this.inMemoryDevices.get(deviceUid);
    if (!dev) {
      dev = await this.findDeviceByUid(deviceUid);
    }
    if (!dev) return null;

    const newStatus = dev.status === 'OFFLINE' ? (reportedState === 'FAULT_CONFIRMED' ? 'FAULT' : 'NORMAL') : dev.status;

    const updated: IotDeviceEntity = {
      ...dev,
      status: newStatus,
      lastHeartbeatAt: new Date(),
      updatedAt: new Date(),
    };
    this.inMemoryDevices.set(deviceUid, updated);
    return updated;
  }

  async findDevicesWithMissedHeartbeats(cutoffDate: Date): Promise<IotDeviceEntity[]> {
    const missed: IotDeviceEntity[] = [];
    for (const dev of this.inMemoryDevices.values()) {
      if (dev.status !== 'OFFLINE') {
        if (!dev.lastHeartbeatAt || dev.lastHeartbeatAt < cutoffDate) {
          missed.push({ ...dev });
        }
      }
    }
    return missed;
  }

  async markDeviceOffline(deviceUid: string): Promise<IotDeviceEntity | null> {
    return this.updateDeviceStatus(deviceUid, 'OFFLINE');
  }

  setDeviceHeartbeatTime(deviceUid: string, timestamp: Date): void {
    const dev = this.inMemoryDevices.get(deviceUid);
    if (dev) {
      dev.lastHeartbeatAt = timestamp;
    }
  }

  reset(): void {
    this.inMemoryDevices.clear();
    this.inMemoryTelemetry = [];
    this.processedIdempotencyKeys.clear();
    this.seedDemoData();
  }
}

let defaultIotStore: IotStore | null = null;

export function getIotStore(): IotStore {
  if (!defaultIotStore) {
    defaultIotStore = new IotStore();
  }
  return defaultIotStore;
}

export function resetIotStore(): void {
  if (defaultIotStore) {
    defaultIotStore.reset();
  } else {
    defaultIotStore = new IotStore();
  }
}
