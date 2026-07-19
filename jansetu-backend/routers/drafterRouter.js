const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const { saveRtiDraft } = require('../db/sqlite');
const crypto = require('crypto');

const catchAsync = require('../utils/catchAsync');

// POST /api/drafter - Spawns NPU child process for local LLM inference
router.post('/', catchAsync(async (req, res) => {
  const { authorityType, applicantDetails, informationRequired } = req.body;
  
  if (!authorityType || !informationRequired) {
    return res.status(400).json({ success: false, error: 'authorityType and informationRequired are required' });
  }

  // Construct a well-structured prompt context payload
  const prompt = `Draft a formal legal document/application addressed to ${authorityType}.
Applicant Details: ${applicantDetails || 'Anonymous'}
Information/Request Required: ${informationRequired}
Ensure the tone is formal and compliant with standard bureaucratic protocol.`;

  // Spawn the python process to invoke Llama-v3.2 on the NPU
  const pythonScript = path.join(__dirname, '../ai/llm_bridge.py');
  const pythonProcess = spawn('python3', [pythonScript, prompt]);

  let output = '';
  let errorOutput = '';
  let isKilled = false;

  // Enforce strict 15-second timeout
  const timeoutId = setTimeout(() => {
    isKilled = true;
    pythonProcess.kill('SIGKILL');
    console.error('LLM Process Timed Out (15s limit). Killed process.');
    return res.status(504).json({ success: false, error: 'Gateway Timeout: LLM script exceeded 15s limit' });
  }, 15000);

  // Collect text stream chunks over the stdout event channel natively
  pythonProcess.stdout.on('data', (data) => {
    output += data.toString();
  });

  // Track standard execution error logs using the stderr event handler
  pythonProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  pythonProcess.on('close', (code) => {
    if (isKilled) return; // Prevent double response if already timed out
    clearTimeout(timeoutId);

    if (code !== 0) {
      console.error(`Python process exited with code ${code}: ${errorOutput}`);
      return res.status(500).json({ success: false, error: 'LLM inference failed', details: errorOutput });
    }
    
    try {
      // Transmit the final text payload structure safely as JSON back to the calling client interface
      const result = JSON.parse(output);
      
      const id = crypto.randomUUID();
      saveRtiDraft(id, applicantDetails || 'Anonymous', authorityType, result.generated_text || output);
      
      res.status(200).json({ success: true, data: result, id });
    } catch (parseError) {
      const id = crypto.randomUUID();
      saveRtiDraft(id, applicantDetails || 'Anonymous', authorityType, output.trim());
      
      res.status(200).json({ success: true, data: { response: output.trim() }, id });
    }
  });
}));

module.exports = router;
