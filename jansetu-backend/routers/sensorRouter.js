const express = require('express');
const router = express.Router();
const { recordSensorFault, resolveSensorFault, runQuery } = require('../db/graph');
const { saveSensorAlert, getSensorAlerts } = require('../db/sqlite');

// Hardcoded location and assignment profiles mapped to device IDs
const DEVICE_PROFILES = {
  'UNO_Q_01': { lat: 28.6139, lng: 77.2090, ward: 'Central Ward', department: 'Electrical Maintenance' },
  'UNO_Q_02': { lat: 28.5355, lng: 77.2410, ward: 'South Ward', department: 'Water Supply' }
};
const FALLBACK_PROFILE = { lat: 28.6000, lng: 77.2000, ward: 'General Ward', department: 'City Maintenance' };

// GET /api/sensor - Fetch all active sensor anomalies
router.get('/', async (req, res) => {
  try {
    const query = `
      MATCH (a:SensorAnomaly)
      WHERE a.status = 'FAULT'
      RETURN a
      ORDER BY a.createdAt DESC
    `;
    const result = await runQuery(query);
    const alerts = result.records.map(r => r.get('a').properties);
    return res.json({ success: true, alerts });
  } catch (err) {
    console.warn('Neo4j GET /api/sensor failed, using SQLite fallback');
    try {
      const sqliteAlerts = getSensorAlerts();
      const mappedAlerts = sqliteAlerts.filter(a => a.status === 'FAULT');
      return res.json({ success: true, alerts: mappedAlerts });
    } catch (sqliteErr) {
      return res.json({ success: true, alerts: [] });
    }
  }
});

// POST /api/sensor - Intercept Arduino UNO Q node telemetry
router.post('/', async (req, res) => {
  try {
    // Arduino could be sending deviceId instead of device_id depending on the hardware code
    const device_id = req.body.device_id || req.body.deviceId;
    const { status, type } = req.body;
    
    if (!device_id || !status) {
      console.log('Rejected sensor payload:', req.body);
      return res.status(400).json({ success: false, error: 'Missing device_id or status' });
    }

    if (status === 'FAULT') {
      const location = DEVICE_PROFILES[device_id] || FALLBACK_PROFILE;
      try {
        const result = await recordSensorFault(device_id, type || 'UNKNOWN', location);
        
        return res.status(201).json({
          success: true,
          message: 'Fault anomaly registered and assigned to department',
          data: result.records[0]?.get('a').properties
        });
      } catch (err) {
        console.warn('Neo4j POST /api/sensor failed, saving to SQLite fallback');
        const alert = {
          id: 'SENS-' + Date.now(),
          device_id,
          type: type || 'UNKNOWN',
          status: 'FAULT',
          lat: location.lat,
          lng: location.lng,
          ward: location.ward,
          department: location.department,
          description: `Automatic fault detected by ${device_id}`,
          severity: 'HIGH',
          area: location.ward,
          createdAt: new Date().toISOString()
        };
        saveSensorAlert(alert);
        return res.status(201).json({
          success: true,
          message: 'Fault registered locally',
          data: alert
        });
      }
    } else if (status === 'RESOLVED') {
      const result = await resolveSensorFault(device_id);
      
      return res.status(200).json({
        success: true,
        message: 'Fault anomaly resolved and flags cleared',
        resolvedCount: result.records.length
      });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
  } catch (error) {
    console.error('Error recording sensor data:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
