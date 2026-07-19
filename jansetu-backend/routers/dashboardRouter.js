const express = require('express');
const router = express.Router();
const { runQuery } = require('../db/graph');
const { getRtiDrafts, getAllComplaints, getComplaintsByPhone, getComplaintByNumber } = require('../db/sqlite');
const catchAsync = require('../utils/catchAsync');
const { broadcast } = require('../ws/broadcast');

// POST /api/dashboard - RPC endpoint for Neo4j proxy operations
router.post('/', catchAsync(async (req, res) => {
    const { action, params } = req.body;
    
    if (action === 'getComplaintByNumber') {
      try {
        const query = `
          MATCH (c:Complaint {complaint_number: $complaint_number})
          OPTIONAL MATCH (c)-[:CLUSTER_WITH]-(similar:Complaint)
          RETURN c, collect(similar) as similar_complaints
        `;
        const result = await runQuery(query, params);
        
        if (result.records.length === 0) {
          throw new Error('Complaint not found in Neo4j, triggering SQLite fallback');
        }
        
        const record = result.records[0];
        const complaint = record.get('c').properties;
        const similar = record.get('similar_complaints').map(s => s.properties);
        
        complaint.similar_complaints = similar;
        complaint.similar_count = similar.length + 1;
        
        return res.json({ success: true, data: complaint });
      } catch (err) {
        console.log('Neo4j getComplaintByNumber failed, using SQLite fallback');
        const c = getComplaintByNumber(params.complaint_number);
        if (!c) {
          return res.json({ success: true, data: null });
        }
        
        return res.json({ success: true, data: {
          id: c.id,
          complaint_number: c.complaint_number,
          citizen_name: c.citizen_name,
          citizen_phone: c.citizen_phone,
          issue_type: c.issueType,
          department: c.department,
          area: c.area,
          ward: c.ward,
          raw_text: c.raw_text,
          summary: c.summary,
          language: c.language,
          lat: c.lat,
          lng: c.lng,
          imageUrl: c.imageUrl,
          urgency: c.urgency,
          status: c.status,
          created_at: c.createdAt,
          similar_count: 0
        }});
      }
    }
    
    if (action === 'getAllComplaints') {
      try {
        const query = `
          MATCH (c:Complaint)
          RETURN c ORDER BY c.created_at DESC
        `;
        const result = await runQuery(query);
        const complaints = result.records.map(r => r.get('c').properties);
        return res.json({ success: true, data: complaints });
      } catch (err) {
        console.log('Neo4j getAllComplaints failed, using SQLite fallback');
        const complaints = getAllComplaints();
        const mapped = complaints.map(c => ({
          id: c.id,
          complaint_number: c.complaint_number,
          citizen_name: c.citizen_name,
          citizen_phone: c.citizen_phone,
          issue_type: c.issueType,
          department: c.department,
          area: c.area,
          ward: c.ward,
          raw_text: c.raw_text,
          summary: c.summary,
          language: c.language,
          lat: c.lat,
          lng: c.lng,
          imageUrl: c.imageUrl,
          urgency: c.urgency,
          status: c.status,
          created_at: c.createdAt,
          similar_count: 0
        }));
        return res.json({ success: true, data: mapped });
      }
    }

    if (action === 'getUserComplaints') {
      try {
        const query = `
          MATCH (c:Complaint {citizen_phone: $phone})
          RETURN c ORDER BY c.created_at DESC
        `;
        const result = await runQuery(query, params);
        const complaints = result.records.map(r => r.get('c').properties);
        return res.json({ success: true, data: complaints });
      } catch (err) {
        console.log('Neo4j getUserComplaints failed, using SQLite fallback');
        const complaints = getComplaintsByPhone(params.phone);
        const mapped = complaints.map(c => ({
          id: c.id,
          complaint_number: c.complaint_number,
          citizen_name: c.citizen_name,
          citizen_phone: c.citizen_phone,
          issue_type: c.issueType,
          department: c.department,
          area: c.area,
          ward: c.ward,
          raw_text: c.raw_text,
          summary: c.summary,
          language: c.language,
          lat: c.lat,
          lng: c.lng,
          imageUrl: c.imageUrl,
          urgency: c.urgency,
          status: c.status,
          created_at: c.createdAt,
          similar_count: 0
        }));
        return res.json({ success: true, data: mapped });
      }
    }

    const { seedOfficers, getAllOfficers, getOfficersByDepartment, assignOfficer, escalateComplaint, updateComplaintStatus } = require('../db/sqlite');

    if (action === 'seedOfficers') {
      const count = seedOfficers();
      return res.json({ success: true, data: { seeded: count } });
    }

    if (action === 'getAllOfficers') {
      const officers = getAllOfficers();
      return res.json({ success: true, data: officers });
    }

    if (action === 'getOfficersByDepartment') {
      const officers = getOfficersByDepartment(params.department);
      return res.json({ success: true, data: officers });
    }

    if (action === 'assignOfficer') {
      assignOfficer(params.complaintId, params.officerId);
      broadcast('complaint_updated', { id: params.complaintId, status: 'ASSIGNED', officerId: params.officerId });
      return res.json({ success: true, data: { success: true } });
    }

    if (action === 'escalateComplaint') {
      escalateComplaint(params.complaintId, params.escalationOfficerId);
      broadcast('complaint_updated', { id: params.complaintId, status: 'ESCALATED', officerId: params.escalationOfficerId });
      return res.json({ success: true, data: { success: true } });
    }

    if (action === 'updateStatus') {
      updateComplaintStatus(params.id, params.status);
      broadcast('complaint_updated', { id: params.id, status: params.status });
      return res.json({ success: true, data: { success: true } });
    }
    
    return res.status(400).json({ success: false, error: 'Unknown action' });
}));

