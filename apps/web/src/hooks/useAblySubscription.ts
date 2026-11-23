import { useState, useEffect, useRef } from 'react';
import * as Ably from 'ably';
import { api } from '../lib/api.js';

export interface AblyUpdateEvent {
  readonly name: string;
  readonly data: Record<string, unknown>;
  readonly timestamp: number;
}

export interface UseAblySubscriptionOptions {
  readonly trackingCode?: string;
  readonly onUpdate?: (event: AblyUpdateEvent) => void;
  readonly enabled?: boolean;
}

export function useAblySubscription(options: UseAblySubscriptionOptions) {
  const { trackingCode, onUpdate, enabled = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<AblyUpdateEvent | null>(null);
  const ablyClientRef = useRef<Ably.Realtime | null>(null);

  useEffect(() => {
    if (!enabled || !trackingCode) {
      return;
    }

    let isMounted = true;

    async function initAbly() {
      try {
        const tokenData = await api.realtime.getToken(trackingCode);
        if (!isMounted) return;

        // If mock provider is returned or token absent, gracefully report disconnected
        if (tokenData.isMock || !tokenData.token) {
          setIsConnected(false);
          return;
        }

        const client = new Ably.Realtime({
          token: tokenData.token,
          autoConnect: true,
        });
        ablyClientRef.current = client;

        client.connection.on('connected', () => {
          if (isMounted) setIsConnected(true);
        });

        client.connection.on('disconnected', () => {
          if (isMounted) setIsConnected(false);
        });

        client.connection.on('failed', () => {
          if (isMounted) setIsConnected(false);
        });

        const channel = client.channels.get(`complaint:${trackingCode}`);
        channel.subscribe((message) => {
          if (!isMounted) return;
          const ev: AblyUpdateEvent = {
            name: message.name ?? 'complaint:updated',
            data: (message.data as Record<string, unknown>) ?? {},
            timestamp: message.timestamp ?? Date.now(),
          };
          setLastEvent(ev);
          onUpdate?.(ev);
        });
      } catch {
        if (isMounted) setIsConnected(false);
      }
    }

    void initAbly();

    return () => {
      isMounted = false;
      if (ablyClientRef.current) {
        ablyClientRef.current.close();
        ablyClientRef.current = null;
      }
    };
  }, [trackingCode, enabled, onUpdate]);

  return { isConnected, lastEvent };
}
