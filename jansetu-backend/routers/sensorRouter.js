const express = require('express');
const router = express.Router();
const { recordSensorFault, resolveSensorFault, runQuery, createComplaintNode } = require('../db/graph');
const { saveSensorAlert, getSensorAlerts, saveComplaint } = require('../db/sqlite');
const catchAsync = require('../utils/catchAsync');
const { broadcast } = require('../ws/broadcast');

// Fallback profile if IoT device does not send its location/department metadata
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

  // Strict Device and Status Validation
  if (!device_id.toUpperCase().includes('UNO_Q')) {
    console.log('Rejected sensor payload: Device must be a UNO Q unit.');
    return res.status(403).json({ success: false, error: 'Unauthorized device' });
  }

  if (status !== 'FAULT') {
    console.log('Ignored sensor payload: Status is not FAULT.');
    return res.status(200).json({ success: true, message: 'Ignored non-fault telemetry' });
  }

  if (status === 'FAULT') {
    const location = {
      lat: req.body.lat !== undefined ? parseFloat(req.body.lat) : FALLBACK_PROFILE.lat,
      lng: req.body.lng !== undefined ? parseFloat(req.body.lng) : FALLBACK_PROFILE.lng,
      ward: 'Sector 135',
      department: 'Municipal Corporation - General Administration'
    };
    
    // Automatically file a persistent complaint for the maintenance team
    const complaintId = 'IOT-CMP-' + Date.now();
    const complaintData = {
      id: complaintId,
      complaint_number: complaintId,
      citizenName: 'IoT',
      citizenPhone: 'N/A',
      rawText: `Automatic fault detected by sensor ${device_id}. Immediate maintenance required.`,
      language: 'en',
      summary: `Sensor Fault: ${type || 'UNKNOWN'}`,
      department: location.department,
      area: location.ward,
      ward: location.ward,
      issueType: 'Street light damage',
      lat: location.lat,
      lng: location.lng,
      imageUrl: null,
      urgency: 'HIGH',
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    
    try {
      const result = await recordSensorFault(device_id, type || 'UNKNOWN', location);
      
      // The graph.js functions catch their own Neo4j errors and return mock data.
      // Therefore, this try block will never throw a Neo4j error, meaning the outer catch is never hit.
      // We must explicitly save to SQLite here for redundancy!
      const rawProperties = result.records[0]?.get('a').properties || {
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
      
      const { sanitizeRecordDates } = require('../db/dateSanitizer');
      const sensorData = sanitizeRecordDates(rawProperties);
      
      // Save the sensor alert to SQLite fallback DB
      saveSensorAlert({
        id: sensorData.id,
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
        createdAt: sensorData.createdAt || new Date().toISOString()
      });
      
      // Attempt to save complaint to graph (this also internally saves to SQLite)
      await createComplaintNode(complaintData);
      
      // Broadcast sensor alert AND complaint to all connected clients
      broadcast('new_sensor_alert', sensorData);
      broadcast('new_complaint', complaintData);
      
      return res.status(201).json({
        success: true,
        message: 'Fault anomaly registered and complaint filed automatically',
        data: sensorData
      });
    } catch (err) {
      console.warn('POST /api/sensor encountered a fatal error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
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
