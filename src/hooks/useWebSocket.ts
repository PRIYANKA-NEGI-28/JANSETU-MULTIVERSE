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

let globalWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
let isConnected = false;
const globalListeners = new Set<WSListener>();

function connectGlobal() {
  if (globalWs) return;

  let wsUrl: string;
  if (BACKEND_URL) {
    wsUrl = BACKEND_URL.replace(/^http/, 'ws');
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${protocol}//${window.location.hostname}:3000`;
  }

  try {
    globalWs = new WebSocket(wsUrl);

    globalWs.onopen = () => {
      console.log('[WS Global] Connected to', wsUrl);
      isConnected = true;
      reconnectDelay = 1000;
      globalListeners.forEach(l => l({ type: 'connected', data: null }));
    };

    globalWs.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        globalListeners.forEach((listener) => {
          try {
            listener(msg);
          } catch (e) {
            console.error('[WS Global] Listener error:', e);
          }
        });
      } catch (e) {
        console.warn('[WS Global] Failed to parse message:', event.data);
      }
    };

    globalWs.onclose = () => {
      console.log('[WS Global] Disconnected, will reconnect in', reconnectDelay, 'ms');
      isConnected = false;
      globalWs = null;

      reconnectTimer = setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 1.5, 15000);
        connectGlobal();
      }, reconnectDelay);
    };

    globalWs.onerror = (err) => {
      console.error('[WS Global] Error:', err);
      globalWs?.close();
    };
  } catch (err) {
    console.error('[WS Global] Failed to create WebSocket:', err);
    reconnectTimer = setTimeout(connectGlobal, reconnectDelay);
  }
}

if (typeof window !== 'undefined') {
  connectGlobal();
}

/**
 * A global WebSocket hook that connects once and allows multiple subscribers.
 * Uses a true singleton WebSocket connection.
 */
export function useWebSocket() {
  const [connected, setConnected] = useState(isConnected);

  useEffect(() => {
    const handleConnect = (msg: WSMessage) => {
      if (msg.type === 'connected') setConnected(true);
    };
    globalListeners.add(handleConnect);
    const interval = setInterval(() => setConnected(isConnected), 1000);
    return () => {
      globalListeners.delete(handleConnect);
      clearInterval(interval);
    };
  }, []);

  const subscribe = useCallback((listener: WSListener) => {
    globalListeners.add(listener);
    return () => {
      globalListeners.delete(listener);
    };
  }, []);

  return { subscribe, connected };
}
