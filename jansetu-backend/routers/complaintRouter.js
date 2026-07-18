const express = require('express');
const router = express.Router();
const { runQuery, createComplaintNode } = require('../db/graph');
const upload = require('../middleware/upload');

const crypto = require('crypto');

// POST /api/complaint - Register a new complaint with optional image upload
router.post('/', upload.single('image_file'), async (req, res) => {
  try {
    const { issueType, urgency } = req.body;
    // Enforce standard default safety values for lat/lng (e.g., core municipality coordinates)
    const parsedLat = parseFloat(req.body.lat);
    const lat = !isNaN(parsedLat) ? parsedLat : 28.6139; // New Delhi Lat fallback
    const parsedLng = parseFloat(req.body.lng);
    const lng = !isNaN(parsedLng) ? parsedLng : 77.2090; // New Delhi Lng fallback
    
    const imageUrl = req.file ? req.file.path : (req.body.imageUrl || null);
    const id = crypto.randomUUID();

    // Create complaint node in Neo4j using the new graph transaction
    const result = await createComplaintNode({
      id,
      issueType: issueType || 'General',
      lat,
      lng,
      imageUrl,
      urgency: urgency || 'MEDIUM',
      status: 'PENDING'
    });
    
    res.status(201).json({
      success: true,
      message: 'Complaint created successfully',
      data: result.records[0].get('c').properties
    });
  } catch (error) {
    console.error('Error creating complaint:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
