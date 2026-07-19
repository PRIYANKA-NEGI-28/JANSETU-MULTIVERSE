const express = require('express');
const router = express.Router();
const { createComplaint } = require('../db/firebase');
const upload = require('../middleware/upload');
const multer = require('multer');
const crypto = require('crypto');

const catchAsync = require('../utils/catchAsync');
const { broadcast } = require('../ws/broadcast');

// POST /api/complaint - Register a new complaint with optional image upload
// Accepts multipart/form-data from the mobile app with these fields:
//   name, phone, text, area, ward, city, issue_type, urgency, department,
//   summary, voice_transcript, complaint_number, latitude, longitude,
//   llm_validation, image_file (optional file)
router.post('/', upload.single('image_file'), catchAsync(async (req, res) => {
  const body = req.body;

  // ── Map the mobile app's field names to our internal schema ──
  const citizenName  = body.name        || body.citizenName  || 'Anonymous';
  const citizenPhone = body.phone       || body.citizenPhone || '';
  const rawText      = body.text        || body.rawText      || body.voice_transcript || '';
  const language     = body.language    || 'en';
  const summary      = body.summary    || '';
  const department   = body.department  || 'General Administration';
  const area         = body.area        || 'Unknown Area';
  const ward         = body.ward        || 'Unknown Ward';
  const issueType    = body.issue_type  || body.issueType || 'General';
  const urgency      = body.urgency     || 'MEDIUM';

  // lat/lng: mobile sends "latitude" / "longitude" as strings
  const parsedLat = parseFloat(body.latitude || body.lat);
  const lat = !isNaN(parsedLat) ? parsedLat : 28.6139;
  const parsedLng = parseFloat(body.longitude || body.lng);
  const lng = !isNaN(parsedLng) ? parsedLng : 77.2090;

  // Use the complaint_number from the mobile app if provided, else generate one
  const complaint_number = body.complaint_number
    || `JS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000) + 1000}`;

  const imageUrl = req.file ? req.file.path : (body.imageUrl || null);
  const id = crypto.randomUUID();

  // Create complaint in Firebase
  const complaintData = await createComplaint({
    id,
    complaint_number,
    citizen_name: citizenName,
    citizen_phone: citizenPhone,
    raw_text: rawText,
    language,
    summary,
    department,
    area,
    ward,
    issue_type: issueType,
    lat,
    lng,
    imageUrl,
    urgency,
    status: 'PENDING',
    similar_count: 1
  });

  // Broadcast to all WebSocket clients for real-time update
  broadcast('new_complaint', complaintData);

  res.status(201).json({
    success: true,
    message: 'Complaint created successfully',
    data: complaintData
  });
}));

// Error handling middleware for Multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large'
      });
    }
    return res.status(400).json({
      success: false,
      error: error.message
    });
  } else if (error) {
    // Handle other errors
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
  next();
});

module.exports = router;
