import { describe, it, expect } from 'vitest';
import {
  serializePublicComplaint,
  serializeOfficerComplaint,
  serializeComplaint,
  serializeComplaintList,
  type ComplaintEntity,
  type OfficerComplaintDto,
} from '../serializers/complaint.js';
import {
  serializePublicCluster,
  serializeOfficerCluster,
  serializeCluster,
  type ClusterEntity,
} from '../serializers/cluster.js';
import type { AuthUser } from '../types/index.js';

describe('Response Serializers (Public vs Officer/Owner DTOs)', () => {
  const sampleComplaint: ComplaintEntity = {
    id: 'complaint-001',
    trackingCode: 'JS-20261123-0001',
    idempotencyKey: 'idem-key-12345',
    citizenId: 'citizen-user-01',
    citizenName: 'Amit Verma',
    citizenPhone: '+919876543210',
    citizenEmail: 'amit.verma@example.com',
    departmentId: 'dept-elec',
    wardId: 'ward-04',
    clusterId: 'cluster-elec-04',
    category: 'Street Light',
    urgency: 'HIGH',
    status: 'ASSIGNED',
    title: 'Flickering high-voltage streetlight pole',
    description: 'Streetlight pole 44 has sparking live wires exposed.',
    rawText: 'Please fix streetlight pole 44 on main road near colony gate.',
    language: 'en',
    exactLocation: { lat: 28.613912, lng: 77.209021 },
    publicLocation: { lat: 28.614, lng: 77.209 },
    photoUrl: 'https://storage.jansetu.gov.in/photos/complaint-001.jpg',
    assignedOfficerId: 'officer-ward04-elec',
    slaDueAt: '2026-11-24T12:00:00.000Z',
    resolvedAt: null,
    escalatedAt: null,
    createdAt: '2026-11-23T12:00:00.000Z',
    updatedAt: '2026-11-23T12:30:00.000Z',
  };

  const sampleCluster: ClusterEntity = {
    id: 'cluster-001',
    title: 'Streetlight outage cluster on Kala Patthar Road',
    departmentId: 'dept-elec',
    wardId: 'ward-04',
    status: 'IN_PROGRESS',
    centroid: { lat: 28.614, lng: 77.209 },
    complaintCount: 5,
    lastActivityAt: '2026-11-23T14:00:00.000Z',
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T14:00:00.000Z',
    assignedOfficerId: 'officer-ward04-elec',
    internalNotes: 'Replacement bulbs requested from central depot.',
  };

  describe('serializePublicComplaint', () => {
    it('strictly strips exactLocation and all citizen PII', () => {
      const publicDto = serializePublicComplaint(sampleComplaint);

      // PII assertions using 'in' operator
      expect('citizenName' in publicDto).toBe(false);
      expect('citizenPhone' in publicDto).toBe(false);
      expect('citizenEmail' in publicDto).toBe(false);
      expect('citizenId' in publicDto).toBe(false);
      expect('assignedOfficerId' in publicDto).toBe(false);
      expect('rawText' in publicDto).toBe(false);
      expect('idempotencyKey' in publicDto).toBe(false);

      // GPS spatial privacy assertion
      expect('exactLocation' in publicDto).toBe(false);
      expect(publicDto.publicLocation).toEqual({ lat: 28.614, lng: 77.209 });

      // Core fields preserved
      expect(publicDto.id).toBe('complaint-001');
      expect(publicDto.trackingCode).toBe('JS-20261123-0001');
      expect(publicDto.category).toBe('Street Light');
      expect(publicDto.urgency).toBe('HIGH');
      expect(publicDto.status).toBe('ASSIGNED');
      expect(publicDto.wardId).toBe('ward-04');
      expect(publicDto.departmentId).toBe('dept-elec');
      expect(publicDto.clusterId).toBe('cluster-elec-04');
    });
  });

  describe('serializeOfficerComplaint', () => {
    it('includes exact GPS location and full citizen details for authorized personnel', () => {
      const officerDto = serializeOfficerComplaint(sampleComplaint);

      expect(officerDto.exactLocation).toEqual({ lat: 28.613912, lng: 77.209021 });
      expect(officerDto.citizenName).toBe('Amit Verma');
      expect(officerDto.citizenPhone).toBe('+919876543210');
      expect(officerDto.citizenEmail).toBe('amit.verma@example.com');
      expect(officerDto.citizenId).toBe('citizen-user-01');
      expect(officerDto.assignedOfficerId).toBe('officer-ward04-elec');
      expect(officerDto.rawText).toContain('Please fix streetlight pole 44');
    });
  });

  describe('serializeComplaint (RBAC & Owner-based Dispatch)', () => {
    it('returns Public DTO when unauthenticated', () => {
      const result = serializeComplaint(sampleComplaint, null);
      expect('exactLocation' in result).toBe(false);
      expect('citizenPhone' in result).toBe(false);
    });

    it('returns Public DTO when viewed by unrelated citizen', () => {
      const otherCitizen: AuthUser = {
        id: 'other-citizen-99',
        name: 'Sneha Patel',
        email: 'sneha@example.com',
        role: 'citizen',
        wardId: 'ward-04',
      };

      const result = serializeComplaint(sampleComplaint, otherCitizen);
      expect('exactLocation' in result).toBe(false);
      expect('citizenPhone' in result).toBe(false);
    });

    it('returns privileged Owner DTO when viewed by original complaint reporter', () => {
      const ownerCitizen: AuthUser = {
        id: 'citizen-user-01',
        name: 'Amit Verma',
        email: 'amit.verma@example.com',
        role: 'citizen',
        wardId: 'ward-04',
      };

      const result = serializeComplaint(sampleComplaint, ownerCitizen) as OfficerComplaintDto;
      expect(result.exactLocation).toEqual({ lat: 28.613912, lng: 77.209021 });
      expect(result.citizenPhone).toBe('+919876543210');
      expect(result.citizenEmail).toBe('amit.verma@example.com');
    });

    it('returns privileged Officer DTO for ward officer in the same ward and department', () => {
      const assignedOfficer: AuthUser = {
        id: 'officer-01',
        name: 'Officer Rajesh',
        email: 'rajesh@jansetu.gov.in',
        role: 'ward_officer',
        wardId: 'ward-04',
        departmentId: 'dept-elec',
      };

      const result = serializeComplaint(sampleComplaint, assignedOfficer) as OfficerComplaintDto;
      expect(result.exactLocation).toEqual({ lat: 28.613912, lng: 77.209021 });
      expect(result.assignedOfficerId).toBe('officer-ward04-elec');
    });

    it('returns redacted Public DTO for ward officer assigned to a DIFFERENT ward', () => {
      const differentWardOfficer: AuthUser = {
        id: 'officer-other-ward',
        name: 'Officer Suresh',
        email: 'suresh@jansetu.gov.in',
        role: 'ward_officer',
        wardId: 'ward-12', // Complaint is in ward-04
        departmentId: 'dept-elec',
      };

      const result = serializeComplaint(sampleComplaint, differentWardOfficer);
      expect('exactLocation' in result).toBe(false);
      expect('citizenPhone' in result).toBe(false);
    });

    it('returns privileged Officer DTO for admin across any ward', () => {
      const admin: AuthUser = {
        id: 'admin-master',
        name: 'System Admin',
        email: 'admin@jansetu.gov.in',
        role: 'admin',
      };

      const result = serializeComplaint(sampleComplaint, admin) as OfficerComplaintDto;
      expect(result.exactLocation).toEqual({ lat: 28.613912, lng: 77.209021 });
      expect(result.citizenPhone).toBe('+919876543210');
    });

    it('serializes arrays of complaints properly with serializeComplaintList', () => {
      const list = serializeComplaintList([sampleComplaint], null);
      expect(list.length).toBe(1);
      const first = list[0];
      expect(first).toBeDefined();
      if (first) {
        expect('exactLocation' in first).toBe(false);
      }
    });
  });

  describe('Cluster Serializers', () => {
    it('public cluster DTO strips internal assignment and notes', () => {
      const publicCluster = serializePublicCluster(sampleCluster);

      expect(publicCluster.id).toBe('cluster-001');
      expect(publicCluster.title).toBe('Streetlight outage cluster on Kala Patthar Road');
      expect('assignedOfficerId' in publicCluster).toBe(false);
      expect('internalNotes' in publicCluster).toBe(false);
    });

    it('officer cluster DTO preserves internal assignment and notes for ward officer', () => {
      const officerCluster = serializeOfficerCluster(sampleCluster);
      expect(officerCluster.assignedOfficerId).toBe('officer-ward04-elec');
      expect(officerCluster.internalNotes).toBe('Replacement bulbs requested from central depot.');
    });

    it('redacts cluster internal notes when requested by officer from another ward', () => {
      const foreignOfficer: AuthUser = {
        id: 'officer-foreign',
        name: 'Officer Anil',
        email: 'anil@jansetu.gov.in',
        role: 'ward_officer',
        wardId: 'ward-12', // cluster is in ward-04
      };

      const result = serializeCluster(sampleCluster, foreignOfficer);
      expect('internalNotes' in result).toBe(false);
      expect('assignedOfficerId' in result).toBe(false);
    });
  });
});
