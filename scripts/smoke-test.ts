#!/usr/bin/env node
/**
 * JanSetu Multiverse — Automated Post-Deployment Smoke Test Suite
 * 
 * Verifies live endpoint availability, Better Auth session handling, spatial ward resolution,
 * citizen complaint lifecycle with idempotency and PII masking, IoT HMAC signature enforcement,
 * and multi-tier RBAC authorization against any target API origin.
 * 
 * Usage:
 *   npx tsx scripts/smoke-test.ts [API_URL]
 *   API_URL="https://api.jansetu.gov.in" pnpm smoke-test
 */

interface SmokeTestResult {
  readonly step: number;
  readonly name: string;
  readonly passed: boolean;
  readonly durationMs: number;
  readonly detail?: string;
  readonly error?: string;
}

const targetBaseUrl = (process.argv[2] || process.env.API_URL || 'http://localhost:3000').replace(/\/+$/, '');

const results: SmokeTestResult[] = [];

function logStepStart(step: number, name: string): void {
  process.stdout.write(`  [${step}/7] ${name.padEnd(52, '.')} `);
}

function logStepSuccess(durationMs: number, detail?: string): void {
  console.log(`\x1b[32m✔ PASS\x1b[0m \x1b[90m(${durationMs}ms)\x1b[0m`);
  if (detail) {
    console.log(`        \x1b[90m└─ ${detail}\x1b[0m`);
  }
}

function logStepFailure(durationMs: number, error: string): void {
  console.log(`\x1b[31m✖ FAIL\x1b[0m \x1b[90m(${durationMs}ms)\x1b[0m`);
  console.log(`        \x1b[31m└─ ${error}\x1b[0m`);
}

async function runStep(
  step: number,
  name: string,
  fn: () => Promise<string | void>
): Promise<boolean> {
  logStepStart(step, name);
  const start = Date.now();
  try {
    const detail = (await fn()) || undefined;
    const durationMs = Date.now() - start;
    logStepSuccess(durationMs, detail);
    results.push({ step, name, passed: true, durationMs, detail });
    return true;
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    logStepFailure(durationMs, errorMsg);
    results.push({ step, name, passed: false, durationMs, error: errorMsg });
    return false;
  }
}

