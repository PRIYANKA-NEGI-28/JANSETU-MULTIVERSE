import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Ably from 'ably';
import { getComplaintByTrackingCode, getRealtimeToken, type ComplaintDto } from '../lib/api-client';

export interface AblyTrackingEvent {
  readonly name: string;
  readonly data: Record<string, unknown>;
  readonly timestamp: number;
}

export interface UseAblyTrackingOptions {
  readonly trackingCode?: string;
  readonly onUpdate?: (event: AblyTrackingEvent) => void;
  readonly onComplaintRefreshed?: (complaint: ComplaintDto) => void;
  readonly enabled?: boolean;
  readonly pollIntervalMs?: number;
}

export interface UseAblyTrackingResult {
  readonly isConnected: boolean;
  readonly isPollingFallback: boolean;
  readonly lastEvent: AblyTrackingEvent | null;
  readonly isRefreshing: boolean;
  readonly refresh: () => Promise<ComplaintDto | null>;
}

export function useAblyTracking(options: UseAblyTrackingOptions): UseAblyTrackingResult {
  const {
    trackingCode,
    onUpdate,
    onComplaintRefreshed,
    enabled = true,
    pollIntervalMs = 15000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isPollingFallback, setIsPollingFallback] = useState(false);
  const [lastEvent, setLastEvent] = useState<AblyTrackingEvent | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const ablyClientRef = useRef<Ably.Realtime | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refresh = useCallback(async (): Promise<ComplaintDto | null> => {
    if (!trackingCode) return null;
    setIsRefreshing(true);
    try {
      const data = await getComplaintByTrackingCode(trackingCode);
      if (data && isMountedRef.current) {
        onComplaintRefreshed?.(data);
      }
      return data;
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [trackingCode, onComplaintRefreshed]);

  // Handle Ably Connection Lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    if (!enabled || !trackingCode) {
      setIsConnected(false);
      setIsPollingFallback(false);
      return;
    }

    async function connectAbly() {
      try {
        const tokenData = await getRealtimeToken(trackingCode);
        if (!isMountedRef.current) return;

        if (tokenData.isMock || !tokenData.token) {
          setIsConnected(false);
          setIsPollingFallback(true);
          return;
        }

        const client = new Ably.Realtime({
          token: tokenData.token,
          autoConnect: true,
        });
        ablyClientRef.current = client;

        client.connection.on('connected', () => {
          if (isMountedRef.current) {
            setIsConnected(true);
            setIsPollingFallback(false);
          }
        });

        client.connection.on('disconnected', () => {
          if (isMountedRef.current) {
            setIsConnected(false);
            setIsPollingFallback(true);
          }
        });

        client.connection.on('failed', () => {
          if (isMountedRef.current) {
            setIsConnected(false);
            setIsPollingFallback(true);
          }
        });

        const channel = client.channels.get(`complaint:${trackingCode}`);
        channel.subscribe((msg) => {
          if (!isMountedRef.current) return;
          const ev: AblyTrackingEvent = {
            name: msg.name ?? 'complaint:updated',
            data: (msg.data as Record<string, unknown>) ?? {},
            timestamp: msg.timestamp ?? Date.now(),
          };
          setLastEvent(ev);
          onUpdate?.(ev);

          // Whenever an Ably event arrives, also trigger a fresh fetch
          void refresh();
        });
      } catch {
        if (isMountedRef.current) {
          setIsConnected(false);
          setIsPollingFallback(true);
        }
      }
    }

    void connectAbly();

    // Listen to React Native AppState (Foreground vs Background)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (previousState.match(/inactive|background/) && nextAppState === 'active') {
        // Returning to foreground: reconnect Ably and poll latest status
        if (ablyClientRef.current) {
          ablyClientRef.current.connect();
        } else {
          void connectAbly();
        }
        void refresh();
      } else if (nextAppState.match(/inactive|background/)) {
        // Entering background: suspend real-time socket to preserve mobile battery
        if (ablyClientRef.current) {
          ablyClientRef.current.close();
          ablyClientRef.current = null;
        }
        setIsConnected(false);
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      isMountedRef.current = false;
      appStateSubscription.remove();
      if (ablyClientRef.current) {
        ablyClientRef.current.close();
        ablyClientRef.current = null;
      }
    };
  }, [trackingCode, enabled, onUpdate, refresh]);

  // Graceful Polling Fallback (when disconnected or isPollingFallback is active)
  useEffect(() => {
    if (!enabled || !trackingCode || (!isPollingFallback && isConnected)) {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      return;
    }

    pollingTimerRef.current = setInterval(() => {
      if (appStateRef.current === 'active') {
        void refresh();
      }
    }, pollIntervalMs);

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [enabled, trackingCode, isPollingFallback, isConnected, pollIntervalMs, refresh]);

  return {
    isConnected,
    isPollingFallback,
    lastEvent,
    isRefreshing,
    refresh,
  };
}
