import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../app.js';
import { validateEnv } from '../config/env.js';
import {
  setLogSink,
  resetLogSink,
  redactSensitiveString,
  redactSensitiveData,
  type StructuredLogEntry,
} from '../middleware/logger.js';
import { getInMemoryLimiter } from '../middleware/rate-limiter.js';

describe('Strict Env Validation and Structured Logger', () => {
  beforeEach(() => {
    getInMemoryLimiter().reset();
  });

  afterEach(() => {
    resetLogSink();
  });

  it('validates environment with defaults', () => {
    const valid = validateEnv({});
    expect(valid.NODE_ENV).toBe('development');
    expect(valid.PORT).toBe(3000);
    expect(valid.LOG_LEVEL).toBe('info');
    expect(valid.CORS_ORIGIN).toContain('http://localhost:5173');
  });

  it('throws on invalid environment variables', () => {
    expect(() => validateEnv({ NODE_ENV: 'invalid_mode' })).toThrow(/Environment validation failed/);
    expect(() => validateEnv({ DATABASE_URL: 'not-a-valid-url' })).toThrow(/Environment validation failed/);
  });

  it('redacts sensitive strings (emails and Indian phone numbers)', () => {
    const text = 'User citizen@example.com reported an issue with phone +919876543210 and 9123456789.';
    const redacted = redactSensitiveString(text);

    expect(redacted).not.toContain('citizen@example.com');
    expect(redacted).not.toContain('+919876543210');
    expect(redacted).not.toContain('9123456789');
    expect(redacted).toContain('[REDACTED_EMAIL]');
    expect(redacted).toContain('[REDACTED_PHONE]');
  });

  it('redacts sensitive keys in data objects', () => {
    const data = {
      user: 'John Doe',
      password: 'plainSecretPassword123',
      token: 'jwt.token.secret',
      aadhar: '1234-5678-9012',
      details: {
        credit_card: '4111222233334444',
        safeField: 'harmless value',
      },
    };

    const redacted = redactSensitiveData(data) as Record<string, unknown>;
    expect(redacted['password']).toBe('[REDACTED]');
    expect(redacted['token']).toBe('[REDACTED]');
    expect(redacted['aadhar']).toBe('[REDACTED]');
    const details = redacted['details'] as Record<string, unknown>;
    expect(details['credit_card']).toBe('[REDACTED]');
    expect(details['safeField']).toBe('harmless value');
  });

  it('captures structured log entries with correlated requestId and duration', async () => {
    const capturedLogs: StructuredLogEntry[] = [];
    setLogSink((entry) => {
      capturedLogs.push(entry);
    });

    const app = createApp();
    const res = await app.request('/health', {
      headers: {
        'x-request-id': 'req-test-trace-99',
        'user-agent': 'Vitest-Agent/1.0',
      },
    });

    expect(res.status).toBe(200);
    expect(capturedLogs.length).toBeGreaterThan(0);

    const log = capturedLogs.find((entry) => entry.requestId === 'req-test-trace-99');
    expect(log).toBeDefined();
    expect(log?.method).toBe('GET');
    expect(log?.path).toBe('/health');
    expect(log?.status).toBe(200);
    expect(typeof log?.durationMs).toBe('number');
    expect(log?.userAgent).toBe('Vitest-Agent/1.0');
    expect(log?.level).toBe('info');
  });
});
