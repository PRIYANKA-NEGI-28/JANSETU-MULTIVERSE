const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure db directory exists
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbFile = path.join(dbDir, 'store.sqlite');
const db = new Database(dbFile);

function initSQLite() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rti_drafts (
      id TEXT PRIMARY KEY,
      applicant_details TEXT,
      authority_type TEXT,
      generated_draft TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_logs (
      id TEXT PRIMARY KEY,
      action TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      complaint_number TEXT,
      citizen_name TEXT,
      citizen_phone TEXT,
      issueType TEXT,
      department TEXT,
      area TEXT,
      ward TEXT,
      raw_text TEXT,
      summary TEXT,
      language TEXT,
      lat REAL,
      lng REAL,
      imageUrl TEXT,
      urgency TEXT,
      status TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sensor_alerts (
      id TEXT PRIMARY KEY,
      device_id TEXT,
      type TEXT,
      status TEXT,
      lat REAL,
      lng REAL,
      ward TEXT,
      department TEXT,
      description TEXT,
      severity TEXT,
      area TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS officers (
      id TEXT PRIMARY KEY,
      name TEXT,
      rank TEXT,
      department TEXT,
      badge_number TEXT,
      phone TEXT,
      ward TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      complaint_id TEXT,
      officer_id TEXT,
      type TEXT,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Successfully initialized SQLite Database.');
}

function saveRtiDraft(id, applicantDetails, authorityType, generatedDraft) {
  const stmt = db.prepare('INSERT INTO rti_drafts (id, applicant_details, authority_type, generated_draft) VALUES (?, ?, ?, ?)');
  stmt.run(id, applicantDetails, authorityType, generatedDraft);
}

function logAdminAction(id, action) {
  const stmt = db.prepare('INSERT INTO admin_logs (id, action) VALUES (?, ?)');
  stmt.run(id, action);
}

function saveComplaint(id, complaint_number, citizen_name, citizen_phone, issueType, department, area, ward, raw_text, summary, language, lat, lng, imageUrl, urgency, status, createdAt) {
  const stmt = db.prepare('INSERT INTO complaints (id, complaint_number, citizen_name, citizen_phone, issueType, department, area, ward, raw_text, summary, language, lat, lng, imageUrl, urgency, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.run(id, complaint_number, citizen_name, citizen_phone, issueType, department, area, ward, raw_text, summary, language, lat, lng, imageUrl, urgency, status, createdAt);
}

function updateComplaint(id, updates) {
  const keys = Object.keys(updates);
  if (keys.length === 0) return;

  const setClause = keys.map(key => `${key} = ?`).join(', ');
  const values = [...Object.keys(updates).map(key => updates[key]), id];

  const stmt = db.prepare(`UPDATE complaints SET ${setClause} WHERE id = ?`);
  stmt.run(...values);
}

function getRtiDrafts(limit = 50) {
  const stmt = db.prepare(`SELECT id, applicant_details, authority_type, generated_draft, timestamp FROM rti_drafts ORDER BY timestamp DESC LIMIT ?`);
  return stmt.all(limit);
}

function getAllComplaints() {
  const stmt = db.prepare(`SELECT * FROM complaints ORDER BY createdAt DESC`);
  return stmt.all();
}

function getComplaintsByPhone(phone) {
  const stmt = db.prepare(`SELECT * FROM complaints WHERE citizen_phone = ? ORDER BY createdAt DESC`);
  return stmt.all(phone);
}

function getComplaintByNumber(number) {
  const stmt = db.prepare(`SELECT * FROM complaints WHERE complaint_number = ?`);
  return stmt.get(number);
}

function saveSensorAlert(alert) {
  const stmt = db.prepare(`
    INSERT INTO sensor_alerts (
      id, device_id, type, status, lat, lng, ward, department, description, severity, area, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    alert.id, alert.device_id, alert.type, alert.status, alert.lat, alert.lng,
    alert.ward, alert.department, alert.description, alert.severity, alert.area, alert.createdAt
  );
  return alert;
}

function getSensorAlerts() {
  return db.prepare(`SELECT * FROM sensor_alerts ORDER BY createdAt DESC`).all();
}

// --- Officer Management ---

function seedOfficers() {
  const departments = [
    'Municipal Corporation',
    'Electrical',
    'Water',
    'Fire',
    'General Administration',
    'Public Works',
    'Health'
  ];

  let seededCount = 0;
  
  // Check if already seeded
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM officers').get().count;
  if (existingCount > 0) return 0;

  const stmt = db.prepare('INSERT INTO officers (id, name, rank, department, badge_number, phone, ward) VALUES (?, ?, ?, ?, ?, ?, ?)');

  departments.forEach((dept, index) => {
    // Junior Officer
    stmt.run(
      `off_${index}_jun`,
      `Junior Officer (${dept})`,
      'Junior Level',
      dept,
      `BADGE-J-${1000 + index}`,
      `555-01${index.toString().padStart(2, '0')}`,
      'All Wards'
    );
    // Senior Officer
    stmt.run(
      `off_${index}_sen`,
      `Senior Officer (${dept})`,
      'Senior Level',
      dept,
      `BADGE-S-${2000 + index}`,
      `555-02${index.toString().padStart(2, '0')}`,
      'All Wards'
    );
    seededCount += 2;
  });

  return seededCount;
}

function getAllOfficers() {
  return db.prepare('SELECT * FROM officers').all();
}

function getOfficersByDepartment(department) {
  return db.prepare('SELECT * FROM officers WHERE department = ?').all(department);
}

function assignOfficer(complaintId, officerId) {
  const stmt = db.prepare('INSERT INTO assignments (id, complaint_id, officer_id, type) VALUES (?, ?, ?, ?)');
  const id = `asgn_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  stmt.run(id, complaintId, officerId, 'PRIMARY');
  updateComplaint(complaintId, { status: 'ASSIGNED' });
}

function escalateComplaint(complaintId, escalationOfficerId) {
  const stmt = db.prepare('INSERT INTO assignments (id, complaint_id, officer_id, type) VALUES (?, ?, ?, ?)');
  const id = `esc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  stmt.run(id, complaintId, escalationOfficerId, 'ESCALATION');
  updateComplaint(complaintId, { status: 'ESCALATED' });
}

function updateComplaintStatus(id, status) {
  updateComplaint(id, { status });
}

module.exports = {
  db,
  initSQLite,
  saveRtiDraft,
  logAdminAction,
  saveComplaint,
  updateComplaint,
  getRtiDrafts,
  getAllComplaints,
  getComplaintsByPhone,
  getComplaintByNumber,
  saveSensorAlert,
  getSensorAlerts,
  seedOfficers,
  getAllOfficers,
  getOfficersByDepartment,
  assignOfficer,
  escalateComplaint,
  updateComplaintStatus
};
