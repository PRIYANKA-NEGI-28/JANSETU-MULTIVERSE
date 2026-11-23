import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { getRtiStore } from '../services/rti-store.js';
import { getStorageService } from '../services/storage.js';
import { getComplaintStore } from '../services/complaint-store.js';
import type { RtiApplicationEntity } from '../services/rti-store.js';
import type { RfcProblemDetails } from '../types/index.js';

describe('RTI Section 6(1) Module & PDF Generation', () => {
  const app = createApp();
  const rtiStore = getRtiStore();
  const storage = getStorageService();
  const complaintStore = getComplaintStore();

  const citizenUser = {
    id: 'citizen-rti-1',
    name: 'Pooja Verma',
    email: 'pooja.verma@example.com',
    role: 'citizen',
  };

  const adminUser = {
    id: 'admin-rti-1',
    name: 'Super Admin',
    email: 'admin@jansetu.gov.in',
    role: 'admin',
  };

  const citizenAuthHeader = {
    'x-test-user': JSON.stringify(citizenUser),
  };

  const adminAuthHeader = {
    'x-test-user': JSON.stringify(adminUser),
  };

  beforeEach(() => {
    rtiStore.reset();
    storage.reset();
    complaintStore.reset();
  });

  describe('POST /api/v1/rti - Statutory RTI Application Creation', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await app.request('/api/v1/rti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorityName: 'Municipal Corporation of Delhi',
          subject: 'Street Light Maintenance Inaction',
          description: 'No action taken on broken streetlight for 3 weeks',
        }),
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as RfcProblemDetails;
      expect(json.status).toBe(401);
      expect(json.title).toBe('Unauthorized');
    });

    it('validates required fields with 400 Bad Request', async () => {
      const res = await app.request('/api/v1/rti', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...citizenAuthHeader,
        },
        body: JSON.stringify({
          // Missing applicantName, address, contactNumber, authorityName, subject, description
        }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as RfcProblemDetails;
      expect(json.status).toBe(400);
      expect(json.title).toBe('Bad Request');
    });

    it('creates standalone statutory RTI application with dual-language drafts', async () => {
      const res = await app.request('/api/v1/rti', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...citizenAuthHeader,
        },
        body: JSON.stringify({
          applicantName: 'Pooja Verma',
          address: 'Flat 402, Sunshine Apartments, Mayur Vihar Phase 1, Delhi',
          contactNumber: '9876543210',
          email: 'pooja.verma@example.com',
          authorityName: 'Public Works Department (PWD), Delhi',
          publicAuthorityAddress: '12th Floor, MSO Building, IP Estate, New Delhi',
          subject: 'Drainage repair status on Main Ring Road',
          description: 'Open drainage causing severe health hazard and flooding during monsoon',
          isBplExempt: false,
        }),
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as { rti: RtiApplicationEntity };
      const rti = json.rti;

      expect(rti.id).toMatch(/^rti-[a-f0-9-]+$/);
      expect(rti.citizenId).toBe(citizenUser.id);
      expect(rti.applicantName).toBe('Pooja Verma');
      expect(rti.authorityName).toBe('Public Works Department (PWD), Delhi');
      expect(rti.englishDraft).toContain("FORM 'A'");
      expect(rti.englishDraft).toContain('SECTION 6(1)');
      expect(rti.englishDraft).toContain('Public Works Department (PWD), Delhi');
      expect(rti.hindiDraft).toContain("प्रपत्र 'क'");
      expect(rti.hindiDraft).toContain('धारा 6(1)');
      expect(rti.status).toBe('FILED');
      expect(rti.isBplExempt).toBe(false);
    });

    it('auto-injects grievance cluster tracking code, department, and SLA status when clusterId is provided', async () => {
      // 1. Create a grievance cluster
      const cluster = {
        id: 'cluster-delhi-pwd-77',
        title: 'Open Trench Near Mayur Vihar Metro',
        departmentId: 'pwd',
        wardId: 'ward-05',
        status: 'PENDING',
        centroid: { lat: 28.601, lng: 77.295 },
        complaintCount: 4,
        createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000), // 7 days ago
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      };
      await complaintStore.saveCluster(cluster);

      // 2. Submit RTI referencing this cluster
      const res = await app.request('/api/v1/rti', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...citizenAuthHeader,
        },
        body: JSON.stringify({
          applicantName: 'Pooja Verma',
          address: 'Mayur Vihar Phase 1, Delhi',
          contactNumber: '9876543210',
          authorityName: 'Public Works Department',
          subject: 'Unresolved Open Trench Civic Hazard',
          description: 'Grievance was lodged but no municipal resolution has taken place.',
          clusterId: 'cluster-delhi-pwd-77',
          isBplExempt: true,
          bplCardNo: 'BPL-DL-2024-88492',
          bplYear: '2024',
        }),
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as { rti: RtiApplicationEntity };
      const rti = json.rti;

      expect(rti.clusterId).toBe('cluster-delhi-pwd-77');
      expect(rti.subject).toContain('cluster-delhi-pwd-77');
      expect(rti.description).toContain('Auto-Injected Grievance Details');
      expect(rti.description).toContain('cluster-delhi-pwd-77');
      expect(rti.description).toContain('pwd');

      // Check auto-injected statutory questions
      expect(rti.specificQuestions.length).toBeGreaterThanOrEqual(4);
      expect(rti.specificQuestions[0]).toContain('Certified copies of all site inspection reports');
      expect(rti.specificQuestions[1]).toContain('Daily progress report');
      expect(rti.specificQuestions[2]).toContain('Citizen Charter SLA');
      expect(rti.specificQuestions[3]).toContain('SLA breach');

      expect(rti.isBplExempt).toBe(true);
      expect(rti.bplCardNo).toBe('BPL-DL-2024-88492');
      expect(rti.englishDraft).toContain('BPL-DL-2024-88492');
      expect(rti.englishDraft).toContain('Exempted under Section 7(5)');
    });
  });

  describe('GET /api/v1/rti - Listing Filings with Role-Based Scoping', () => {
    it('scopes citizen queries to their own filings, while admin sees all filings', async () => {
      // Seed two applications by different users
      await rtiStore.createApplication({
        citizenId: citizenUser.id,
        applicantName: 'Pooja Verma',
        address: 'Delhi',
        contactNumber: '9876543210',
        authorityName: 'PWD',
        subject: 'Pooja Subject',
        description: 'Pooja Description',
      });

      await rtiStore.createApplication({
        citizenId: 'citizen-other-99',
        applicantName: 'Other Citizen',
        address: 'Noida',
        contactNumber: '9876543211',
        authorityName: 'Jal Board',
        subject: 'Other Subject',
        description: 'Other Description',
      });

      // Citizen request
      const citizenRes = await app.request('/api/v1/rti', {
        method: 'GET',
        headers: citizenAuthHeader,
      });
      expect(citizenRes.status).toBe(200);
      const citizenData = (await citizenRes.json()) as { applications: RtiApplicationEntity[]; total: number };
      expect(citizenData.total).toBe(1);
      expect(citizenData.applications[0]?.applicantName).toBe('Pooja Verma');

      // Admin request
      const adminRes = await app.request('/api/v1/rti', {
        method: 'GET',
        headers: adminAuthHeader,
      });
      expect(adminRes.status).toBe(200);
      const adminData = (await adminRes.json()) as { applications: RtiApplicationEntity[]; total: number };
      expect(adminData.total).toBe(2);
    });
  });

  describe('GET /api/v1/rti/:id/pdf - Statutory RTI PDF Generation & R2 Caching', () => {
    it('generates a valid Section 6(1) PDF with %PDF magic bytes and caches it in storage', async () => {
      const created = await rtiStore.createApplication({
        citizenId: citizenUser.id,
        applicantName: 'Pooja Verma',
        fatherOrSpouseName: 'Sanjay Verma',
        address: 'Flat 402, Mayur Vihar, Delhi',
        contactNumber: '9876543210',
        email: 'pooja.verma@example.com',
        authorityName: 'Delhi Jal Board, GNCTD',
        publicAuthorityAddress: 'Varunalaya Phase II, Jhandewalan, New Delhi',
        subject: 'Drinking Water Pipeline Contamination',
        description: 'Severe foul odor and black water supply in Ward 05 for the past 14 days.',
        specificQuestions: [
          'Certified copies of water quality test reports for Mayur Vihar Ward 05 taken during November 2026.',
          'Action taken report on Citizen Charter grievance submitted on 10 November 2026.',
          'Names and designations of the Junior Engineer and Assistant Engineer responsible for water quality in Ward 05.',
        ],
        isBplExempt: false,
      });

      // First Request: PDF Generation (Cache MISS)
      const firstRes = await app.request(`/api/v1/rti/${created.id}/pdf`, {
        method: 'GET',
        headers: citizenAuthHeader,
      });

      expect(firstRes.status).toBe(200);
      expect(firstRes.headers.get('Content-Type')).toBe('application/pdf');
      expect(firstRes.headers.get('Content-Disposition')).toContain(`inline; filename="rti-section6-${created.id}.pdf"`);
      expect(firstRes.headers.get('X-Cache')).toBe('MISS');

      const pdfArrayBuffer = await firstRes.arrayBuffer();
      const pdfBytes = new Uint8Array(pdfArrayBuffer);

      // Validate %PDF- magic bytes (0x25, 0x50, 0x44, 0x46, 0x2D)
      const pdfHeader = String.fromCharCode(...pdfBytes.slice(0, 5));
      expect(pdfHeader).toBe('%PDF-');
      expect(pdfBytes.byteLength).toBeGreaterThan(1000); // Standard A4 PDF is at least ~1KB+

      // Second Request: Served from R2 storage cache (Cache HIT)
      const secondRes = await app.request(`/api/v1/rti/${created.id}/pdf`, {
        method: 'GET',
        headers: citizenAuthHeader,
      });

      expect(secondRes.status).toBe(200);
      expect(secondRes.headers.get('Content-Type')).toBe('application/pdf');
      expect(secondRes.headers.get('X-Cache')).toBe('HIT');

      const cachedBytes = new Uint8Array(await secondRes.arrayBuffer());
      expect(cachedBytes.byteLength).toBe(pdfBytes.byteLength);
    });

    it('returns 404 Problem Details when requesting PDF for non-existent RTI application', async () => {
      const res = await app.request('/api/v1/rti/rti-does-not-exist/pdf', {
        method: 'GET',
        headers: citizenAuthHeader,
      });

      expect(res.status).toBe(404);
      const json = (await res.json()) as RfcProblemDetails;
      expect(json.status).toBe(404);
      expect(json.title).toBe('Not Found');
    });
  });
});
