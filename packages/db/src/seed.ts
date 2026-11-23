import { createHmac, pbkdf2Sync } from 'node:crypto';
import type { AppDatabase } from './client.js';
import { getDatabase, closeDatabase } from './client.js';
import { departments } from './schema/departments.js';
import { wards } from './schema/wards.js';
import { users, accounts } from './schema/users.js';
import { iotDevices, iotTelemetry } from './schema/iot.js';
import { complaintClusters } from './schema/clusters.js';
import { complaints, complaintEvents } from './schema/complaints.js';

export function hashPassword(password: string, salt = 'jansetu-static-seed-salt'): string {
  return pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

export function hashHmacSecret(secret: string, key = 'jansetu-iot-master-key'): string {
  return createHmac('sha256', key).update(secret).digest('hex');
}

export interface SeedResult {
  readonly departmentsCount: number;
  readonly wardsCount: number;
  readonly usersCount: number;
  readonly iotDevicesCount: number;
  readonly clustersCount: number;
  readonly complaintsCount: number;
}

export async function seedDatabase(db: AppDatabase): Promise<SeedResult> {
  console.log('[Seed] Starting idempotent database seed...');

  // 1. Core Municipal Departments (English + Hindi names, codes, SLAs)
  const departmentRecords = [
    {
      id: 'dept-streetlights',
      name: 'Municipal Corporation - Electrical Division',
      nameHi: 'विद्युत एवं स्ट्रीटलाइट विभाग',
      code: 'ELEC',
      contactEmail: 'electrical@jansetu.gov.in',
      contactPhone: '+91-11-23340001',
      defaultSlaHours: 24,
    },
    {
      id: 'dept-roads',
      name: 'Public Works Department (PWD)',
      nameHi: 'लोक निर्माण विभाग (पीडब्ल्यूडी)',
      code: 'PWD',
      contactEmail: 'pwd@jansetu.gov.in',
      contactPhone: '+91-11-23340002',
      defaultSlaHours: 24,
    },
    {
      id: 'dept-sanitation',
      name: 'Municipal Corporation - Sanitation Department',
      nameHi: 'स्वच्छता एवं ठोस अपशिष्ट प्रबंधन विभाग',
      code: 'SAN',
      contactEmail: 'sanitation@jansetu.gov.in',
      contactPhone: '+91-11-23340003',
      defaultSlaHours: 48,
    },
    {
      id: 'dept-water',
      name: 'Delhi Jal Board / Water Supply Department',
      nameHi: 'दिल्ली जल बोर्ड / जल आपूर्ति विभाग',
      code: 'DJB',
      contactEmail: 'water@jansetu.gov.in',
      contactPhone: '+91-11-23340004',
      defaultSlaHours: 18,
    },
    {
      id: 'dept-sewerage',
      name: 'Municipal Corporation - Sewerage Division',
      nameHi: 'जल निकासी एवं सीवरेज विभाग',
      code: 'SEW',
      contactEmail: 'sewerage@jansetu.gov.in',
      contactPhone: '+91-11-23340005',
      defaultSlaHours: 18,
    },
    {
      id: 'dept-discom',
      name: 'Electricity Distribution Company (DISCOM)',
      nameHi: 'विद्युत वितरण कंपनी (डिस्कॉम)',
      code: 'DISCOM',
      contactEmail: 'discom@jansetu.gov.in',
      contactPhone: '+91-11-23340006',
      defaultSlaHours: 6,
    },
  ];

  for (const dept of departmentRecords) {
    await db
      .insert(departments)
      .values(dept)
      .onConflictDoUpdate({
        target: departments.id,
        set: {
          name: dept.name,
          nameHi: dept.nameHi,
          code: dept.code,
          contactEmail: dept.contactEmail,
          contactPhone: dept.contactPhone,
          defaultSlaHours: dept.defaultSlaHours,
        },
      });
  }
  console.log(`[Seed] Seeded ${departmentRecords.length} departments.`);

  // 2. Sample Municipal Wards with realistic PostGIS MultiPolygon boundaries
  const wardRecords = [
    {
      id: 'ward-04',
      name: 'Mayur Vihar',
      number: '04',
      zone: 'East Delhi',
      city: 'Delhi NCR',
      boundary:
        'SRID=4326;MULTIPOLYGON(((77.2900 28.5900, 77.3100 28.5900, 77.3100 28.6100, 77.2900 28.6100, 77.2900 28.5900)))',
    },
    {
      id: 'ward-12',
      name: 'Indirapuram',
      number: '12',
      zone: 'Ghaziabad Zone 2',
      city: 'Delhi NCR',
      boundary:
        'SRID=4326;MULTIPOLYGON(((77.3600 28.6300, 77.3900 28.6300, 77.3900 28.6600, 77.3600 28.6600, 77.3600 28.6300)))',
    },
    {
      id: 'ward-21',
      name: 'Connaught Place',
      number: '21',
      zone: 'New Delhi Central',
      city: 'Delhi NCR',
      boundary:
        'SRID=4326;MULTIPOLYGON(((77.2000 28.6200, 77.2300 28.6200, 77.2300 28.6400, 77.2000 28.6400, 77.2000 28.6200)))',
    },
    {
      id: 'ward-08',
      name: 'Civil Lines',
      number: '08',
      zone: 'North Delhi',
      city: 'Delhi NCR',
      boundary:
        'SRID=4326;MULTIPOLYGON(((77.2100 28.6700, 77.2400 28.6700, 77.2400 28.6900, 77.2100 28.6900, 77.2100 28.6700)))',
    },
  ];

  for (const ward of wardRecords) {
    await db
      .insert(wards)
      .values(ward)
      .onConflictDoUpdate({
        target: wards.id,
        set: {
          name: ward.name,
          number: ward.number,
          zone: ward.zone,
          city: ward.city,
          boundary: ward.boundary,
        },
      });
  }
  console.log(`[Seed] Seeded ${wardRecords.length} wards.`);

  // 3. Demo Accounts: 1 admin, 1 dept_head, 2 ward_officers, 2 citizens
  const defaultPasswordHash = hashPassword('JanSetu@2026!');

  const userRecords = [
    {
      id: 'user-admin-01',
      name: 'Chief Administrative Officer',
      email: 'admin@jansetu.gov.in',
      emailVerified: true,
      role: 'admin' as const,
      phone: '+91-11-23349999',
    },
    {
      id: 'user-head-elec',
      name: 'Er. Amit Verma',
      email: 'head.electrical@jansetu.gov.in',
      emailVerified: true,
      role: 'dept_head' as const,
      departmentId: 'dept-streetlights',
      phone: '+91-9811122233',
    },
    {
      id: 'user-officer-ward04',
      name: 'Sunita Sharma',
      email: 'officer.ward04@jansetu.gov.in',
      emailVerified: true,
      role: 'ward_officer' as const,
      departmentId: 'dept-sanitation',
      wardId: 'ward-04',
      phone: '+91-9822233344',
    },
    {
      id: 'user-officer-ward12',
      name: 'Vikram Singh',
      email: 'officer.ward12@jansetu.gov.in',
      emailVerified: true,
      role: 'ward_officer' as const,
      departmentId: 'dept-streetlights',
      wardId: 'ward-12',
      phone: '+91-9833344455',
    },
    {
      id: 'user-citizen-01',
      name: 'Pooja Sharma',
      email: 'pooja.sharma@example.com',
      emailVerified: true,
      role: 'citizen' as const,
      wardId: 'ward-12',
      phone: '9876543210',
    },
    {
      id: 'user-citizen-02',
      name: 'Rahul Mehra',
      email: 'rahul.mehra@example.com',
      emailVerified: true,
      role: 'citizen' as const,
      wardId: 'ward-04',
      phone: '9876543211',
    },
  ];

  for (const user of userRecords) {
    await db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name: user.name,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId ?? null,
          wardId: user.wardId ?? null,
          phone: user.phone ?? null,
        },
      });

    // Seed credential account for authentication
    await db
      .insert(accounts)
      .values({
        id: `acc-${user.id}`,
        userId: user.id,
        accountId: user.email,
        providerId: 'credentials',
        password: defaultPasswordHash,
      })
      .onConflictDoUpdate({
        target: accounts.id,
        set: {
          password: defaultPasswordHash,
        },
      });
  }
  console.log(`[Seed] Seeded ${userRecords.length} users with credentials.`);

  // 4. Sample IoT Streetlight Device Records (with hashed HMAC secrets)
  const iotDeviceRecords = [
    {
      id: 'iot-dev-01',
      deviceUid: 'UNO_Q_01',
      deviceType: 'STREETLIGHT',
      wardId: 'ward-12',
      departmentId: 'dept-streetlights',
      location: 'SRID=4326;POINT(77.3712 28.6412)',
      status: 'FAULT',
      batteryLevel: 92,
      lastHeartbeatAt: new Date(),
    },
    {
      id: 'iot-dev-02',
      deviceUid: 'UNO_Q_02',
      deviceType: 'STREETLIGHT',
      wardId: 'ward-04',
      departmentId: 'dept-streetlights',
      location: 'SRID=4326;POINT(77.3015 28.6015)',
      status: 'NORMAL',
      batteryLevel: 98,
      lastHeartbeatAt: new Date(),
    },
  ];

  for (const device of iotDeviceRecords) {
    await db
      .insert(iotDevices)
      .values(device)
      .onConflictDoUpdate({
        target: iotDevices.id,
        set: {
          status: device.status,
          batteryLevel: device.batteryLevel,
          lastHeartbeatAt: device.lastHeartbeatAt,
        },
      });

    // Sample telemetry log with HMAC audit
    const secretHmac = hashHmacSecret(`device-secret-${device.deviceUid}`);
    await db
      .insert(iotTelemetry)
      .values({
        id: `telem-${device.id}-${Date.now()}`,
        deviceId: device.id,
        eventType: device.status === 'FAULT' ? 'LDR_FAULT_DETECTED' : 'HEARTBEAT',
        status: device.status,
        payload: {
          battery: device.batteryLevel,
          voltage: 4.95,
          rawLdr: device.status === 'FAULT' ? 45 : 820,
          hmacVerification: secretHmac,
        },
      })
      .onConflictDoNothing();
  }
  console.log(`[Seed] Seeded ${iotDeviceRecords.length} IoT devices and telemetry.`);

  // 5. Sample Complaint Cluster & Active Complaints
  const clusterRecord = {
    id: 'cluster-indirapuram-elec',
    title: 'Streetlight Outage Cluster - Kala Patthar Road',
    departmentId: 'dept-streetlights',
    wardId: 'ward-12',
    status: 'IN_PROGRESS',
    centroid: 'SRID=4326;POINT(77.3712 28.6412)',
    complaintCount: 2,
    lastActivityAt: new Date(),
  };

  await db
    .insert(complaintClusters)
    .values(clusterRecord)
    .onConflictDoUpdate({
      target: complaintClusters.id,
      set: {
        status: clusterRecord.status,
        complaintCount: clusterRecord.complaintCount,
        lastActivityAt: clusterRecord.lastActivityAt,
      },
    });

  const now = Date.now();
  const slaDue24h = new Date(now + 24 * 60 * 60 * 1000);

  const sampleComplaints = [
    {
      id: 'cmp-seed-01',
      trackingCode: 'JS-20261123-0101',
      idempotencyKey: 'idemp-seed-street-01',
      citizenId: 'user-citizen-01',
      citizenName: 'Pooja Sharma',
      citizenPhone: '9876543210',
      departmentId: 'dept-streetlights',
      wardId: 'ward-12',
      clusterId: 'cluster-indirapuram-elec',
      category: 'Street Light',
      urgency: 'HIGH',
      status: 'IN_PROGRESS',
      title: 'Dark stretch on Kala Patthar Road due to 3 broken lights',
      description:
        'Street lights have been completely dead for 4 nights causing serious vehicle safety hazard and pedestrian insecurity.',
      rawText: 'Hamare area mein street light kharab hai aur raat ko unsafe lagta hai',
      language: 'hi',
      exactLocation: 'SRID=4326;POINT(77.371234 28.641256)',
      publicLocation: 'SRID=4326;POINT(77.3710 28.6415)',
      assignedOfficerId: 'user-officer-ward12',
      slaDueAt: slaDue24h,
    },
    {
      id: 'cmp-seed-02',
      trackingCode: 'JS-20261123-0102',
      idempotencyKey: 'idemp-seed-iot-02',
      citizenId: 'user-citizen-02',
      citizenName: 'IoT Auto-Reporter',
      citizenPhone: '+91-11-23340001',
      departmentId: 'dept-streetlights',
      wardId: 'ward-12',
      clusterId: 'cluster-indirapuram-elec',
      category: 'Street Light',
      urgency: 'HIGH',
      status: 'PENDING',
      title: 'Automated Telemetry Fault Alert on Device UNO_Q_01',
      description:
        'Streetlight node UNO_Q_01 registered confirmed optical failure during active duty cycle.',
      rawText: 'LDR optical fault confirmed by Arduino UNO Q Bridge.',
      language: 'en',
      exactLocation: 'SRID=4326;POINT(77.371200 28.641200)',
      publicLocation: 'SRID=4326;POINT(77.3710 28.6410)',
      slaDueAt: slaDue24h,
    },
  ];

  for (const cmp of sampleComplaints) {
    await db
      .insert(complaints)
      .values(cmp)
      .onConflictDoUpdate({
        target: complaints.id,
        set: {
          status: cmp.status,
          assignedOfficerId: cmp.assignedOfficerId ?? null,
          slaDueAt: cmp.slaDueAt,
        },
      });

    // Seed initial event
    await db
      .insert(complaintEvents)
      .values({
        id: `evt-${cmp.id}-init`,
        complaintId: cmp.id,
        actorId: cmp.citizenId,
        actorRole: 'citizen',
        eventType: 'SUBMITTED',
        toStatus: cmp.status,
        notes: 'Complaint submitted through JanSetu Multiverse portal',
      })
      .onConflictDoNothing();
  }
  console.log(`[Seed] Seeded ${sampleComplaints.length} complaints and clusters.`);

  return {
    departmentsCount: departmentRecords.length,
    wardsCount: wardRecords.length,
    usersCount: userRecords.length,
    iotDevicesCount: iotDeviceRecords.length,
    clustersCount: 1,
    complaintsCount: sampleComplaints.length,
  };
}

// Direct CLI invocation handler
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  (async () => {
    try {
      const db = getDatabase();
      const result = await seedDatabase(db);
      console.log('[Seed] Seeding completed successfully:', result);
      await closeDatabase();
      process.exit(0);
    } catch (err) {
      console.error('[Seed] Database seed execution failed:', err);
      process.exit(1);
    }
  })();
}
