const express = require('express');
const router = express.Router();
const { recordSensorFault, resolveSensorFault } = require('../db/graph');

// Hardcoded location and assignment profiles mapped to device IDs
const DEVICE_PROFILES = {
  'UNO_Q_01': { lat: 28.6139, lng: 77.2090, ward: 'Central Ward', department: 'Electrical Maintenance' },
  'UNO_Q_02': { lat: 28.5355, lng: 77.2410, ward: 'South Ward', department: 'Water Supply' }
};
const FALLBACK_PROFILE = { lat: 28.6000, lng: 77.2000, ward: 'General Ward', department: 'City Maintenance' };

// POST /api/sensor - Intercept Arduino UNO Q node telemetry
router.post('/', async (req, res) => {
  try {
    const { device_id, status, type } = req.body;
    
    if (!device_id || !status) {
      return res.status(400).json({ success: false, error: 'Missing device_id or status' });
    }

    if (status === 'FAULT') {
      const location = DEVICE_PROFILES[device_id] || FALLBACK_PROFILE;
      const result = await recordSensorFault(device_id, type || 'UNKNOWN', location);
      
      return res.status(201).json({
        success: true,
        message: 'Fault anomaly registered and assigned to department',
        data: result.records[0]?.get('a').properties
      });
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
