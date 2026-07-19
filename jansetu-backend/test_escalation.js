const { initFirebase, db } = require('./db/firebase');

async function run() {
  const isInitialized = initFirebase();
  if (!isInitialized) {
    console.log("Firebase not initialized");
    process.exit(1);
  }
  const admin = require('firebase-admin');
  const firestore = admin.firestore();

  const complaintId = `mock_backdated_${Date.now()}`;
  const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString();

  await firestore.collection('complaints').doc(complaintId).set({
    id: complaintId,
    complaint_number: `JS-TEST-ESC`,
    citizen_name: 'Escalation Test Citizen',
    citizen_phone: '9998887776',
    department: 'Water',
    area: 'Test Area',
    ward: 'Test Ward',
    issueType: 'Water Leak',
    status: 'PENDING',
    urgency: 'MEDIUM',
    createdAt: fiftyHoursAgo
  });

  console.log(`Created backdated complaint: ${complaintId}`);
  process.exit(0);
}

run();
