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
      issueType TEXT,
      lat REAL,
      lng REAL,
      imageUrl TEXT,
      urgency TEXT,
      status TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
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

function saveComplaint(id, issueType, lat, lng, imageUrl, urgency, status) {
  const stmt = db.prepare('INSERT INTO complaints (id, issueType, lat, lng, imageUrl, urgency, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
  stmt.run(id, issueType, lat, lng, imageUrl, urgency, status);
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

module.exports = {
  db,
  initSQLite,
  saveRtiDraft,
  logAdminAction,
  saveComplaint,
  updateComplaint,
  getRtiDrafts
};
