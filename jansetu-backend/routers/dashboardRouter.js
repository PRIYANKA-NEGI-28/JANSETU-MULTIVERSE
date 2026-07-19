const express = require('express');
const router = express.Router();
const { 
  getAllComplaints, 
  getComplaintByNumber, 
  getUserComplaints, 
  seedOfficers, 
  getAllOfficers, 
  getOfficersByDepartment, 
  assignOfficer, 
  escalateComplaintOfficer, 
  updateComplaintStatus,
  getDashboardStats,
  getGraphStats,
  runEscalationCheck,
  clearDatabase
} = require('../db/firebase');
const catchAsync = require('../utils/catchAsync');
const { broadcast } = require('../ws/broadcast');

// POST /api/dashboard - RPC endpoint for Firebase proxy operations
router.post('/', catchAsync(async (req, res) => {
    const { action, params } = req.body;
    
    if (action === 'getComplaintByNumber') {
      const complaint = await getComplaintByNumber(params.complaint_number);
      return res.json({ success: true, data: complaint });
    }
    
    if (action === 'getAllComplaints') {
      const complaints = await getAllComplaints();
      return res.json({ success: true, data: complaints });
    }

    if (action === 'getUserComplaints') {
      const complaints = await getUserComplaints(params.phone);
      return res.json({ success: true, data: complaints });
    }

    if (action === 'seedOfficers') {
      const count = await seedOfficers();
      return res.json({ success: true, data: { seeded: count } });
    }

    if (action === 'getAllOfficers') {
      const officers = await getAllOfficers();
      return res.json({ success: true, data: officers });
    }

    if (action === 'getOfficersByDepartment') {
      const officers = await getOfficersByDepartment(params.department);
      return res.json({ success: true, data: officers });
    }

    if (action === 'assignOfficer') {
      await assignOfficer(params.complaintId, params.officerId);
      broadcast('complaint_updated', { id: params.complaintId, status: 'ASSIGNED', officerId: params.officerId });
      return res.json({ success: true, data: { success: true } });
    }

    if (action === 'escalateComplaint') {
      await escalateComplaintOfficer(params.complaintId, params.escalationOfficerId);
      broadcast('complaint_updated', { id: params.complaintId, status: 'ESCALATED', officerId: params.escalationOfficerId });
      return res.json({ success: true, data: { success: true } });
    }

    if (action === 'updateStatus') {
      await updateComplaintStatus(params.id, params.status);
      broadcast('complaint_updated', { id: params.id, status: params.status });
      return res.json({ success: true, data: { success: true } });
    }

    if (action === 'runEscalationCheck') {
      const result = await runEscalationCheck();
      return res.json({ success: true, data: result });
    }

    if (action === 'getDepartmentStats') {
      // Assuming getDepartmentStats is in firebase.js
      const { getDepartmentStats } = require('../db/firebase');
      const stats = await getDepartmentStats();
      return res.json({ success: true, data: stats });
    }

    if (action === 'getGraphStats') {
      const stats = await getGraphStats();
      return res.json({ success: true, data: stats });
    }
    
    return res.status(400).json({ success: false, error: 'Unknown action' });
}));

// GET /api/dashboard - Dashboard initialization payload
router.get('/', catchAsync(async (req, res) => {
    // We mock RTI drafts for now as it was SQLite specific and not strictly required
    const rtiDrafts = [];

    try {
      const { activeList, stats } = await getDashboardStats();
      
      const criticalZones = []; // To keep UI happy

      return res.json({
        success: true,
        data: {
          activeList,
          stats,
          criticalZones,
          rtiDrafts
        }
      });
    } catch (error) {
      console.error('Firebase Dashboard GET error:', error);
      return res.status(500).json({ success: false, error: 'Failed to load dashboard data' });
    }
}));

// PATCH /api/dashboard/complaint/:id
router.patch('/complaint/:id', catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    await updateComplaintStatus(id, status);
    broadcast('complaint_updated', { id, status });
    return res.json({ success: true, data: { id, status } });
}));

// GET /api/dashboard/clear
router.get('/clear', catchAsync(async (req, res) => {
    try {
      await clearDatabase();
      return res.json({ success: true, message: 'All Firebase data has been wiped successfully.' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
}));

module.exports = router;