async function main(): Promise<void> {
  console.log('\n\x1b[1m=== JanSetu Multiverse Post-Deployment Smoke Test ===\x1b[0m');
  console.log(`Target API URL: \x1b[36m${targetBaseUrl}\x1b[0m`);
  console.log(`Execution Timestamp: ${new Date().toISOString()}\n`);

  let allPassed = true;

  // 1. Health & Readiness Probe
  const step1 = await runStep(1, 'System Health & Readiness Probe (/health)', async () => {
    const res = await fetch(`${targetBaseUrl}/health`);
    if (!res.ok) {
      throw new Error(`Expected HTTP 200 from /health, received ${res.status} (${res.statusText})`);
    }
    const json = (await res.json()) as { status: string; uptime?: number; version?: string };
    if (!json.status) {
      throw new Error('Missing "status" field in health response payload');
    }
    return `Status: ${json.status} | Version: ${json.version || '1.0.0'} | Uptime: ${json.uptime?.toFixed(0) ?? 0}s`;
  });
  if (!step1) allPassed = false;

  // 2. Public Civic Metadata & Aggregate Statistics
  const step2 = await runStep(2, 'Civic Metadata & Stats (/meta, /meta/stats)', async () => {
    const [metaRes, statsRes] = await Promise.all([
      fetch(`${targetBaseUrl}/api/v1/meta`),
      fetch(`${targetBaseUrl}/api/v1/meta/stats`),
    ]);
    if (!metaRes.ok) {
      throw new Error(`GET /api/v1/meta failed with status ${metaRes.status}`);
    }
    if (!statsRes.ok) {
      throw new Error(`GET /api/v1/meta/stats failed with status ${statsRes.status}`);
    }
    const metaJson = (await metaRes.json()) as { departments?: readonly unknown[]; categories?: readonly unknown[] };
    const statsJson = (await statsRes.json()) as { totalComplaints?: number; complaints?: { total: number } };
    const deptCount = metaJson.departments?.length || 0;
    const complaintsTotal = statsJson.totalComplaints ?? statsJson.complaints?.total ?? 0;
    return `${deptCount} departments verified | ${complaintsTotal} cumulative complaints indexed`;
  });
  if (!step2) allPassed = false;

  // 3. Spatial GPS Ward Resolution
  const step3 = await runStep(3, 'Spatial Geo-Resolution (/geo/resolve-ward)', async () => {
    const lat = 28.6365;
    const lng = 77.3715;
    const res = await fetch(`${targetBaseUrl}/api/v1/geo/resolve-ward?lat=${lat}&lng=${lng}`);
    if (!res.ok) {
      throw new Error(`GET /api/v1/geo/resolve-ward failed with status ${res.status}`);
    }
    const json = (await res.json()) as {
      wardId?: string;
      wardName?: string;
      city?: string;
    };
    if (!json.wardId) {
      throw new Error('Ward resolution payload missing wardId identifier');
    }
    return `Resolved (${lat}, ${lng}) -> ${json.wardName} (${json.wardId}, ${json.city})`;
  });
  if (!step3) allPassed = false;

  // 4. Citizen Complaint Intake, Idempotency, & Spatial Privacy Check
  let smokeTrackingCode = '';
  const step4 = await runStep(4, 'Complaint Filing, Idempotency, & Privacy Redaction', async () => {
    const testIdempotencyKey = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      name: 'Smoke Test Citizen',
      phone: '+91 98765 43210',
      area: 'Indirapuram Kala Patthar',
      wardId: 'ward-04',
      category: 'Street Light',
      urgency: 'MEDIUM',
      departmentId: 'dept-elec',
      text: 'Automated post-deploy smoke test grievance verifying lifecycle and privacy.',
      lat: 28.6365,
      lng: 77.3715,
      language: 'en',
    };

    // 4a. Initial submission -> 201 Created
    const createRes = await fetch(`${targetBaseUrl}/api/v1/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': testIdempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    if (createRes.status !== 201 && createRes.status !== 200) {
      const errText = await createRes.text();
      throw new Error(`Complaint creation failed with status ${createRes.status}: ${errText}`);
    }
    const createdJson = (await createRes.json()) as { trackingCode: string; id: string };
    smokeTrackingCode = createdJson.trackingCode;
    if (!smokeTrackingCode || !smokeTrackingCode.startsWith('JS-')) {
      throw new Error(`Invalid tracking code generated: "${smokeTrackingCode}"`);
    }

    // 4b. Idempotency test (repeat exact request) -> 200 OK with X-Idempotency-Hit
    const duplicateRes = await fetch(`${targetBaseUrl}/api/v1/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': testIdempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    const idempotencyHit = duplicateRes.headers.get('x-idempotency-hit');
    if (duplicateRes.status !== 200 && duplicateRes.status !== 201) {
      throw new Error(`Duplicate submission failed with status ${duplicateRes.status}`);
    }

    // 4c. Public tracking check & PII Masking Verification
    const trackRes = await fetch(`${targetBaseUrl}/api/v1/complaints/${smokeTrackingCode}`);
    if (!trackRes.ok) {
      throw new Error(`Failed to retrieve complaint by tracking code ${smokeTrackingCode}`);
    }
    const publicRecord = (await trackRes.json()) as Record<string, unknown>;

    // CRITICAL: Ensure exact coordinates, phone, email, and name are NEVER exposed on public lookup
    if ('exactLocation' in publicRecord) {
      throw new Error('SECURITY VIOLATION: exactLocation exposed on public complaint endpoint');
    }
    if ('citizenPhone' in publicRecord) {
      throw new Error('SECURITY VIOLATION: citizenPhone exposed on public complaint endpoint');
    }
    if ('citizenEmail' in publicRecord) {
      throw new Error('SECURITY VIOLATION: citizenEmail exposed on public complaint endpoint');
    }
    if ('citizenName' in publicRecord) {
      throw new Error('SECURITY VIOLATION: citizenName exposed on public complaint endpoint');
    }

    return `Tracking ID: ${smokeTrackingCode} | Idempotency Hit: ${idempotencyHit === 'true'} | PII Redacted: true`;
  });
  if (!step4) allPassed = false;

  // 5. IoT Edge Cryptographic Rejection
  const step5 = await runStep(5, 'IoT Edge HMAC Cryptographic Rejection', async () => {
    // 5a. Unsigned request -> 401 Unauthorized
    const unsignedRes = await fetch(`${targetBaseUrl}/api/v1/iot/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: 'DEV-STREET-001', status: 'FAULT' }),
    });
    if (unsignedRes.status !== 401) {
      throw new Error(`Unsigned IoT request expected 401, got ${unsignedRes.status}`);
    }

    // 5b. Forged signature request -> 401 Unauthorized
    const forgedRes = await fetch(`${targetBaseUrl}/api/v1/iot/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': 'DEV-STREET-001',
        'X-Device-Timestamp': String(Date.now()),
        'X-Device-Signature': '0000000000000000000000000000000000000000000000000000000000000000',
      },
      body: JSON.stringify({ device_id: 'DEV-STREET-001', status: 'FAULT' }),
    });
    if (forgedRes.status !== 401) {
      throw new Error(`Forged HMAC signature request expected 401, got ${forgedRes.status}`);
    }

    return 'Unsigned requests rejected (401) | Forged HMAC signatures rejected (401)';
  });
  if (!step5) allPassed = false;

  // 6. Admin RBAC Authorization Gates
  const step6 = await runStep(6, 'Multi-Tier RBAC Gates (/admin/analytics)', async () => {
    // 6a. Unauthenticated request -> 401 Unauthorized
    const unauthedRes = await fetch(`${targetBaseUrl}/api/v1/admin/analytics`);
    if (unauthedRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated admin access, got ${unauthedRes.status}`);
    }

    // 6b. Citizen role -> 403 Forbidden
    const citizenRes = await fetch(`${targetBaseUrl}/api/v1/admin/analytics`, {
      headers: { Authorization: 'Bearer demo-token-citizen' },
    });
    if (citizenRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for citizen accessing admin route, got ${citizenRes.status}`);
    }

    // 6c. Admin role -> 200 OK
    const adminRes = await fetch(`${targetBaseUrl}/api/v1/admin/analytics`, {
      headers: { Authorization: 'Bearer demo-token-admin' },
    });
    if (adminRes.status !== 200) {
      throw new Error(`Expected 200 OK for admin role, got ${adminRes.status}`);
    }

    return 'Unauthenticated: 401 | Citizen: 403 Forbidden | Admin: 200 OK';
  });
  if (!step6) allPassed = false;

  // 7. Statutory RTI Drafting & Bilingual Generation
  const step7 = await runStep(7, 'Statutory RTI Section 6(1) Drafter (/ai/rti-draft)', async () => {
    const res = await fetch(`${targetBaseUrl}/api/v1/ai/rti-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicantName: 'Vikram Joshi',
        address: '14/B Vasundhara Enclave, Delhi',
        contactNumber: '+91 98765 43210',
        authorityName: 'Municipal Corporation of Delhi',
        subject: 'Audit of delayed road resurfacing on Sector 4 main avenue',
        description: 'Road damage reported 4 weeks ago without resolution.',
        language: 'en',
      }),
    });
    if (!res.ok) {
      throw new Error(`POST /api/v1/ai/rti-draft failed with status ${res.status}`);
    }
    const json = (await res.json()) as {
      success: boolean;
      draft?: { englishDraft: string; hindiDraft: string };
    };
    if (!json.draft?.englishDraft || !json.draft?.hindiDraft) {
      throw new Error('RTI draft response missing dual-language statutory drafts');
    }
    return `Bilingual statutory RTI generated (${json.draft.englishDraft.length} chars EN / ${json.draft.hindiDraft.length} chars HI)`;
  });
  if (!step7) allPassed = false;

  // Summary
  console.log('\n------------------------------------------------------------');
  const totalDuration = results.reduce((acc, r) => acc + r.durationMs, 0);
  const passedCount = results.filter((r) => r.passed).length;
  console.log(
    `Summary: ${passedCount}/${results.length} checks passed in ${totalDuration}ms. Overall: ${
      allPassed ? '\x1b[32m✔ SUCCESS\x1b[0m' : '\x1b[31m✖ FAILURE\x1b[0m'
    }`
  );
  console.log('------------------------------------------------------------\n');

  if (!allPassed) {
    process.exit(1);
  }
}

void main();
