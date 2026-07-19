const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let db;

function initFirebase() {
  try {
    const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
    if (!fs.existsSync(serviceAccountPath)) {
      console.warn('⚠️ Firebase credentials not found at', serviceAccountPath);
      console.warn('Please add your firebase-service-account.json file. For now, running in mock mode (in-memory only for safety).');
      return false; // Mock mode indicator
    }

    const serviceAccount = require(serviceAccountPath);
    
    // Only initialize if apps length is 0
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    db = admin.firestore();
    console.log('✅ Firebase Firestore successfully initialized');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error);
    return false;
  }
}

// Ensure unique IDs
function generateId(prefix = '') {
  return `${prefix}${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

// --- Complaints ---
async function createComplaint(data) {
  if (!db) return data;
  const id = data.id || generateId('cmp_');
  const complaint = { ...data, id, createdAt: data.createdAt || new Date().toISOString() };
  await db.collection('complaints').doc(id).set(complaint);
  return complaint;
}

async function getAllComplaints() {
  if (!db) return [];
  const snapshot = await db.collection('complaints').orderBy('createdAt', 'desc').get();
  return snapshot.docs.map(doc => doc.data());
}

async function getComplaintByNumber(number) {
  if (!db) return null;
  const snapshot = await db.collection('complaints').where('complaint_number', '==', number).limit(1).get();
  if (snapshot.empty) return null;
  const data = snapshot.docs[0].data();
  // Fetch similar complaints (for this basic implementation, just by issueType or ward)
  const similarSnapshot = await db.collection('complaints')
    .where('issueType', '==', data.issueType)
    .where('ward', '==', data.ward)
    .limit(5).get();
    
  data.similar_complaints = similarSnapshot.docs.filter(d => d.id !== data.id).map(d => d.data());
  data.similar_count = data.similar_complaints.length + 1;

  // Check assignments for officer details
  if (data.status === 'ASSIGNED' || data.status === 'IN_PROGRESS' || data.status === 'ESCALATED') {
    // get the latest assignment for this complaint
    // Wait, assignment collection uses 'complaintId'
    // To get the latest, we could orderBy a timestamp if it had one, or just get all and pick the one with type ESCALATION if escalated
    const asgnSnap = await db.collection('assignments').where('complaintId', '==', data.id).get();
    if (!asgnSnap.empty) {
      let assignment = null;
      if (data.status === 'ESCALATED') {
        assignment = asgnSnap.docs.find(d => d.data().type === 'ESCALATION')?.data();
      }
      if (!assignment) {
        // fallback to the most recent one (we can sort by doc ID since it includes Date.now())
        const sorted = asgnSnap.docs.map(d => ({ docId: d.id, ...d.data() })).sort((a, b) => b.docId.localeCompare(a.docId));
        assignment = sorted[0];
      }
      
      if (assignment && assignment.officerId) {
        const offSnap = await db.collection('officers').doc(assignment.officerId).get();
        if (offSnap.exists) {
          const offData = offSnap.data();
          data.officer_name = offData.name;
          data.officer_phone = offData.phone;
        }
      }
    }
  }

  return data;
}

async function getUserComplaints(phone) {
  if (!db) return [];
  const snapshot = await db.collection('complaints').where('citizen_phone', '==', phone).get();
  return snapshot.docs
    .map(doc => doc.data())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function updateComplaintStatus(id, status) {
  if (!db) return;
  await db.collection('complaints').doc(id).update({ status });
}

async function updateComplaint(id, updates) {
  if (!db) return;
  await db.collection('complaints').doc(id).update(updates);
}

// --- Sensor Faults (IoT) ---
async function recordSensorFault(alert) {
  if (!db) return alert;
  await db.collection('sensor_alerts').doc(alert.id).set(alert);
  return alert;
}

async function getSensorAlerts() {
  if (!db) return [];
  const snapshot = await db.collection('sensor_alerts').where('status', '==', 'FAULT').get();
  return snapshot.docs
    .map(doc => doc.data())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function resolveSensorFault(deviceId) {
  if (!db) return;
  const snapshot = await db.collection('sensor_alerts').where('device_id', '==', deviceId).where('status', '==', 'FAULT').get();
  
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, { status: 'RESOLVED' });
  });
  await batch.commit();
}

// --- Dashboard Stats ---
async function getDashboardStats() {
  if (!db) return { total: 0, pending: 0, resolved: 0, escalated: 0, inProgress: 0, activeList: [] };
  
  const complaints = await getAllComplaints();
  
  const activeList = complaints.map(c => ({
    id: c.id,
    complaint_number: c.complaint_number || c.id.substring(0, 15),
    citizen_name: c.citizen_name || c.citizenName || 'Anonymous',
    citizen_phone: c.citizen_phone || c.citizenPhone || '',
    issue_type: c.issue_type || c.issueType || 'General Complaint',
    department: c.department || 'General Administration',
    area: c.area || 'Unknown Area',
    ward: c.ward || 'Unknown Ward',
    raw_text: c.raw_text || c.rawText || '',
    status: c.status || 'PENDING',
    urgency: c.urgency || 'MEDIUM',
    lat: c.lat || 0,
    lng: c.lng || 0,
    similar_count: c.similar_count || 1,
    created_at: c.created_at || c.createdAt || new Date().toISOString()
  }));

  const stats = {
    total: complaints.length,
    pending: complaints.filter(c => c.status === 'PENDING').length,
    resolved: complaints.filter(c => c.status === 'RESOLVED').length,
    escalated: complaints.filter(c => c.status === 'ESCALATED').length,
    inProgress: complaints.filter(c => c.status === 'IN_PROGRESS' || c.status === 'ASSIGNED').length
  };

  return { activeList, stats };
}

async function getGraphStats() {
  if (!db) return { total: 0, clustered: 0, escalated: 0, hotspots: [] };
  const complaints = await getAllComplaints();
  
  const clustered = complaints.filter(c => c.similar_count > 1).length;
  const escalated = complaints.filter(c => c.status === 'ESCALATED').length;
  
  // Calculate hotspots based on ward occurrences
  const wardCounts = complaints.reduce((acc, c) => {
    if (c.ward) acc[c.ward] = (acc[c.ward] || 0) + 1;
    return acc;
  }, {});
  
  const hotspots = Object.entries(wardCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ward, count]) => ({ ward, count, description: `High volume of complaints in ${ward}` }));

  return { total: complaints.length, clustered, escalated, hotspots };
}

async function runEscalationCheck() {
  if (!db) return { escalated_count: 0 };
  // Check: escalate pending or assigned complaints older than 48 hours
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  
  // To avoid requiring a composite index in Firestore (status + createdAt), 
  // we will query by status only, and filter by createdAt in memory.
  const pendingSnap = await db.collection('complaints').where('status', '==', 'PENDING').get();
  const assignedSnap = await db.collection('complaints').where('status', '==', 'ASSIGNED').get();
    
  const allDocs = [...pendingSnap.docs, ...assignedSnap.docs];
  // Filter locally by createdAt
  const docsToEscalate = allDocs.filter(doc => {
    const data = doc.data();
    return data.createdAt && data.createdAt <= fortyEightHoursAgo;
  });
  
  let escalatedCount = 0;
  
  if (docsToEscalate.length > 0) {
    const batch = db.batch();
    
    // For each complaint, find the senior officer of its department
    const senOffSnap = await db.collection('officers').where('rank', '==', 'Senior Level').get();
    const seniorOfficers = senOffSnap.docs.map(d => d.data());

    docsToEscalate.forEach(doc => {
      const data = doc.data();
      const dept = data.department || 'General Administration';
      const seniorOff = seniorOfficers.find(o => o.department === dept) || seniorOfficers[0]; 
      
      batch.update(doc.ref, { status: 'ESCALATED' });
      
      if (seniorOff) {
        // Also create assignment doc
        const asgnRef = db.collection('assignments').doc(`esc_${Date.now()}_${doc.id}`);
        batch.set(asgnRef, { complaintId: doc.id, officerId: seniorOff.id, type: 'ESCALATION' });
      }
      
      escalatedCount++;
    });
    
    await batch.commit();
  }
  
  return { escalated_count: escalatedCount };
}

// --- Officers ---
async function seedOfficers() {
  if (!db) return 0;
  
  const snapshot = await db.collection('officers').limit(1).get();
  if (!snapshot.empty) return 0;

  const departments = ['Municipal Corporation', 'Electrical', 'Water', 'Fire', 'General Administration', 'Public Works', 'Health'];
  let count = 0;
  
  const batch = db.batch();
  departments.forEach((dept, idx) => {
    const junId = `off_${idx}_jun`;
    const senId = `off_${idx}_sen`;
    
    batch.set(db.collection('officers').doc(junId), {
      id: junId, name: `Junior Officer (${dept})`, rank: 'Junior Level', department: dept, badge_number: `BADGE-J-${1000+idx}`, phone: `555-010${idx}`, ward: 'All Wards'
    });
    batch.set(db.collection('officers').doc(senId), {
      id: senId, name: `Senior Officer (${dept})`, rank: 'Senior Level', department: dept, badge_number: `BADGE-S-${2000+idx}`, phone: `555-020${idx}`, ward: 'All Wards'
    });
    count += 2;
  });
  
  await batch.commit();
  return count;
}

async function getAllOfficers() {
  if (!db) return [];
  const snapshot = await db.collection('officers').get();
  return snapshot.docs.map(doc => doc.data());
}

async function getOfficersByDepartment(department) {
  if (!db) return [];
  const snapshot = await db.collection('officers').where('department', '==', department).get();
  return snapshot.docs.map(doc => doc.data());
}

async function getDepartmentStats() {
  if (!db) return [];
  const departments = ['Municipal Corporation', 'Electrical', 'Water', 'Fire', 'General Administration', 'Public Works', 'Health'];
  const snapshot = await db.collection('complaints').get();
  const complaints = snapshot.docs.map(d => d.data());
  
  return departments.map((dept, i) => {
    const deptComplaints = complaints.filter(c => c.department === dept);
    return {
      id: (i + 1).toString(),
      name: dept,
      total_complaints: deptComplaints.length,
      resolved_complaints: deptComplaints.filter(c => c.status === 'RESOLVED').length,
      pending_count: deptComplaints.filter(c => c.status === 'PENDING').length,
      escalated_count: deptComplaints.filter(c => c.status === 'ESCALATED').length,
      avg_resolution_days: Math.floor(Math.random() * 5) + 1, // Mock
      trust_score: Math.floor(Math.random() * 30) + 70 // Mock
    };
  });
}

async function assignOfficer(complaintId, officerId) {
  if (!db) return;
  await db.collection('assignments').doc(`asgn_${Date.now()}`).set({ complaintId, officerId, type: 'PRIMARY' });
  await updateComplaintStatus(complaintId, 'ASSIGNED');
}

async function escalateComplaintOfficer(complaintId, escalationOfficerId) {
  if (!db) return;
  await db.collection('assignments').doc(`esc_${Date.now()}`).set({ complaintId, officerId: escalationOfficerId, type: 'ESCALATION' });
  await updateComplaintStatus(complaintId, 'ESCALATED');
}

async function clearDatabase() {
  if (!db) return;
  const collections = ['complaints', 'sensor_alerts', 'officers', 'assignments'];
  for (const collection of collections) {
    const snapshot = await db.collection(collection).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
}

// --- Drafts ---
async function saveGrievanceDraft(id, applicantName, applicantPhone, rawInput, natureOfGrievance, targetDepartment, englishDraft, hindiDraft, analysisJson) {
  if (!db) return;
  await db.collection('grievance_drafts').doc(id).set({
    id, applicantName, applicantPhone, rawInput, natureOfGrievance, targetDepartment, englishDraft, hindiDraft, analysisJson, createdAt: new Date().toISOString()
  });
}

async function getGrievanceDrafts(limit = 50) {
  if (!db) return [];
  const snapshot = await db.collection('grievance_drafts').orderBy('createdAt', 'desc').limit(limit).get();
  return snapshot.docs.map(doc => doc.data());
}

async function saveRtiDraft(id, applicantName, applicantPhone, rawInput, targetDepartment, informationSought, englishDraft, hindiDraft, analysisJson) {
  if (!db) return;
  await db.collection('rti_drafts').doc(id).set({
    id, applicantName, applicantPhone, rawInput, targetDepartment, informationSought, englishDraft, hindiDraft, analysisJson, createdAt: new Date().toISOString()
  });
}

async function getRtiDrafts(limit = 50) {
  if (!db) return [];
  const snapshot = await db.collection('rti_drafts').orderBy('createdAt', 'desc').limit(limit).get();
  return snapshot.docs.map(doc => doc.data());
}

module.exports = {
  initFirebase,
  createComplaint,
  getAllComplaints,
  getComplaintByNumber,
  getUserComplaints,
  updateComplaintStatus,
  updateComplaint,
  recordSensorFault,
  resolveSensorFault,
  getSensorAlerts,
  getDashboardStats,
  getGraphStats,
  runEscalationCheck,
  seedOfficers,
  getAllOfficers,
  getOfficersByDepartment,
  getDepartmentStats,
  assignOfficer,
  escalateComplaintOfficer,
  clearDatabase,
  saveGrievanceDraft,
  getGrievanceDrafts,
  saveRtiDraft,
  getRtiDrafts
};
