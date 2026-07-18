const express = require('express');
const router = express.Router();
const { runQuery } = require('../db/graph');
const { getRtiDrafts } = require('../db/sqlite');

// GET /api/dashboard - Fetch data for the dashboard
router.get('/', async (req, res) => {
  try {
    // 4. Fetch RTI drafts from SQLite (this should work locally)
    const rtiDrafts = getRtiDrafts(50); // adjust limit as needed

    // Initialize default values for Neo4j data
    let activeList = [];
    let stats = { total: 0, pending: 0, resolved: 0, escalated: 0 };
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
          sum(CASE WHEN n.status = 'ESCALATED' THEN 1 ELSE 0 END) AS escalated
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
        escalated: statsRecord.get('escalated').toNumber()
      };
      criticalZones = clustersResult.records.map(r => ({
        lat: r.get('lat'),
        lng: r.get('lng'),
        clusterSize: r.get('clusterSize').toNumber()
      }));
    } catch (neo4jError) {
      // Log Neo4j error but continue with SQLite data
      console.warn('Neo4j query failed, continuing with SQLite data only:', neo4jError.message);
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
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// PATCH /api/complaint/:id - Update complaint/anomaly structural property node values
router.patch('/complaint/:id', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error updating properties:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
