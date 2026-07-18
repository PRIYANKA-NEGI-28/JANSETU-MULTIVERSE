const express = require('express');
const router = express.Router();
const { runQuery } = require('../db/graph');
const { getAllComplaints } = require('../db/sqlite');

// GET /api/admin/stats/department - Get department-wise statistics
router.get('/stats/department', async (req, res) => {
  try {
    // Get all complaints from SQLite (which has department field)
    const complaints = getAllComplaints();

    // Aggregate by department
    const deptStats = {};

    complaints.forEach(complaint => {
      const dept = complaint.department || 'Unknown';
      if (!deptStats[dept]) {
        deptStats[dept] = {
          name: dept,
          total_complaints: 0,
          resolved_complaints: 0,
          pending_count: 0,
          escalated_count: 0,
          avg_resolution_days: 0 // We don't have resolved dates, so placeholder
        };
      }

      deptStats[dept].total_complaints++;

      if (complaint.status === 'RESOLVED') {
        deptStats[dept].resolved_complaints++;
      } else if (complaint.status === 'PENDING') {
        deptStats[dept].pending_count++;
      } else if (complaint.status === 'ESCALATED') {
        deptStats[dept].escalated_count++;
      }
    });

    // Convert to array and calculate trust score (simplified)
    const departments = Object.values(deptStats).map(dept => {
      // Simple trust score based on resolution rate
      const resolutionRate = dept.total_complaints > 0
        ? (dept.resolved_complaints / dept.total_complaints) * 100
        : 0;

      return {
        id: dept.name.toLowerCase().replace(/\s+/g, '_'),
        name: dept.name,
        total_complaints: dept.total_complaints,
        resolved_complaints: dept.resolved_complaints,
        pending_count: dept.pending_count,
        escalated_count: dept.escalated_count,
        avg_resolution_days: dept.avg_resolution_days, // Placeholder
        trust_score: Math.round(resolutionRate)
      };
    });

    // Sort by total complaints descending
    departments.sort((a, b) => b.total_complaints - a.total_complaints);

    res.json({ success: true, data: departments });
  } catch (error) {
    console.error('Error fetching department stats:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /api/admin/escalation/check - Run escalation check
router.post('/escalation/check', async (req, res) => {
  try {
    // In a real implementation, this would check SLAs and escalate complaints
    // For now, we'll return a mock result
    const complaints = getAllComplaints();

    // Count complaints that are PENDING and older than some threshold (e.g., 24 hours)
    const now = new Date();
    const escalatedCount = complaints.filter(complaint => {
      if (complaint.status !== 'PENDING') return false;

      const createdAt = new Date(complaint.createdAt);
      const hoursOld = (now - createdAt) / (1000 * 60 * 60);
      return hoursOld > 24; // Escalate if pending for more than 24 hours
    }).length;

    // In a real system, we would update the status of these complaints to ESCALATED
    // For now, just return the count

    res.json({
      success: true,
      data: {
        escalated_count: escalatedCount,
        message: `Found ${escalatedCount} complaints eligible for escalation`
      }
    });
  } catch (error) {
    console.error('Error running escalation check:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /api/admin/stats/graph - Get detailed graph statistics
router.get('/stats/graph', async (req, res) => {
  try {
    // Try to get data from Neo4j
    let total = 0;
    let clustered = 0;
    let escalated = 0;
    let hotspots = [];

    try {
      // Get total nodes (Complaint + SensorAnomaly)
      const totalQuery = `
        MATCH (n) WHERE n:Complaint OR n:SensorAnomaly
        RETURN count(n) AS total
      `;
      const totalResult = await runQuery(totalQuery);
      total = totalResult.records[0].get('total').toNumber() || 0;

      // Get clustered nodes (those with CLUSTER_WITH relationships)
      const clusteredQuery = `
        MATCH (n)-[r:CLUSTER_WITH]-(m)
        WHERE (n:Complaint OR n:SensorAnomaly) AND (m:Complaint OR m:SensorAnomaly)
        RETURN count(DISTINCT n) AS clustered
      `;
      const clusteredResult = await runQuery(clusteredQuery);
      clustered = clusteredResult.records[0].get('clustered').toNumber() || 0;

      // Get escalated complaints (those with status ESCALATED)
      const escalatedQuery = `
        MATCH (n:Complaint {status: 'ESCALATED'})
        RETURN count(n) AS escalated
      `;
      const escalatedResult = await runQuery(escalatedQuery);
      escalated = escalatedResult.records[0].get('escalated').toNumber() || 0;

      // Get hotspots (areas with high complaint density)
      const hotspotsQuery = `
        MATCH (n:Complaint)
        WHERE n.area IS NOT NULL
        RETURN n.area AS area, count(n) AS count
        ORDER BY count DESC
        LIMIT 10
      `;
      const hotspotsResult = await runQuery(hotspotsQuery);
      hotspots = hotspotsResult.records.map(record => ({
        area: record.get('area'),
        count: record.get('count').toInt()
      }));
    } catch (neo4jError) {
      console.warn('Neo4j query failed, using SQLite data only:', neo4jError.message);

      // Fallback to SQLite data
      const complaints = getAllComplaints();
      total = complaints.length;

      // Simple clustering based on proximity (simplified)
      // In reality, we'd use proper geospatial clustering
      clustered = Math.min(total, Math.floor(total * 0.3)); // Assume 30% are clustered

      // Count escalated from SQLite
      escalated = complaints.filter(c => c.status === 'ESCALATED').length;

      // Get hotspots from SQLite (area-based grouping)
      const areaCounts = {};
      complaints.forEach(complaint => {
        const area = complaint.area || 'Unknown';
        areaCounts[area] = (areaCounts[area] || 0) + 1;
      });

      hotspots = Object.entries(areaCounts)
        .map(([area, count]) => ({ area, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }

    res.json({
      success: true,
      data: {
        total,
        clustered,
        escalated,
        hotspots
      }
    });
  } catch (error) {
    console.error('Error fetching graph stats:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /api/admin/dashboard - Enhanced dashboard for admin
router.get('/dashboard', async (req, res) => {
  try {
    // Get basic dashboard data (same as regular dashboard)
    const rtiDrafts = require('../db/sqlite').getRtiDrafts(50);

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

      // 2. Pull an enhanced count metrics payload
      const statsQuery = `
        MATCH (n) WHERE n:Complaint OR n:SensorAnomaly
        RETURN
          count(n) AS total,
          sum(CASE WHEN n.status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
          sum(CASE WHEN n.status = 'RESOLVED' THEN 1 ELSE 0 END) AS resolved,
          sum(CASE WHEN n.status = 'ESCALATED' THEN 1 ELSE 0 END) AS escalated,
          sum(CASE WHEN n.status = 'IN_PROGRESS' OR n.status = 'ASSIGNED' THEN 1 ELSE 0 END) AS inProgress
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
      // Log Neo4j error but continue with SQLite data only
      console.warn('Neo4j query failed, continuing with SQLite data only:', neo4jError.message);

      const sqliteComplaints = getAllComplaints();
      activeList = sqliteComplaints.map(c => ({
         id: c.id,
         complaint_number: c.id.substring(0, 15),
         citizen_name: 'Local Citizen (Offline)',
         issue_type: c.issueType || 'General Complaint',
         department: 'Offline Mode Dept',
         area: 'Local Storage',
         ward: 'N/A',
         status: c.status || 'PENDING',
         urgency: c.urgency || 'MEDIUM',
         lat: c.lat,
         lng: c.lng,
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
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;