const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const { saveRtiDraft } = require('../db/sqlite');
const crypto = require('crypto');

// POST /api/drafter - Spawns Python process for formal statutory RTI generation
router.post('/', (req, res) => {
  const form = req.body;
  if (!form || !form.authorityName) {
    return res.status(400).json({ success: false, error: 'Form data is missing required fields' });
  }

  // Spawn the python process to generate the formal RTI application
  const pythonScript = path.join(__dirname, '../ai/rti_drafter.py');
  const pythonProcess = spawn('C:\\LocalAI\\qai-env\\Scripts\\python.exe', [pythonScript, JSON.stringify(form), '--model', 'C:\\Users\\qcwor\\Desktop\\JanSetu-MultiVerse\\JANSETU-MULTIVERSE\\jansetu-backend\\ai\\models\\qwen\\Qwen3-0.6B-Q4_0.gguf']);

  let output = '';
  let errorOutput = '';
  let isKilled = false;

  // Enforce strict 180-second timeout (increased for local LLM CPU inference)
  const timeoutId = setTimeout(() => {
    isKilled = true;
    pythonProcess.kill('SIGKILL');
    console.error('LLM Process Timed Out (180s limit). Killed process.');
    return res.status(504).json({ success: false, error: 'Gateway Timeout: LLM script exceeded 180s limit' });
  }, 180000);

  // Collect text stream chunks
  pythonProcess.stdout.on('data', (data) => {
    output += data.toString();
  });

  // Track standard execution error logs
  pythonProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  pythonProcess.on('close', (code) => {
    if (isKilled) return; // Prevent double response if already timed out
    clearTimeout(timeoutId);

    if (code !== 0) {
      console.error(`Python process exited with code ${code}: ${errorOutput}`);
      return res.status(500).json({ success: false, error: 'RTI drafter failed', details: errorOutput });
    }
    
    try {
      const result = JSON.parse(output);
      
      const id = crypto.randomUUID();
      // Save draft (fallback to empty string if missing)
      saveRtiDraft(id, form.applicantName || 'Anonymous', form.authorityType || 'Unknown', result.draftText || '');
      
      res.status(200).json({ success: true, draftText: result.draftText, id });
    } catch (parseError) {
      console.error('Failed to parse RTI drafter output:', parseError);
      const id = crypto.randomUUID();
      saveRtiDraft(id, form.applicantName || 'Anonymous', form.authorityType || 'Unknown', output.trim());
      
      res.status(200).json({ success: true, draftText: output.trim(), id });
    }
  });
});

module.exports = router;
