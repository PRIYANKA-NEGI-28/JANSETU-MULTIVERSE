/**
 * WebSocket broadcast module for JanSetu Multiverse.
 * 
 * Provides a singleton WebSocket server that can be attached to the HTTP server,
 * and a broadcast function that pushes events to all connected frontend clients.
 * 
 * Event types:
 *   - 'new_complaint'    : A new complaint was filed (via citizen or IoT)
 *   - 'new_sensor_alert' : A new sensor fault was detected
 *   - 'sensor_resolved'  : A sensor fault was resolved
 *   - 'complaint_updated': A complaint status was changed
 */
const { WebSocketServer } = require('ws');

let wss = null;

/**
 * Attach a WebSocket server to an existing HTTP server.
 * Must be called once at startup.
 */
function initWebSocket(httpServer) {
  wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    console.log('[WS] Client connected. Total:', wss.clients.size);

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    // Send a welcome message so the client knows the connection is live
    ws.send(JSON.stringify({ type: 'connected', message: 'JanSetu WebSocket live' }));

    ws.on('close', () => {
      console.log('[WS] Client disconnected. Total:', wss.clients.size);
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
    });
  });

  // Heartbeat ping every 30 seconds to keep connections alive and clean up dead ones
  const heartbeat = setInterval(() => {
    if (!wss) { clearInterval(heartbeat); return; }
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) { return ws.terminate(); }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  console.log('[WS] WebSocket server initialized');
  return wss;
}

/**
 * Broadcast an event to ALL connected WebSocket clients.
 * 
 * @param {string} type  - Event type (e.g. 'new_complaint')
 * @param {object} data  - The payload to send
 */
function broadcast(type, data) {
  if (!wss) {
    console.warn('[WS] broadcast called before WebSocket server initialized');
    return;
  }

  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN === 1
      try {
        client.send(message);
      } catch (err) {
        console.error('[WS] Failed to send to client:', err.message);
      }
    }
  });
}

module.exports = { initWebSocket, broadcast };
