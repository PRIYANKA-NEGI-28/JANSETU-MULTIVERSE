const neo4j = require('neo4j-driver');
require('dotenv').config();

const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const user = process.env.NEO4J_USERNAME || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'password';

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

// Startup verification script that tests the Neo4j database driver socket connection
async function verifyConnection() {
  const session = driver.session();
  try {
    // Run a shallow test query to guarantee the database engine is accessible
    await session.run('RETURN 1 AS result');
    console.log('Successfully connected to Neo4j database (Test query passed).');
  } catch (error) {
    console.error('Failed to connect to Neo4j database:', error);
    process.exit(1); // gracefully catch init errors before launching express app
  } finally {
    await session.close();
  }
}

// Core Cypher query helper
async function runQuery(query, params = {}) {
  const session = driver.session();
  try {
    const result = await session.run(query, params);
    return result;
  } finally {
    await session.close();
  }
}

// Primary data transaction for Complaint nodes
async function createComplaintNode(data) {
  const query = `
    CREATE (n:Complaint {
      id: $id,
      issueType: $issueType,
      lat: toFloat($lat),
      lng: toFloat($lng),
      imageUrl: $imageUrl,
      urgency: $urgency,
      status: $status,
      createdAt: datetime()
    })
    WITH n
    MATCH (other) WHERE (other:Complaint OR other:SensorAnomaly) AND other.id <> n.id
    AND point.distance(point({latitude: n.lat, longitude: n.lng}), point({latitude: other.lat, longitude: other.lng})) < 300
    MERGE (n)-[:CLUSTER_WITH]->(other)
    RETURN n
  `;
  const params = {
    id: data.id,
    issueType: data.issueType || null,
    lat: data.lat || 0,
    lng: data.lng || 0,
    imageUrl: data.imageUrl || null,
    urgency: data.urgency || 'MEDIUM',
    status: data.status || 'PENDING'
  };
  return runQuery(query, params);
}

// Record an active fault anomaly from hardware sensors
async function recordSensorFault(deviceId, type, location) {
  const query = `
    CREATE (n:SensorAnomaly {
      id: randomUUID(),
      device_id: $deviceId,
      type: $type,
      status: 'FAULT',
      lat: toFloat($lat),
      lng: toFloat($lng),
      createdAt: datetime()
    })
    WITH n
    MATCH (other) WHERE (other:Complaint OR other:SensorAnomaly) AND other.id <> n.id
    AND point.distance(point({latitude: n.lat, longitude: n.lng}), point({latitude: other.lat, longitude: other.lng})) < 300
    MERGE (n)-[:CLUSTER_WITH]->(other)
    RETURN n
  `;
  const params = {
    deviceId,
    type,
    lat: location.lat || 0,
    lng: location.lng || 0
  };
  return runQuery(query, params);
}

// Gracefully resolve an active fault flag
async function resolveSensorFault(deviceId) {
  const query = `
    MATCH (a:SensorAnomaly {device_id: $deviceId, status: 'FAULT'})
    SET a.status = 'RESOLVED', a.resolvedAt = datetime()
    RETURN a
  `;
  return runQuery(query, { deviceId });
}

module.exports = {
  driver,
  verifyConnection,
  runQuery,
  createComplaintNode,
  recordSensorFault,
  resolveSensorFault
};
