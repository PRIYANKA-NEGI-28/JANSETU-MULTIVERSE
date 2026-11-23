import { describe, it, expect } from 'vitest';
import {
  WebSentryClient,
  scrubPiiText,
  defaultBeforeSend,
  type SentryEvent,
} from '../lib/sentry.js';

describe('Web Sentry Client & PII Scrubbing', () => {
  it('masks citizen phone numbers and emails in error messages', () => {
    const raw = 'Error uploading photo for user ramesh@gmail.com phone +91 9876543210';
    const clean = scrubPiiText(raw);
    expect(clean).toContain('[REDACTED_EMAIL]');
    expect(clean).toContain('[REDACTED_PHONE]');
    expect(clean).not.toContain('ramesh@gmail.com');
    expect(clean).not.toContain('9876543210');
  });

  it('drops auth headers and clears client IP in beforeSend', () => {
    const event: SentryEvent = {
      event_id: 'ev-1',
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      level: 'error',
      user: { id: 'cit-1', ip_address: '1.2.3.4' },
      extra: {
        authorization: 'Bearer token-123',
        exactLocation: { lat: 28.5, lng: 77.3 },
      },
    };

    const scrubbed = defaultBeforeSend(event);
    expect(scrubbed.user?.ip_address).toBeNull();
    const extra = scrubbed.extra as Record<string, unknown>;
    expect(extra.authorization).toBe('[REDACTED]');
    expect(extra.exactLocation).toBe('[REDACTED_COORDINATES]');
  });

  it('stays gracefully disabled when DSN is unset', async () => {
    const client = new WebSentryClient({ dsn: '' });
    expect(client.isEnabled).toBe(false);
    const res = await client.captureException(new Error('UI render failure'));
    expect(res).toBeNull();
  });
});
