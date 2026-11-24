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

  it('enforces hardened production secrets when NODE_ENV is production', () => {
    // Missing DATABASE_URL
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: 'super-secure-production-better-auth-secret-string-at-least-32chars',
        DEVICE_HMAC_SECRET: 'production-device-secret-12345',
        QSTASH_CURRENT_SIGNING_KEY: 'sigkey_prod_12345',
      })
    ).toThrow(/DATABASE_URL is required/);

    // Default dev BETTER_AUTH_SECRET
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://user:pass@ep-cool.us-east-1.aws.neon.tech/jansetu',
        BETTER_AUTH_SECRET: 'jansetu-multiverse-development-secret-key-32chars',
        DEVICE_HMAC_SECRET: 'production-device-secret-12345',
        QSTASH_CURRENT_SIGNING_KEY: 'sigkey_prod_12345',
      })
    ).toThrow(/BETTER_AUTH_SECRET must be at least 32 characters and cannot use default dev secret/);

    // Short BETTER_AUTH_SECRET
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://user:pass@ep-cool.us-east-1.aws.neon.tech/jansetu',
        BETTER_AUTH_SECRET: 'too-short-secret',
        DEVICE_HMAC_SECRET: 'production-device-secret-12345',
        QSTASH_CURRENT_SIGNING_KEY: 'sigkey_prod_12345',
      })
    ).toThrow(/BETTER_AUTH_SECRET must be at least 32 characters and cannot use default dev secret/);

    // Default dev DEVICE_HMAC_SECRET
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://user:pass@ep-cool.us-east-1.aws.neon.tech/jansetu',
        BETTER_AUTH_SECRET: 'super-secure-production-better-auth-secret-string-at-least-32chars',
        DEVICE_HMAC_SECRET: 'jansetu-iot-dev-secret',
        QSTASH_CURRENT_SIGNING_KEY: 'sigkey_prod_12345',
      })
    ).toThrow(/DEVICE_HMAC_SECRET cannot use default dev secret/);

    // Missing QSTASH_CURRENT_SIGNING_KEY
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://user:pass@ep-cool.us-east-1.aws.neon.tech/jansetu',
        BETTER_AUTH_SECRET: 'super-secure-production-better-auth-secret-string-at-least-32chars',
        DEVICE_HMAC_SECRET: 'production-device-secret-12345',
      })
    ).toThrow(/QSTASH_CURRENT_SIGNING_KEY is required/);

    // Valid production environment
    const validProd = validateEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://user:pass@ep-cool.us-east-1.aws.neon.tech/jansetu',
      BETTER_AUTH_SECRET: 'super-secure-production-better-auth-secret-string-at-least-32chars',
      DEVICE_HMAC_SECRET: 'production-device-secret-12345',
      QSTASH_CURRENT_SIGNING_KEY: 'sigkey_prod_12345',
    });
    expect(validProd.NODE_ENV).toBe('production');
    expect(validProd.BETTER_AUTH_SECRET).toBe(
      'super-secure-production-better-auth-secret-string-at-least-32chars'
    );
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