// GET /api/dashboard - Dashboard initialization payload
router.get('/', catchAsync(async (req, res) => {
    // 4. Fetch RTI drafts from SQLite (this should work locally)
    const rtiDrafts = getRtiDrafts(50); // adjust limit as needed

    // Initialize default values for Neo4j data
    let activeList = [];
    let stats = { total: 0, pending: 0, resolved: 0, escalated: 0, inProgress: 0 };
    let criticalZones = [];

    // Try to get Neo4j data, but don't fail if Neo4j is unavailable
    try {
      // 1. Retrieve a chronological listing of unified active complaints & anomalies
      const listQuery = `
        MATCH (n) WHERE (n:Complaint OR n:SensorAnomaly) AND n.status <> 'RESOLVED'
        RETURN n ORDER BY n.createdAt DESC LIMIT 50
      `;

      // 2. Pull a distinct count metrics payload
      const statsQuery = `
        MATCH (n) WHERE n:Complaint OR n:SensorAnomaly
        RETURN
          count(n) AS total,
          sum(CASE WHEN n.status = 'PENDING' OR n.status = 'FAULT' THEN 1 ELSE 0 END) AS pending,
          sum(CASE WHEN n.status = 'RESOLVED' THEN 1 ELSE 0 END) AS resolved,
          sum(CASE WHEN n.status = 'ESCALATED' THEN 1 ELSE 0 END) AS escalated,
          sum(CASE WHEN n.status = 'IN_PROGRESS' OR n.status = 'ASSIGNED' OR n.status = 'FAULT' THEN 1 ELSE 0 END) AS inProgress
      `;

      // 3. Aggregate cluster grouping relationships to identify "Critical Repair Zones"
      const clustersQuery = `
        MATCH (n)-[r:CLUSTER_WITH]-(m)
        WHERE (n:Complaint OR n:SensorAnomaly) AND (n.status = 'PENDING' OR n.status = 'FAULT')
        RETURN n.lat AS lat, n.lng AS lng, count(m) AS clusterSize
        ORDER BY clusterSize DESC
        LIMIT 5
      `;

      // Execute Neo4j queries simultaneously
      const [listResult, statsResult, clustersResult] = await Promise.all([
        runQuery(listQuery),
        runQuery(statsQuery),
        runQuery(clustersQuery)
      ]);

      activeList = listResult.records.map(r => r.get('n').properties);
      const statsRecord = statsResult.records[0];
      stats = {
        total: statsRecord.get('total').toNumber(),
        pending: statsRecord.get('pending').toNumber(),
        resolved: statsRecord.get('resolved').toNumber(),
        escalated: statsRecord.get('escalated').toNumber(),
        inProgress: statsRecord.get('inProgress').toNumber()
      };
      criticalZones = clustersResult.records.map(r => ({
        lat: r.get('lat'),
        lng: r.get('lng'),
        clusterSize: r.get('clusterSize').toNumber()
      }));
    } catch (neo4jError) {
      // Log Neo4j error but continue with SQLite data
      console.warn('Neo4j query failed, continuing with SQLite data only:', neo4jError.message);

      const sqliteComplaints = getAllComplaints();
      activeList = sqliteComplaints.map(c => ({
         id: c.id,
         complaint_number: c.complaint_number || c.id.substring(0, 15),
         citizen_name: c.citizen_name || 'Anonymous',
         issue_type: c.issueType || 'General Complaint',
         department: c.department || 'General Administration',
         area: c.area || 'Unknown Area',
         ward: c.ward || 'Unknown Ward',
         status: c.status || 'PENDING',
         urgency: c.urgency || 'MEDIUM',
         lat: c.lat || 0,
         lng: c.lng || 0,
         similar_count: 0
      }));

      stats = {
         total: activeList.length,
         pending: activeList.filter(c => c.status === 'PENDING').length,
         resolved: activeList.filter(c => c.status === 'RESOLVED').length,
         escalated: activeList.filter(c => c.status === 'ESCALATED').length,
         inProgress: activeList.filter(c => c.status === 'IN_PROGRESS' || c.status === 'ASSIGNED').length
      };
    }

    res.status(200).json({
      success: true,
      data: {
        activeList,
        stats,
        criticalZones,
        rtiDrafts
      }
    });
}));

// PATCH /api/dashboard/complaint/:id
router.patch('/complaint/:id', catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status, threat_indicator } = req.body;

    // Dynamically build SET clause for the structural properties requested
    let setClauses = [];
    let params = { id };

    if (status !== undefined) {
      setClauses.push('n.status = $status');
      params.status = status;
    }
    if (threat_indicator !== undefined) {
      setClauses.push('n.threatIndicator = $threat_indicator');
      params.threat_indicator = threat_indicator;
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: 'No update properties provided' });
    }

    const query = `
      MATCH (n) WHERE (n:Complaint OR n:SensorAnomaly) AND n.id = $id
      SET ${setClauses.join(', ')}
      RETURN n
    `;

    const result = await runQuery(query, params);

    if (result.records.length === 0) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Structural properties updated',
      data: result.records[0].get('n').properties
    });
}));

module.exports = router;
