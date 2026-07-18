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

module.exports = {
  db,
  initSQLite,
  saveRtiDraft,
  logAdminAction
};
