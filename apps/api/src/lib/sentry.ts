export interface SentryBreadcrumb {
  readonly timestamp?: number;
  readonly type?: string;
  readonly category?: string;
  readonly level?: 'debug' | 'info' | 'warning' | 'error' | 'fatal';
  readonly message?: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface SentryUser {
  readonly id?: string;
  readonly role?: string;
  readonly username?: string;
  readonly ip_address?: string | null;
}

export interface SentryRequestInfo {
  readonly url?: string;
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly query_string?: string;
}

export interface SentryEvent {
  readonly event_id: string;
  readonly timestamp: string;
  readonly platform: string;
  readonly level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  readonly logger?: string;
  readonly server_name?: string;
  readonly release?: string;
  readonly environment?: string;
  readonly message?: {
    readonly formatted: string;
  };
  readonly exception?: {
    readonly values: readonly {
      readonly type: string;
      readonly value: string;
      readonly stacktrace?: {
        readonly frames: readonly {
          readonly filename?: string;
          readonly function?: string;
          readonly lineno?: number;
          readonly colno?: number;
        }[];
      };
    }[];
  };
  readonly user?: SentryUser;
  readonly request?: SentryRequestInfo;
  readonly extra?: Readonly<Record<string, unknown>>;
  readonly tags?: Readonly<Record<string, string>>;
  readonly breadcrumbs?: readonly SentryBreadcrumb[];
}

export interface SentryInitOptions {
  readonly dsn?: string | null;
  readonly environment?: string;
  readonly release?: string;
  readonly serverName?: string;
  readonly beforeSend?: (event: SentryEvent) => SentryEvent | null;
}

export interface SentryContext {
  readonly user?: SentryUser;
  readonly extra?: Record<string, unknown>;
  readonly tags?: Record<string, string>;
  readonly request?: SentryRequestInfo;
}

// Regular expressions for sensitive PII identification
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const PHONE_INDIA_REGEX = /(?:(?:\+91|0)[\s-]?)?[6-9]\d{9}\b/g;
const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g;
const BEARER_TOKEN_REGEX = /Bearer\s+([A-Za-z0-9_.-]+)/gi;

/**
 * Scans a string and masks any email, phone, Aadhaar, PAN, or token credentials.
 */
export function scrubPiiText(input: string): string {
  if (!input || typeof input !== 'string') {
    return input;
  }
  return input
    .replace(BEARER_TOKEN_REGEX, 'Bearer [REDACTED_TOKEN]')
    .replace(EMAIL_REGEX, '[REDACTED_EMAIL]')
    .replace(PHONE_INDIA_REGEX, '[REDACTED_PHONE]')
    .replace(AADHAAR_REGEX, '[REDACTED_AADHAAR]')
    .replace(PAN_REGEX, '[REDACTED_PAN]');
}

/**
 * Recursively scrubs PII from arbitrary objects, values, and arrays.
 */
export function scrubPiiObject<T>(val: T): T {
  if (val === null || val === undefined) {
    return val;
  }
  if (typeof val === 'string') {
    return scrubPiiText(val) as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map((item) => scrubPiiObject(item)) as unknown as T;
  }
  if (typeof val === 'object') {
    const scrubbedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      const lowerKey = k.toLowerCase();
      // Drop or mask sensitive header and auth keys completely
      if (
        lowerKey === 'authorization' ||
        lowerKey === 'cookie' ||
        lowerKey === 'set-cookie' ||
        lowerKey === 'apikey' ||
        lowerKey === 'token' ||
        lowerKey === 'secret' ||
        lowerKey === 'password'
      ) {
        scrubbedObj[k] = '[REDACTED]';
      } else if (
        lowerKey === 'exactlocation' ||
        lowerKey === 'exact_location' ||
        lowerKey === 'latitude' ||
        lowerKey === 'longitude'
      ) {
        // Redact exact coordinates if attached in debug context
        scrubbedObj[k] = '[REDACTED_COORDINATES]';
      } else {
        scrubbedObj[k] = scrubPiiObject(v);
      }
    }
    return scrubbedObj as T;
  }
  return val;
}

/**
 * Standard Sentry beforeSend PII scrubbing pipeline.
 */
export function defaultBeforeSend(event: SentryEvent): SentryEvent {
  const scrubbed: SentryEvent = {
    ...event,
    // Scrub formatted messages
    message: event.message
      ? { formatted: scrubPiiText(event.message.formatted) }
      : undefined,
    // Scrub exceptions stack values and messages
    exception: event.exception
      ? {
          values: event.exception.values.map((v) => ({
            ...v,
            value: scrubPiiText(v.value),
          })),
        }
      : undefined,
    // Strip citizen IP and identifiable phone/email in user context
    user: event.user
      ? {
          id: event.user.id,
          role: event.user.role,
          ip_address: null, // Never report citizen/officer IP
        }
      : undefined,
    // Scrub request headers and query strings
    request: event.request
      ? {
          url: scrubPiiText(event.request.url || ''),
          method: event.request.method,
          query_string: scrubPiiText(event.request.query_string || ''),
          headers: event.request.headers
            ? scrubPiiObject(event.request.headers)
            : undefined,
        }
      : undefined,
    // Scrub extra metadata
    extra: event.extra ? scrubPiiObject(event.extra) : undefined,
    // Scrub breadcrumbs
    breadcrumbs: event.breadcrumbs?.map((b) => ({
      ...b,
      message: b.message ? scrubPiiText(b.message) : undefined,
      data: b.data ? scrubPiiObject(b.data) : undefined,
    })),
  };

  return scrubbed;
}

