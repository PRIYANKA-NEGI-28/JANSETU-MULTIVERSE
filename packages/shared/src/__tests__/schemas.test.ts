import { describe, it, expect } from 'vitest';
import {
  CreateComplaintSchema,
  UpdateClusterStatusSchema,
  RtiDraftInputSchema,
  IotEventPayloadSchema,
  IotHeartbeatPayloadSchema,
} from '../schemas/index.js';

describe('Zod API Schemas Validation', () => {
  describe('CreateComplaintSchema', () => {
    it('validates and populates defaults for minimal valid complaint', () => {
      const input = {
        text: 'Broken road near block C market with large potholes',
        area: 'Indirapuram',
        ward: 'Ward 12',
      };
      const result = CreateComplaintSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Anonymous');
        expect(result.data.issue_type).toBe('General Complaint');
        expect(result.data.urgency).toBe('MEDIUM');
        expect(result.data.city).toBe('Delhi NCR');
        expect(result.data.latitude).toBe(28.6139);
        expect(result.data.longitude).toBe(77.209);
      }
    });

    it('rejects text shorter than 5 characters', () => {
      const input = {
        text: 'bad',
        area: 'Indirapuram',
        ward: 'Ward 12',
      };
      const result = CreateComplaintSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('validates 10-digit Indian phone numbers', () => {
      const valid = {
        text: 'Street light is blinking and sparking in the dark',
        area: 'Mayur Vihar',
        ward: 'Ward 4',
        phone: '9876543210',
      };
      expect(CreateComplaintSchema.safeParse(valid).success).toBe(true);

      const invalid = { ...valid, phone: '123' };
      expect(CreateComplaintSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('UpdateClusterStatusSchema', () => {
    it('validates clean status updates with notes', () => {
      const input = {
        complaint_id: 'JS-20261123-1001',
        status: 'IN_PROGRESS',
        officer_id: 'OFFICER-007',
        notes: 'Inspection team dispatched on site',
      };
      const result = UpdateClusterStatusSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid statuses', () => {
      const input = {
        complaint_id: 'JS-20261123-1001',
        status: 'INVALID_STATUS',
      };
      expect(UpdateClusterStatusSchema.safeParse(input).success).toBe(false);
    });
  });

  describe('RtiDraftInputSchema', () => {
    it('validates complete RTI request', () => {
      const input = {
        applicantName: 'Rajesh Sharma',
        address: 'House 42, Sector 15, Noida',
        contactNumber: '9876543210',
        authorityName: 'Noida Authority',
        subject: 'Information regarding drain desilting funds',
        description: 'Requesting certified copies of tenders for 2025-2026',
        specificQuestions: [
          'What was the total budget allocated?',
          'Which contractor was awarded the work?',
        ],
        preferredLanguage: 'en',
      };
      const result = RtiDraftInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('requires applicant name, address, contact, and authority', () => {
      const result = RtiDraftInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('IotEventPayloadSchema', () => {
    it('validates IoT fault and resolved payloads', () => {
      const faultPayload = {
        device_id: 'UNO_Q_01',
        status: 'FAULT',
        type: 'STREETLIGHT',
      };
      expect(IotEventPayloadSchema.safeParse(faultPayload).success).toBe(true);

      const resolvedPayload = {
        device_id: 'UNO_Q_01',
        status: 'RESOLVED',
      };
      expect(IotEventPayloadSchema.safeParse(resolvedPayload).success).toBe(true);
    });

    it('rejects invalid status types', () => {
      const invalid = {
        device_id: 'UNO_Q_01',
        status: 'BROKEN',
      };
      expect(IotEventPayloadSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('IotHeartbeatPayloadSchema', () => {
    it('validates device telemetry metrics', () => {
      const heartbeat = {
        device_id: 'UNO_Q_01',
        timestamp: Date.now(),
        battery_level: 94,
        signal_strength: -65,
        status: 'HEALTHY',
      };
      expect(IotHeartbeatPayloadSchema.safeParse(heartbeat).success).toBe(true);
    });

    it('validates battery range within 0-100', () => {
      const badBattery = {
        device_id: 'UNO_Q_01',
        timestamp: Date.now(),
        battery_level: 150,
      };
      expect(IotHeartbeatPayloadSchema.safeParse(badBattery).success).toBe(false);
    });
  });
});
