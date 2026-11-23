import Ably from 'ably';
import type { ValidatedEnv } from '../config/env.js';
import type { AuthUser } from '../types/index.js';
import { getComplaintStore } from './complaint-store.js';

export interface RealtimeMessageRecord {
  readonly channel: string;
  readonly event: string;
  readonly data: unknown;
  readonly timestamp: string;
}

export interface AblyTokenRequestResult {
  readonly tokenRequest: {
    readonly keyName: string;
    readonly clientId: string;
    readonly capability: string;
    readonly timestamp: number;
    readonly nonce: string;
    readonly mac: string;
  };
  readonly channelScope: string[];
}

export class RealtimeService {
  private client: Ably.Rest | null = null;
  private inMemoryEvents: RealtimeMessageRecord[] = [];
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
    if (apiKey) {
      try {
        this.client = new Ably.Rest({ key: apiKey });
      } catch {
        this.client = null;
      }
    }
  }

  async publish(channelName: string, event: string, data: unknown): Promise<void> {
    const record: RealtimeMessageRecord = {
      channel: channelName,
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    this.inMemoryEvents.push(record);

    if (this.client) {
      try {
        const channel = this.client.channels.get(channelName);
        await channel.publish(event, data);
      } catch {
        // Silently preserve in-memory record on external network failure
      }
    }
  }

  async createTokenRequest(
    user: AuthUser,
    requestedTrackingCode?: string,
    env?: ValidatedEnv
  ): Promise<AblyTokenRequestResult> {
    const capabilities: Record<string, string[]> = {};
    const channelScope: string[] = [];

    // Role-based Capability Scoping
    if (user.role === 'citizen') {
      // Citizens are restricted to subscribing ONLY to their own complaints
      if (requestedTrackingCode) {
        const store = getComplaintStore();
        const complaint = await store.findComplaintByTrackingCode(requestedTrackingCode, env);
        // Only grant capability if citizen is anonymous or owns the complaint
        if (!complaint || !complaint.citizenId || complaint.citizenId === user.id) {
          const ch = `complaint:${requestedTrackingCode}`;
          capabilities[ch] = ['subscribe'];
          channelScope.push(ch);
        }
      } else {
        // Find citizen's complaints
        const store = getComplaintStore();
        const list = await store.queryComplaints({}, env);
        const citizenComplaints = list.items.filter((c) => c.citizenId === user.id);

        if (citizenComplaints.length > 0) {
          for (const c of citizenComplaints) {
            const ch = `complaint:${c.trackingCode}`;
            capabilities[ch] = ['subscribe'];
            channelScope.push(ch);
          }
        } else {
          // If citizen has no complaints yet, grant dummy scoped channel
          const ch = `complaint:user-${user.id}`;
          capabilities[ch] = ['subscribe'];
          channelScope.push(ch);
        }
      }
    } else if (user.role === 'ward_officer') {
      // Ward officers subscribe to their assigned ward and department channels
      if (user.wardId) {
        const wardCh = `ward:${user.wardId}`;
        capabilities[wardCh] = ['subscribe'];
        channelScope.push(wardCh);
      }
      if (user.departmentId) {
        const deptCh = `dept:${user.departmentId}`;
        capabilities[deptCh] = ['subscribe'];
        channelScope.push(deptCh);
      }
      // Can also subscribe to individual complaint updates
      capabilities['complaint:*'] = ['subscribe'];
      channelScope.push('complaint:*');
    } else if (user.role === 'dept_head') {
      // Department heads subscribe to their department and ward updates
      if (user.departmentId) {
        const deptCh = `dept:${user.departmentId}`;
        capabilities[deptCh] = ['subscribe'];
        channelScope.push(deptCh);
      }
      capabilities['ward:*'] = ['subscribe'];
      capabilities['complaint:*'] = ['subscribe'];
      channelScope.push('ward:*', 'complaint:*');
    } else if (user.role === 'admin') {
      // Admins have full access across all channels including system alerts
      capabilities['*'] = ['subscribe', 'presence'];
      channelScope.push('*');
    }

    const capabilityString = JSON.stringify(capabilities);
    const now = Date.now();
    const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    let tokenRequest = {
      keyName: this.apiKey?.split(':')[0] ?? 'jansetu.devKey',
      clientId: user.id,
      capability: capabilityString,
      timestamp: now,
      nonce,
      mac: 'mock_signed_mac_hmac_sha256',
    };

    if (this.client) {
      try {
        const realReq = await this.client.auth.createTokenRequest({
          clientId: user.id,
          capability: capabilityString,
          ttl: 3600 * 1000, // 1 hour short-lived token
        });
        tokenRequest = {
          keyName: realReq.keyName,
          clientId: realReq.clientId ?? user.id,
          capability: realReq.capability,
          timestamp: realReq.timestamp,
          nonce: realReq.nonce,
          mac: realReq.mac,
        };
      } catch {
        // Fall back to generated struct
      }
    }

    return {
      tokenRequest,
      channelScope,
    };
  }

  getRecentEvents(): readonly RealtimeMessageRecord[] {
    return [...this.inMemoryEvents];
  }

  reset(): void {
    this.inMemoryEvents = [];
  }
}

let realtimeServiceInstance: RealtimeService | null = null;

export function getRealtimeService(env?: ValidatedEnv): RealtimeService {
  if (!realtimeServiceInstance) {
    realtimeServiceInstance = new RealtimeService(env?.ABLY_API_KEY);
  }
  return realtimeServiceInstance;
}

export function setRealtimeService(service: RealtimeService): void {
  realtimeServiceInstance = service;
}

export function resetRealtimeService(): void {
  realtimeServiceInstance = null;
}
