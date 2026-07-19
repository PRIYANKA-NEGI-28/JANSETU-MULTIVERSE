const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const { saveGrievanceDraft } = require('../db/sqlite');
const crypto = require('crypto');

// POST /api/grievance - Process raw citizen text into formal dual-language grievance drafts
router.post('/', (req, res) => {
  const { rawText, applicantName, applicantPhone, applicantAddress } = req.body;

  if (!rawText || rawText.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'rawText is required. Provide the citizen complaint text.'
    });
  }

  // Build command args for the Python grievance officer pipeline
  const pythonScript = path.join(__dirname, '../ai/grievance_officer.py');
  const args = [pythonScript, rawText, '--model', 'C:\\LocalAI\\models\\qwen2.5-onnx'];

  if (applicantName) {
    args.push('--name', applicantName);
  }
  if (applicantPhone) {
    args.push('--phone', applicantPhone);
  }
  if (applicantAddress) {
    args.push('--address', applicantAddress);
  }

  // Spawn the Python process
  const pythonProcess = spawn('C:\\LocalAI\\qai-env\\Scripts\\python.exe', args, {
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });

  let output = '';
  let errorOutput = '';
  let isKilled = false;

  // Enforce strict 180-second timeout
  const timeoutId = setTimeout(() => {
    isKilled = true;
    pythonProcess.kill('SIGKILL');
    console.error('LLM Process Timed Out (180s limit). Killed process.');
    return res.status(504).json({ success: false, error: 'Gateway Timeout: LLM script exceeded 180s limit' });
  }, 180000);

  // Collect stdout
  pythonProcess.stdout.on('data', (data) => {
    output += data.toString('utf-8');
  });

  // Collect stderr
  pythonProcess.stderr.on('data', (data) => {
    errorOutput += data.toString('utf-8');
  });

  pythonProcess.on('close', (code) => {
    if (isKilled) return;
    clearTimeout(timeoutId);

    if (code !== 0) {
      console.error(`Grievance Officer Python process exited with code ${code}: ${errorOutput}`);
      return res.status(500).json({
        success: false,
        error: 'Grievance processing failed',
        details: errorOutput
      });
    }

    try {
      const result = JSON.parse(output);

      // Save to SQLite
      const id = crypto.randomUUID();
      saveGrievanceDraft(
        id,
        applicantName || null,
        applicantPhone || null,
        rawText,
        result.section_1_analysis?.nature_of_grievance || 'General',
        result.section_1_analysis?.target_department || 'Unknown',
        result.section_2_english_draft || '',
        result.section_3_hindi_draft || '',
        JSON.stringify(result.section_1_analysis || {})
      );

      res.status(200).json({
        success: true,
        id,
        data: result
      });
    } catch (parseError) {
      console.error('Failed to parse grievance output:', parseError);
      // Return raw output if JSON parsing fails
      const id = crypto.randomUUID();
      res.status(200).json({
        success: true,
        id,
        data: { raw_response: output.trim() }
      });
    }
  });
});

// GET /api/grievance/history - Retrieve previously generated grievance drafts
router.get('/history', (req, res) => {
  try {
    const { getGrievanceDrafts } = require('../db/sqlite');
    const drafts = getGrievanceDrafts(50);
    res.status(200).json({ success: true, data: drafts });
  } catch (error) {
    console.error('Error fetching grievance history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch grievance history' });
  }
});

module.exports = router;
