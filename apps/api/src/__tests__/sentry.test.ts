import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SentryClient,
  getSentry,
  scrubPiiText,
  defaultBeforeSend,
  type SentryEvent,
} from '../lib/sentry.js';

describe('Sentry Error Tracking & PII Scrubbing Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('scrubPiiText', () => {
    it('masks Indian phone numbers (+91 and 10 digits)', () => {
      const input = 'Complainant contact is +91 9876543210 and alternate 9123456789.';
      const scrubbed = scrubPiiText(input);
      expect(scrubbed).not.toContain('9876543210');
      expect(scrubbed).not.toContain('9123456789');
      expect(scrubbed).toContain('[REDACTED_PHONE]');
    });

    it('masks email addresses', () => {
      const input = 'Officer email is officer.indirapuram@jansetu.gov.in and citizen@example.com.';
      const scrubbed = scrubPiiText(input);
      expect(scrubbed).not.toContain('officer.indirapuram@jansetu.gov.in');
      expect(scrubbed).not.toContain('citizen@example.com');
      expect(scrubbed).toContain('[REDACTED_EMAIL]');
    });

    it('masks Aadhaar numbers', () => {
      const input = 'Citizen BPL verification Aadhaar: 1234 5678 9012.';
      const scrubbed = scrubPiiText(input);
      expect(scrubbed).not.toContain('1234 5678 9012');
      expect(scrubbed).toContain('[REDACTED_AADHAAR]');
    });

    it('masks PAN cards', () => {
      const input = 'Citizen identity PAN: ABCDE1234F.';
      const scrubbed = scrubPiiText(input);
      expect(scrubbed).not.toContain('ABCDE1234F');
      expect(scrubbed).toContain('[REDACTED_PAN]');
    });

    it('masks bearer tokens', () => {
      const input = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret';
      const scrubbed = scrubPiiText(input);
      expect(scrubbed).not.toContain('eyJhbGci');
      expect(scrubbed).toContain('Bearer [REDACTED_TOKEN]');
    });
  });

  describe('scrubPiiObject & defaultBeforeSend', () => {
    it('redacts sensitive headers, exact coordinates, and user IP addresses in SentryEvent', () => {
      const rawEvent: SentryEvent = {
        event_id: 'test-event-01',
        timestamp: new Date().toISOString(),
        platform: 'javascript',
        level: 'error',
        message: {
          formatted: 'Failure processing complaint for citizen at user@test.com with phone 9876543210',
        },
        user: {
          id: 'user-123',
          role: 'citizen',
          ip_address: '103.21.244.0',
        },
        request: {
          url: 'https://api.jansetu.gov.in/api/v1/complaints?email=citizen@gov.in',
          method: 'POST',
          headers: {
            authorization: 'Bearer secret-session-token-xyz',
            cookie: 'session_id=12345; auth=secure',
            'content-type': 'application/json',
          },
        },
        extra: {
          exactLocation: { lat: 28.6139, lng: 77.209 },
          contactPhone: '+91 9999988888',
        },
      };

      const scrubbed = defaultBeforeSend(rawEvent);

      // Verify message PII redacted
      expect(scrubbed.message?.formatted).toContain('[REDACTED_EMAIL]');
      expect(scrubbed.message?.formatted).toContain('[REDACTED_PHONE]');

      // Verify user IP wiped to null
      expect(scrubbed.user?.ip_address).toBeNull();
      expect(scrubbed.user?.id).toBe('user-123');

      // Verify headers redacted
      expect(scrubbed.request?.headers?.authorization).toBe('[REDACTED]');
      expect(scrubbed.request?.headers?.cookie).toBe('[REDACTED]');
      expect(scrubbed.request?.headers?.['content-type']).toBe('application/json');

      // Verify URL query param scrubbed
      expect(scrubbed.request?.url).toContain('[REDACTED_EMAIL]');

      // Verify exact location coordinates redacted in extra
      const extra = scrubbed.extra as Record<string, unknown>;
      expect(extra.exactLocation).toBe('[REDACTED_COORDINATES]');
      expect(extra.contactPhone).toBe('[REDACTED_PHONE]');
    });
  });

  describe('Graceful Degradation (Disabled when DSN is unset)', () => {
    it('disables client when DSN is empty or unset, returning null without throwing', async () => {
      const client = new SentryClient({ dsn: undefined });
      expect(client.isEnabled).toBe(false);

      const exceptionResult = await client.captureException(new Error('Test error'));
      expect(exceptionResult).toBeNull();

      const messageResult = await client.captureMessage('Test info message', 'info');
      expect(messageResult).toBeNull();
    });

    it('enables client and executes fetch when valid DSN is provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'sentry-id-123' }), { status: 200 }));
      vi.stubGlobal('fetch', mockFetch);

      const client = new SentryClient({
        dsn: 'https://public_key_abc@o123456.ingest.sentry.io/789012',
        environment: 'test',
        release: 'jansetu-api@1.0.0',
      });

      expect(client.isEnabled).toBe(true);

      const eventId = await client.captureException(new Error('Database query timeout for user user@example.com'));
      expect(eventId).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://o123456.ingest.sentry.io/api/789012/store/');
      expect(init.headers).toHaveProperty('X-Sentry-Auth');
      expect(init.headers).toHaveProperty('Content-Type', 'application/json');

      // Ensure body was scrubbed
      const parsedBody = JSON.parse(init.body as string) as SentryEvent;
      expect(parsedBody.exception?.values[0]?.value).toContain('[REDACTED_EMAIL]');
    });

    it('getSentry singleton returns disabled instance when process.env.SENTRY_DSN is unset', () => {
      delete process.env.SENTRY_DSN;
      const sentry = getSentry();
      expect(sentry.isEnabled).toBe(false);
    });
  });
});
