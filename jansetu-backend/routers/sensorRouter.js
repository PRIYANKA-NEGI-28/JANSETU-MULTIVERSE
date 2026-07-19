const express = require('express');
const router = express.Router();
const { recordSensorFault, resolveSensorFault, runQuery, createComplaintNode } = require('../db/graph');
const { saveSensorAlert, getSensorAlerts, saveComplaint, db } = require('../db/sqlite');
const catchAsync = require('../utils/catchAsync');
const { broadcast } = require('../ws/broadcast');
const { sanitizeRecordDates } = require('../db/dateSanitizer');

// Fallback profile if IoT device does not send its location/department metadata
const FALLBACK_PROFILE = { lat: 28.6000, lng: 77.2000, ward: 'Sector 135', department: 'Municipal Corporation - General Administration' };

// Normalize the type string sent by IoT devices
// IoT sends "STREETLIGHT" (no underscore) — map it to our internal key
function normalizeType(raw) {
  if (!raw) return 'UNKNOWN';
  const upper = raw.toUpperCase().replace(/[\s_-]+/g, '');
  if (upper === 'STREETLIGHT' || upper === 'STREET_LIGHT') return 'STREETLIGHT';
  return raw;
}

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
// Exact payload from IoT:  { "device_id": "UNO_Q_01", "status": "FAULT"|"RESOLVED", "type": "STREETLIGHT" }
router.post('/', catchAsync(async (req, res) => {
  const device_id = req.body.device_id || req.body.deviceId;
  const status = req.body.status;
  const type = normalizeType(req.body.type);

  console.log(`[IoT] Received: device_id=${device_id}, status=${status}, type=${type}`);

  if (!device_id || !status) {
    console.log('Rejected sensor payload:', req.body);
    return res.status(400).json({ success: false, error: 'Missing device_id or status' });
  }

  // ━━━━━━━━━━━━━━━ FAULT STATUS ━━━━━━━━━━━━━━━
  if (status === 'FAULT') {
    const location = {
      lat: req.body.lat !== undefined ? parseFloat(req.body.lat) : FALLBACK_PROFILE.lat,
      lng: req.body.lng !== undefined ? parseFloat(req.body.lng) : FALLBACK_PROFILE.lng,
      ward: FALLBACK_PROFILE.ward,
      department: FALLBACK_PROFILE.department
    };

    // ── Check for existing active IoT complaint for this device ──
    let existingComplaintId = null;
    let newSimilarCount = 1;

    try {
      const checkQuery = `
        MATCH (c:Complaint)
        WHERE c.citizen_name = 'IoT' AND c.raw_text CONTAINS $deviceId AND c.status <> 'RESOLVED'
        RETURN c LIMIT 1
      `;
      const checkResult = await runQuery(checkQuery, { deviceId: device_id });
      if (checkResult.records.length > 0) {
        const cNode = checkResult.records[0].get('c').properties;
        existingComplaintId = cNode.id;
        const existingCount = typeof cNode.similar_count === 'object' && cNode.similar_count.low !== undefined
          ? cNode.similar_count.low : (cNode.similar_count || 1);
        newSimilarCount = existingCount + 1;
      }
    } catch (err) {
      console.warn('Neo4j check existing complaint failed, checking SQLite fallback:', err.message);
    }

    if (!existingComplaintId) {
      try {
        const row = db.prepare("SELECT * FROM complaints WHERE citizen_name = 'IoT' AND raw_text LIKE ? AND status <> 'RESOLVED' LIMIT 1").get(`%${device_id}%`);
        if (row) {
          existingComplaintId = row.id;
          newSimilarCount = (row.similar_count || 1) + 1;
        }
      } catch (err) {
        console.error('SQLite check existing complaint failed:', err.message);
      }
    }

    // ── DUPLICATE FAULT: increment counter ──
    if (existingComplaintId) {
      console.log(`Duplicate IoT fault detected for ${device_id}. Incrementing similar_count to x${newSimilarCount}.`);

      // Update Neo4j
      try {
        await runQuery(`MATCH (c:Complaint {id: $id}) SET c.similar_count = $count RETURN c`,
          { id: existingComplaintId, count: newSimilarCount });
      } catch (err) { console.warn('Failed to update similar_count in Neo4j:', err.message); }

      // Update SQLite
      try {
        db.prepare("UPDATE complaints SET similar_count = ? WHERE id = ?").run(newSimilarCount, existingComplaintId);
      } catch (err) { console.error('Failed to update similar_count in SQLite:', err.message); }

      // Broadcast the update
      broadcast('complaint_updated', { id: existingComplaintId, status: 'PENDING', similar_count: newSimilarCount });

      // Also log as a sensor alert for IoT Monitor
      const sensorData = {
        id: 'SENS-DUP-' + Date.now(),
        device_id,
        type,
        status: 'FAULT',
        lat: location.lat,
        lng: location.lng,
        ward: location.ward,
        department: location.department,
        description: `Duplicate fault from ${device_id} (Count: x${newSimilarCount})`,
        severity: 'HIGH',
        area: location.ward,
        createdAt: new Date().toISOString()
      };
      saveSensorAlert(sensorData);
      broadcast('new_sensor_alert', sensorData);

      return res.status(200).json({
        success: true,
        message: `Duplicate fault registered. Count incremented to x${newSimilarCount}`,
        data: sensorData
      });
    }

    // ── FIRST FAULT: create new complaint + sensor alert ──
    const complaintId = 'IOT-CMP-' + Date.now();
    const complaintData = {
      id: complaintId,
      complaint_number: complaintId,
      citizenName: 'IoT',
      citizenPhone: 'N/A',
      rawText: `Automatic fault detected by sensor ${device_id}. Immediate maintenance required.`,
      language: 'en',
      summary: `Sensor Fault: ${type}`,
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
      const result = await recordSensorFault(device_id, type, location);

      const rawProperties = result.records[0]?.get('a').properties || {
        id: 'SENS-' + Date.now(),
        device_id,
        type,
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

      const sensorData = sanitizeRecordDates(rawProperties);

      // Save sensor alert to SQLite
      saveSensorAlert({
        id: sensorData.id,
        device_id,
        type,
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

      // Save complaint to graph + SQLite
      await createComplaintNode(complaintData);

      // Broadcast sensor alert
      broadcast('new_sensor_alert', sensorData);

      // Broadcast complaint with normalized keys for the frontend
      broadcast('new_complaint', {
        id: complaintData.id,
        complaint_number: complaintData.complaint_number,
        citizen_name: complaintData.citizenName,
        citizen_phone: complaintData.citizenPhone,
        issue_type: complaintData.issueType,
        department: complaintData.department,
        area: complaintData.area,
        ward: complaintData.ward,
        raw_text: complaintData.rawText,
        summary: complaintData.summary,
        language: complaintData.language,
        lat: complaintData.lat,
        lng: complaintData.lng,
        imageUrl: complaintData.imageUrl,
        urgency: complaintData.urgency,
        status: complaintData.status,
        created_at: complaintData.createdAt,
        similar_count: 1
      });

      return res.status(201).json({
        success: true,
        message: 'Fault anomaly registered and complaint filed automatically',
        data: sensorData
      });
    } catch (err) {
      console.warn('POST /api/sensor encountered a fatal error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }

  // ━━━━━━━━━━━━━━━ RESOLVED STATUS ━━━━━━━━━━━━━━━
  } else if (status === 'RESOLVED') {
    console.log(`[IoT] RESOLVED signal received for device ${device_id}`);

    // 1. Resolve the SensorAnomaly node in Neo4j
    try {
      await resolveSensorFault(device_id);
    } catch (err) {
      console.warn('Neo4j resolveSensorFault failed:', err.message);
    }

    // 2. Also update the sensor_alerts table in SQLite
    try {
      db.prepare("UPDATE sensor_alerts SET status = 'RESOLVED' WHERE device_id = ? AND status = 'FAULT'").run(device_id);
    } catch (err) {
      console.error('SQLite resolve sensor_alerts failed:', err.message);
    }

    // 3. Resolve the corresponding auto-filed IoT complaint
    let resolvedComplaintId = null;
    try {
      const result = await runQuery(
        `MATCH (c:Complaint) WHERE c.citizen_name = 'IoT' AND c.raw_text CONTAINS $deviceId AND c.status <> 'RESOLVED'
         SET c.status = 'RESOLVED' RETURN c LIMIT 1`,
        { deviceId: device_id }
      );
      if (result.records.length > 0) {
        resolvedComplaintId = result.records[0].get('c').properties.id;
      }
    } catch (err) {
      console.warn('Neo4j resolve complaint failed:', err.message);
    }

    // SQLite fallback: resolve the complaint there too
    try {
      const row = db.prepare("SELECT id FROM complaints WHERE citizen_name = 'IoT' AND raw_text LIKE ? AND status <> 'RESOLVED' LIMIT 1").get(`%${device_id}%`);
      if (row) {
        db.prepare("UPDATE complaints SET status = 'RESOLVED' WHERE id = ?").run(row.id);
        resolvedComplaintId = resolvedComplaintId || row.id;
      }
    } catch (err) {
      console.error('SQLite resolve complaint failed:', err.message);
    }

    // 4. Broadcast both events to the frontend
    broadcast('sensor_resolved', { device_id });
    if (resolvedComplaintId) {
      broadcast('complaint_updated', { id: resolvedComplaintId, status: 'RESOLVED' });
    }

    return res.status(200).json({
      success: true,
      message: 'Fault resolved. Sensor alert and complaint marked as RESOLVED.',
      device_id,
      resolvedComplaintId
    });

  // ━━━━━━━━━━━━━━━ UNKNOWN STATUS ━━━━━━━━━━━━━━━
  } else {
    console.log(`Ignored sensor payload with status: ${status}`);
    return res.status(200).json({ success: true, message: `Ignored status: ${status}` });
  }
}));

module.exports = router;
