import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/index.js';

export interface StructuredLogEntry {
  readonly timestamp: string;
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly requestId: string;
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly durationMs: number;
  readonly ip: string;
  readonly userAgent?: string;
  readonly error?: {
    readonly message: string;
    readonly name: string;
  };
}

export type LogSink = (entry: StructuredLogEntry) => void;

let activeLogSink: LogSink = (entry: StructuredLogEntry) => {
  const json = JSON.stringify(entry);
  if (entry.level === 'error') {
    console.error(json);
  } else if (entry.level === 'warn') {
    console.warn(json);
  } else {
    console.info(json);
  }
};

export function setLogSink(sink: LogSink): void {
  activeLogSink = sink;
}

export function resetLogSink(): void {
  activeLogSink = (entry: StructuredLogEntry) => {
    const json = JSON.stringify(entry);
    if (entry.level === 'error') {
      console.error(json);
    } else if (entry.level === 'warn') {
      console.warn(json);
    } else {
      console.info(json);
    }
  };
}

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
]);

const SENSITIVE_FIELD_REGEX = /(?:password|token|secret|aadhar|phone|email|otp|pin|credit_card)/i;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+91[-\s]?)?[6-9]\d{9}/g;

export function redactSensitiveString(value: string): string {
  return value.replace(EMAIL_REGEX, '[REDACTED_EMAIL]').replace(PHONE_REGEX, '[REDACTED_PHONE]');
}

export function redactSensitiveData(data: unknown): unknown {
  if (typeof data === 'string') {
    return redactSensitiveString(data);
  }
  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }
  if (data !== null && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(record)) {
      if (SENSITIVE_FIELD_REGEX.test(key) || SENSITIVE_HEADERS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = redactSensitiveData(val);
      }
    }
    return sanitized;
  }
  return data;
}

export function sanitizeRequestId(rawId?: string): string {
  if (rawId && /^[a-zA-Z0-9_-]{1,64}$/.test(rawId)) {
    return rawId;
  }
  return crypto.randomUUID();
}

export const loggerMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const startTime = Date.now();
  c.set('startTime', startTime);

  const rawRequestId = c.req.header('x-request-id');
  const requestId = sanitizeRequestId(rawRequestId);
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);

  const ip =
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    '127.0.0.1';

  let hasError = false;
  let caughtError: Error | undefined;

  try {
    await next();
  } catch (err) {
    hasError = true;
    caughtError = err instanceof Error ? err : new Error(String(err));
    throw err;
  } finally {
    const durationMs = Date.now() - startTime;
    const status = c.res.status || (hasError ? 500 : 200);
    const level: StructuredLogEntry['level'] =
      status >= 500 || hasError ? 'error' : status >= 400 ? 'warn' : 'info';

    const logEntry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId,
      method: c.req.method,
      path: c.req.path,
      status,
      durationMs,
      ip,
      userAgent: c.req.header('user-agent'),
      ...(caughtError
        ? {
            error: {
              name: caughtError.name,
              message: redactSensitiveString(caughtError.message),
            },
          }
        : {}),
    };

    activeLogSink(logEntry);
  }
};
