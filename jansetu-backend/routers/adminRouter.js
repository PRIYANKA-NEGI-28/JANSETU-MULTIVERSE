const express = require('express');
const router = express.Router();
const { 
  getAllComplaints, 
  getDepartmentStats, 
  getGraphStats,
  getDashboardStats 
} = require('../db/firebase');
const catchAsync = require('../utils/catchAsync');

// GET /api/admin/stats/department - Get department-wise statistics
router.get('/stats/department', catchAsync(async (req, res) => {
  const departments = await getDepartmentStats();
  return res.json({ success: true, data: departments });
}));

// GET /api/admin/stats/graph - Get graph statistics
router.get('/stats/graph', catchAsync(async (req, res) => {
  const stats = await getGraphStats();
  return res.json({ success: true, data: stats });
}));

// GET /api/admin/dashboard - Combined admin dashboard data
router.get('/dashboard', catchAsync(async (req, res) => {
  const { activeList, stats } = await getDashboardStats();
  return res.json({ 
    success: true, 
    data: { 
      activeList, 
      stats, 
      criticalZones: [], 
      rtiDrafts: [] 
    } 
  });
}));

// POST /api/admin/escalation/check - Trigger an escalation check manually
router.post('/escalation/check', catchAsync(async (req, res) => {
  const { runEscalationCheck } = require('../db/firebase');
  const result = await runEscalationCheck();
  return res.json({ success: true, data: result });
}));

module.exports = router;