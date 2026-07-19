const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
console.log('Environment variables loaded:');
console.log('NEO4J_URI:', process.env.NEO4J_URI);
console.log('NEO4J_USERNAME:', process.env.NEO4J_USERNAME);
console.log('NEO4J_PASSWORD:', process.env.NEO4J_PASSWORD ? 'set' : 'not set');

const { verifyConnection } = require('./db/graph');
const { initSQLite } = require('./db/sqlite');
const { sanitizeRecordDates } = require('./db/dateSanitizer');
const { initWebSocket } = require('./ws/broadcast');

const complaintRouter = require('./routers/complaintRouter');
const sensorRouter = require('./routers/sensorRouter');
const dashboardRouter = require('./routers/dashboardRouter');
const drafterRouter = require('./routers/drafterRouter');
const adminRouter = require('./routers/adminRouter');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logging and Sanitization Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Override res.json to automatically sanitize any Neo4j objects before sending to frontend
  const originalJson = res.json;
  res.json = function(data) {
    const sanitizedData = sanitizeRecordDates(data);
    return originalJson.call(this, sanitizedData);
  };
  
  next();
});

// Routers
app.use('/api/complaint', complaintRouter);
// Parse ALL payload types as JSON for the sensor endpoint since IoT devices often send raw text without correct headers
app.use('/api/sensor', express.json({ type: '*/*' }), sensorRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/drafter', drafterRouter);
app.use('/api/admin', adminRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'JanSetu Multiverse backend is running.' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not Found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});


// Start Server
async function startServer() {
  // Initialize Dual-Database split
  initSQLite();

  // RUST-PROOF NEO4J INTEGRATION: Test driver connection before starting the server
  await verifyConnection();

  // Create HTTP server and attach WebSocket to the same port
  const server = http.createServer(app);
  initWebSocket(server);

  // Listen on '0.0.0.0' to permit external physical edge hardware devices on the local network
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`JanSetu Multiverse backend engine listening at http://0.0.0.0:${PORT}`);
    console.log(`WebSocket server available at ws://0.0.0.0:${PORT}`);
  });
}

// Global error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Don't exit the process - let the server continue running
  // process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process - let the server continue running
});

// Start the server
startServer();

