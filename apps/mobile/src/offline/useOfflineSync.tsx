import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import type { ComplaintDto, CreateComplaintInput } from '../lib/api-client';
import { getOfflineDatabase } from './database';
import {
  enqueueComplaint as enqueueComplaintEngine,
  getCachedComplaintsList,
  parseOutboxRecord,
  processOutboxQueue,
  processSingleOutboxItem,
} from './syncEngine';
import type { OutboxItem, SyncResult } from './types';

export interface OfflineSyncContextValue {
  readonly isOnline: boolean;
  readonly isSyncing: boolean;
  readonly outboxItems: readonly OutboxItem[];
  readonly pendingCount: number;
  readonly cachedComplaints: readonly ComplaintDto[];
  readonly lastSyncResult: SyncResult | null;
  readonly enqueueComplaint: (
    payload: CreateComplaintInput,
    localImageUris?: readonly string[],
    idempotencyKey?: string
  ) => Promise<OutboxItem>;
  readonly syncNow: (force?: boolean) => Promise<SyncResult>;
  readonly retryItem: (idempotencyKey: string) => Promise<boolean>;
  readonly removeItem: (idempotencyKey: string) => Promise<void>;
  readonly refreshOutbox: () => Promise<void>;
  readonly refreshCache: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function OfflineSyncProvider({ children }: { readonly children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [outboxItems, setOutboxItems] = useState<readonly OutboxItem[]>([]);
  const [cachedComplaints, setCachedComplaints] = useState<readonly ComplaintDto[]>([]);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const isSyncingRef = useRef(false);

  const refreshOutbox = useCallback(async () => {
    try {
      const db = getOfflineDatabase();
      await db.init();
      const records = await db.getOutboxItems();
      const items = records.map(parseOutboxRecord);
      setOutboxItems(items);
    } catch {
      // Ignore initial DB load errors
    }
  }, []);

  const refreshCache = useCallback(async () => {
    try {
      const complaints = await getCachedComplaintsList();
      setCachedComplaints(complaints);
    } catch {
      // Ignore initial cache load errors
    }
  }, []);

  const syncNow = useCallback(
    async (force = false): Promise<SyncResult> => {
      if (isSyncingRef.current) {
        return { processed: 0, succeeded: 0, failed: 0, errors: [] };
      }
      isSyncingRef.current = true;
      setIsSyncing(true);

      try {
        const result = await processOutboxQueue({ force });
        setLastSyncResult(result);
        await refreshOutbox();
        await refreshCache();
        return result;
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    },
    [refreshOutbox, refreshCache]
  );

  const enqueue = useCallback(
    async (
      payload: CreateComplaintInput,
      localImageUris: readonly string[] = [],
      idempotencyKey?: string
    ): Promise<OutboxItem> => {
      const item = await enqueueComplaintEngine(payload, localImageUris, idempotencyKey);
      await refreshOutbox();

      // If online, immediately try to sync the queue in the background
      if (isOnline) {
        void syncNow();
      }

      return item;
    },
    [isOnline, refreshOutbox, syncNow]
  );

  const retryItem = useCallback(
    async (idempotencyKey: string): Promise<boolean> => {
      const db = getOfflineDatabase();
      const record = await db.getOutboxItemByIdempotencyKey(idempotencyKey);
      if (!record) return false;

      const item = parseOutboxRecord(record);
      setIsSyncing(true);
      try {
        const res = await processSingleOutboxItem(item, db);
        await refreshOutbox();
        await refreshCache();
        return res.success;
      } finally {
        setIsSyncing(false);
      }
    },
    [refreshOutbox, refreshCache]
  );

  const removeItem = useCallback(
    async (idempotencyKey: string): Promise<void> => {
      const db = getOfflineDatabase();
      await db.deleteOutboxItem(idempotencyKey);
      await refreshOutbox();
    },
    [refreshOutbox]
  );

  // Monitor network transitions via NetInfo
  useEffect(() => {
    let wasOnline = true;

    const handleNetChange = (state: NetInfoState) => {
      const online = Boolean(state.isConnected && (state.isInternetReachable ?? true));
      setIsOnline(online);

      // Auto-flush queued items when transitioning from offline to online
      if (!wasOnline && online) {
        void syncNow();
      }
      wasOnline = online;
    };

    const unsubscribe = NetInfo.addEventListener(handleNetChange);

    // Initial check
    void NetInfo.fetch().then(handleNetChange);
    void refreshOutbox();
    void refreshCache();

    return () => {
      unsubscribe();
    };
  }, [refreshOutbox, refreshCache, syncNow]);

  const pendingCount = outboxItems.filter(
    (item) => item.syncStatus === 'PENDING' || item.syncStatus === 'SYNCING'
  ).length;

  const value: OfflineSyncContextValue = {
    isOnline,
    isSyncing,
    outboxItems,
    pendingCount,
    cachedComplaints,
    lastSyncResult,
    enqueueComplaint: enqueue,
    syncNow,
    retryItem,
    removeItem,
    refreshOutbox,
    refreshCache,
  };

  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}

export function useOfflineSync(): OfflineSyncContextValue {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    // Provide safe standalone fallback if outside provider
    return {
      isOnline: true,
      isSyncing: false,
      outboxItems: [],
      pendingCount: 0,
      cachedComplaints: [],
      lastSyncResult: null,
      enqueueComplaint: enqueueComplaintEngine,
      syncNow: () => processOutboxQueue(),
      retryItem: async () => false,
      removeItem: async () => {},
      refreshOutbox: async () => {},
      refreshCache: async () => {},
    };
  }
  return context;
}
