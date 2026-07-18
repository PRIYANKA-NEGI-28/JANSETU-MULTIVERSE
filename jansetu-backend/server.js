const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { verifyConnection } = require('./db/graph');
const { initSQLite } = require('./db/sqlite');

const complaintRouter = require('./routers/complaintRouter');
const sensorRouter = require('./routers/sensorRouter');
const dashboardRouter = require('./routers/dashboardRouter');
const drafterRouter = require('./routers/drafterRouter');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routers
app.use('/api/complaint', complaintRouter);
app.use('/api/sensor', sensorRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/drafter', drafterRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'JanSetu Multiverse backend is running.' });
});

// Start Server
async function startServer() {
  // Initialize Dual-Database split
  initSQLite();
  
  // RUST-PROOF NEO4J INTEGRATION: Test driver connection before starting the server
  await verifyConnection();
  
  // Listen on '0.0.0.0' to permit external physical edge hardware devices on the local network
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JanSetu Multiverse backend engine listening at http://0.0.0.0:${PORT}`);
  });
}

startServer();