export interface ParsedDsn {
  readonly protocol: string;
  readonly publicKey: string;
  readonly host: string;
  readonly projectId: string;
  readonly storeUrl: string;
}

export function parseSentryDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const host = url.host;
    const pathParts = url.pathname.split('/').filter(Boolean);
    const projectId = pathParts[pathParts.length - 1];

    if (!publicKey || !host || !projectId) {
      return null;
    }

    const storeUrl = `${url.protocol}//${host}/api/${projectId}/store/`;
    return {
      protocol: url.protocol,
      publicKey,
      host,
      projectId,
      storeUrl,
    };
  } catch {
    return null;
  }
}

export class SentryClient {
  private readonly parsedDsn: ParsedDsn | null = null;
  private readonly environment: string;
  private readonly release: string;
  private readonly serverName: string;
  private readonly beforeSend: (event: SentryEvent) => SentryEvent | null;
  private readonly breadcrumbs: SentryBreadcrumb[] = [];
  public readonly isEnabled: boolean;

  constructor(options: SentryInitOptions = {}) {
    const dsn = options.dsn?.trim();
    if (dsn) {
      this.parsedDsn = parseSentryDsn(dsn);
    }
    this.isEnabled = this.parsedDsn !== null;
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.release = options.release || 'jansetu-api@1.0.0';
    this.serverName = options.serverName || 'jansetu-api-worker';
    this.beforeSend = options.beforeSend || defaultBeforeSend;
  }

  public addBreadcrumb(breadcrumb: SentryBreadcrumb): void {
    if (!this.isEnabled) return;
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: breadcrumb.timestamp || Date.now() / 1000,
    });
    // Keep max 50 breadcrumbs
    if (this.breadcrumbs.length > 50) {
      this.breadcrumbs.shift();
    }
  }

  public async captureException(
    error: unknown,
    context?: SentryContext
  ): Promise<string | null> {
    if (!this.isEnabled || !this.parsedDsn) {
      return null;
    }

    const eventId = crypto.randomUUID().replace(/-/g, '');
    const err = error instanceof Error ? error : new Error(String(error));

    const rawEvent: SentryEvent = {
      event_id: eventId,
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      level: 'error',
      logger: 'jansetu.api',
      environment: this.environment,
      release: this.release,
      server_name: this.serverName,
      exception: {
        values: [
          {
            type: err.name || 'Error',
            value: err.message || 'Unknown error',
          },
        ],
      },
      user: context?.user,
      request: context?.request,
      extra: context?.extra,
      tags: context?.tags,
      breadcrumbs: [...this.breadcrumbs],
    };

    const finalEvent = this.beforeSend(rawEvent);
    if (!finalEvent) {
      return null;
    }

    return await this.sendEvent(finalEvent);
  }

  public async captureMessage(
    message: string,
    level: SentryEvent['level'] = 'info',
    context?: SentryContext
  ): Promise<string | null> {
    if (!this.isEnabled || !this.parsedDsn) {
      return null;
    }

    const eventId = crypto.randomUUID().replace(/-/g, '');
    const rawEvent: SentryEvent = {
      event_id: eventId,
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      level,
      logger: 'jansetu.api',
      environment: this.environment,
      release: this.release,
      server_name: this.serverName,
      message: {
        formatted: message,
      },
      user: context?.user,
      request: context?.request,
      extra: context?.extra,
      tags: context?.tags,
      breadcrumbs: [...this.breadcrumbs],
    };

    const finalEvent = this.beforeSend(rawEvent);
    if (!finalEvent) {
      return null;
    }

    return await this.sendEvent(finalEvent);
  }

  private async sendEvent(event: SentryEvent): Promise<string | null> {
    if (!this.parsedDsn) return null;

    try {
      const authHeader = `Sentry sentry_version=7, sentry_client=jansetu-api/1.0.0, sentry_key=${this.parsedDsn.publicKey}`;
      const res = await fetch(this.parsedDsn.storeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': authHeader,
        },
        body: JSON.stringify(event),
      });

      if (!res.ok) {
        return null;
      }
      return event.event_id;
    } catch {
      // Sentry send failures must never crash the application
      return null;
    }
  }
}

let activeSentryClient: SentryClient | null = null;

export function initSentry(options?: SentryInitOptions): SentryClient {
  const dsn = options?.dsn ?? process.env.SENTRY_DSN;
  activeSentryClient = new SentryClient({
    ...options,
    dsn,
  });
  return activeSentryClient;
}

export function getSentry(): SentryClient {
  if (!activeSentryClient) {
    activeSentryClient = new SentryClient({
      dsn: process.env.SENTRY_DSN,
    });
  }
  return activeSentryClient;
}
