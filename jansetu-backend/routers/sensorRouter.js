const express = require('express');
const router = express.Router();
const { recordSensorFault, resolveSensorFault, runQuery, createComplaintNode } = require('../db/graph');
const { saveSensorAlert, getSensorAlerts, saveComplaint } = require('../db/sqlite');
const catchAsync = require('../utils/catchAsync');
const { broadcast } = require('../ws/broadcast');

// Hardcoded location and assignment profiles mapped to device IDs
const DEVICE_PROFILES = {
  'UNO_Q_01': { lat: 28.6139, lng: 77.2090, ward: 'Central Ward', department: 'Electrical Maintenance' },
  'UNO_Q_02': { lat: 28.5355, lng: 77.2410, ward: 'South Ward', department: 'Water Supply' }
};
const FALLBACK_PROFILE = { lat: 28.6000, lng: 77.2000, ward: 'General Ward', department: 'City Maintenance' };

// GET /api/sensor - Fetch all active sensor anomalies
router.get('/', catchAsync(async (req, res) => {
  try {
    const query = `
      MATCH (a:SensorAnomaly)
      WHERE a.status = 'FAULT'
      RETURN a
      ORDER BY a.createdAt DESC
    `;
    const result = await runQuery(query);
    const alerts = result.records.map(r => {
      const props = r.get('a').properties;
      if (props.createdAt && typeof props.createdAt === 'object' && props.createdAt.year) {
        // Convert Neo4j DateTime object to ISO string
        const { year, month, day, hour, minute, second } = props.createdAt;
        props.createdAt = new Date(year.low, month.low - 1, day.low, hour?.low || 0, minute?.low || 0, second?.low || 0).toISOString();
      }
      return props;
    });
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
}));

// POST /api/sensor - Intercept Arduino UNO Q node telemetry
router.post('/', catchAsync(async (req, res) => {
  // Arduino could be sending deviceId instead of device_id depending on the hardware code
  const device_id = req.body.device_id || req.body.deviceId;
  const { status, type } = req.body;
  
  if (!device_id || !status) {
    console.log('Rejected sensor payload:', req.body);
    return res.status(400).json({ success: false, error: 'Missing device_id or status' });
  }

  if (status === 'FAULT') {
    const location = DEVICE_PROFILES[device_id] || FALLBACK_PROFILE;
    
    // Automatically file a persistent complaint for the maintenance team
    const complaintId = 'IOT-CMP-' + Date.now();
    const complaintData = {
      id: complaintId,
      complaint_number: complaintId,
      citizenName: 'Anonymous Citizen (IoT Monitor)',
      citizenPhone: 'N/A',
      rawText: `Automatic fault detected by sensor ${device_id}. Immediate maintenance required.`,
      language: 'en',
      summary: `Sensor Fault: ${type || 'UNKNOWN'}`,
      department: location.department,
      area: location.ward,
      ward: location.ward,
      issueType: type === 'STREET_LIGHT' ? 'Street Light Issue' : type === 'GAS_LEAK' ? 'Gas Leakage' : 'Infrastructure Fault',
      lat: location.lat,
      lng: location.lng,
      imageUrl: null,
      urgency: 'HIGH',
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    
    try {
      const result = await recordSensorFault(device_id, type || 'UNKNOWN', location);
      
      // Attempt to save complaint to graph
      try {
        await createComplaintNode(complaintData);
      } catch (err) {
        console.warn('Failed to save IoT complaint to Graph, saving to SQLite fallback', err.message);
        saveComplaint(complaintData);
      }
      // Broadcast sensor alert AND complaint to all connected clients
      const sensorData = result.records[0]?.get('a').properties;
      broadcast('new_sensor_alert', sensorData);
      broadcast('new_complaint', complaintData);
      
      return res.status(201).json({
        success: true,
        message: 'Fault anomaly registered and complaint filed automatically',
        data: sensorData
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
      saveComplaint(complaintData); // Also save the complaint to sqlite
      
      // Broadcast even in SQLite fallback mode
      broadcast('new_sensor_alert', alert);
      broadcast('new_complaint', complaintData);
      
      return res.status(201).json({
        success: true,
        message: 'Fault and complaint registered locally',
        data: alert
      });
    }
  } else if (status === 'RESOLVED') {
    try {
      const result = await resolveSensorFault(device_id);
      
      // Broadcast resolution to all clients
      broadcast('sensor_resolved', { device_id, resolvedCount: result.records.length });
      
      return res.status(200).json({
        success: true,
        message: 'Fault anomaly resolved and flags cleared',
        resolvedCount: result.records.length
      });
    } catch (err) {
      console.warn('Neo4j resolve failed:', err.message);
      broadcast('sensor_resolved', { device_id, resolvedCount: 0 });
      return res.status(200).json({
        success: true,
        message: 'Resolve recorded',
        resolvedCount: 0
      });
    }
  } else {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }
}));

module.exports = router;
