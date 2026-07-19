const express = require('express');
const router = express.Router();
const { 
  getSensorAlerts, 
  recordSensorFault, 
  resolveSensorFault, 
  createComplaint, 
  getAllComplaints,
  updateComplaint 
} = require('../db/firebase');
const catchAsync = require('../utils/catchAsync');
const { broadcast } = require('../ws/broadcast');

// Fallback profile if IoT device does not send its location/department metadata
const FALLBACK_PROFILE = { lat: 28.6000, lng: 77.2000, ward: 'Sector 135', department: 'Municipal Corporation - General Administration' };

function normalizeType(raw) {
  if (!raw) return 'UNKNOWN';
  const upper = raw.toUpperCase().replace(/[\s_-]+/g, '');
  if (upper === 'STREETLIGHT' || upper === 'STREET_LIGHT') return 'STREETLIGHT';
  return raw;
}

// GET /api/sensor - Fetch all active sensor anomalies
router.get('/', catchAsync(async (req, res) => {
  const alerts = await getSensorAlerts();
  return res.json({ success: true, alerts });
}));

// POST /api/sensor - Intercept Arduino UNO Q node telemetry
router.post('/', catchAsync(async (req, res) => {
  const device_id = req.body.device_id || req.body.deviceId;
  const status = req.body.status;
  const type = normalizeType(req.body.type);

  console.log(`[IoT] Received: device_id=${device_id}, status=${status}, type=${type}`);

  if (!device_id || !status) {
    return res.status(400).json({ success: false, error: 'Missing device_id or status' });
  }

  // ONLY PROCESS FAULT STATUS
  if (status === 'FAULT') {
    const location = {
      lat: req.body.lat !== undefined ? parseFloat(req.body.lat) : FALLBACK_PROFILE.lat,
      lng: req.body.lng !== undefined ? parseFloat(req.body.lng) : FALLBACK_PROFILE.lng,
      ward: FALLBACK_PROFILE.ward,
      department: FALLBACK_PROFILE.department
    };

    // Create NEW complaint and sensor alert every single time
    const complaint_number = `IOT-CMP-${Date.now()}`;
    
    const complaintData = await createComplaint({
      complaint_number,
      citizen_name: 'IoT Node ' + device_id,
      citizen_phone: '',
      raw_text: `Automated fault alert from ${device_id}`,
      language: 'en',
      summary: `Automated fault alert from ${device_id}`,
      department: location.department,
      area: location.ward,
      ward: location.ward,
      issue_type: type,
      lat: location.lat,
      lng: location.lng,
      imageUrl: null,
      urgency: 'HIGH',
      status: 'PENDING',
      similar_count: 1,
      device_id: device_id
    });

    broadcast('new_complaint', complaintData);

    const sensorData = {
      id: 'sens-' + Date.now() + Math.floor(Math.random()*1000),
      device_id,
      type,
      status: 'FAULT',
      lat: location.lat,
      lng: location.lng,
      ward: location.ward,
      department: location.department,
      description: `Automated fault alert from ${device_id}`,
      severity: 'HIGH',
      area: location.ward,
      createdAt: new Date().toISOString()
    };
    
    await recordSensorFault(sensorData);
    broadcast('new_sensor_alert', sensorData);

    return res.status(201).json({
      success: true,
      message: 'Fault anomaly registered and complaint filed automatically',
      data: {
        id: sensorData.id,
        device_id,
        type,
        status: 'FAULT',
        lat: sensorData.lat,
        lng: sensorData.lng,
        createdAt: sensorData.createdAt
      }
    });
  }

  // If status is anything else (like RESOLVED), do absolutely nothing, just acknowledge it.
  return res.status(200).json({ success: true, message: 'Status ignored per configuration.' });
}));

module.exports = router;
