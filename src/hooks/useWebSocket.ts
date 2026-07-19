import { useEffect, useRef, useCallback, useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

type WSEventType = 'new_complaint' | 'new_sensor_alert' | 'sensor_resolved' | 'complaint_updated' | 'connected';

interface WSMessage {
  type: WSEventType;
  data: any;
  timestamp?: string;
  message?: string;
}

type WSListener = (msg: WSMessage) => void;

/**
 * A global WebSocket hook that connects once and allows multiple subscribers.
 * Automatically reconnects on disconnection with exponential backoff.
 */
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<WSListener>>(new Set());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    // Build WebSocket URL from the current page or VITE_BACKEND_URL
    let wsUrl: string;
    if (BACKEND_URL) {
      wsUrl = BACKEND_URL.replace(/^http/, 'ws');
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.hostname}:3000`;
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected to', wsUrl);
        setConnected(true);
        reconnectDelayRef.current = 1000; // Reset backoff on successful connect
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          listenersRef.current.forEach((listener) => {
            try {
              listener(msg);
            } catch (e) {
              console.error('[WS] Listener error:', e);
            }
          });
        } catch (e) {
          console.warn('[WS] Failed to parse message:', event.data);
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected, will reconnect in', reconnectDelayRef.current, 'ms');
        setConnected(false);
        wsRef.current = null;

        // Exponential backoff reconnection (max 15s)
        reconnectTimerRef.current = setTimeout(() => {
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, 15000);
          connect();
        }, reconnectDelayRef.current);
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
        ws.close();
      };
    } catch (err) {
      console.error('[WS] Failed to create WebSocket:', err);
      reconnectTimerRef.current = setTimeout(connect, reconnectDelayRef.current);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [connect]);

  const subscribe = useCallback((listener: WSListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  return { subscribe, connected };
}
