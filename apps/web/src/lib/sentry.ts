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

export interface SentryEvent {
  readonly event_id: string;
  readonly timestamp: string;
  readonly platform: string;
  readonly level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  readonly logger?: string;
  readonly environment?: string;
  readonly release?: string;
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
  readonly extra?: Readonly<Record<string, unknown>>;
  readonly tags?: Readonly<Record<string, string>>;
  readonly breadcrumbs?: readonly SentryBreadcrumb[];
}

export interface SentryInitOptions {
  readonly dsn?: string | null;
  readonly environment?: string;
  readonly release?: string;
  readonly beforeSend?: (event: SentryEvent) => SentryEvent | null;
}

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const PHONE_INDIA_REGEX = /(?:(?:\+91|0)[\s-]?)?[6-9]\d{9}\b/g;
const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g;
const BEARER_TOKEN_REGEX = /Bearer\s+([A-Za-z0-9_.-]+)/gi;

export function scrubPiiText(input: string): string {
  if (!input || typeof input !== 'string') return input;
  return input
    .replace(BEARER_TOKEN_REGEX, 'Bearer [REDACTED_TOKEN]')
    .replace(EMAIL_REGEX, '[REDACTED_EMAIL]')
    .replace(PHONE_INDIA_REGEX, '[REDACTED_PHONE]')
    .replace(AADHAAR_REGEX, '[REDACTED_AADHAAR]')
    .replace(PAN_REGEX, '[REDACTED_PAN]');
}

export function scrubPiiObject<T>(val: T): T {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') return scrubPiiText(val) as unknown as T;
  if (Array.isArray(val)) return val.map((item) => scrubPiiObject(item)) as unknown as T;
  if (typeof val === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      if (
        lower === 'authorization' ||
        lower === 'cookie' ||
        lower === 'token' ||
        lower === 'secret' ||
        lower === 'password'
      ) {
        clean[k] = '[REDACTED]';
      } else if (
        lower === 'exactlocation' ||
        lower === 'exact_location' ||
        lower === 'latitude' ||
        lower === 'longitude'
      ) {
        clean[k] = '[REDACTED_COORDINATES]';
      } else {
        clean[k] = scrubPiiObject(v);
      }
    }
    return clean as T;
  }
  return val;
}

export function defaultBeforeSend(event: SentryEvent): SentryEvent {
  return {
    ...event,
    message: event.message
      ? { formatted: scrubPiiText(event.message.formatted) }
      : undefined,
    exception: event.exception
      ? {
          values: event.exception.values.map((v) => ({
            ...v,
            value: scrubPiiText(v.value),
          })),
        }
      : undefined,
    user: event.user
      ? {
          id: event.user.id,
          role: event.user.role,
          ip_address: null,
        }
      : undefined,
    extra: event.extra ? scrubPiiObject(event.extra) : undefined,
    breadcrumbs: event.breadcrumbs?.map((b) => ({
      ...b,
      message: b.message ? scrubPiiText(b.message) : undefined,
      data: b.data ? scrubPiiObject(b.data) : undefined,
    })),
  };
}

export class WebSentryClient {
  public readonly isEnabled: boolean;
  private readonly storeUrl: string | null = null;
  private readonly publicKey: string | null = null;
  private readonly environment: string;
  private readonly release: string;
  private readonly beforeSend: (event: SentryEvent) => SentryEvent | null;
  private readonly breadcrumbs: SentryBreadcrumb[] = [];

  constructor(options: SentryInitOptions = {}) {
    const dsn = options.dsn?.trim();
    if (dsn) {
      try {
        const url = new URL(dsn);
        this.publicKey = url.username;
        const host = url.host;
        const pathParts = url.pathname.split('/').filter(Boolean);
        const projectId = pathParts[pathParts.length - 1];
        if (this.publicKey && host && projectId) {
          this.storeUrl = `${url.protocol}//${host}/api/${projectId}/store/`;
        }
      } catch {
        // invalid DSN
      }
    }

    this.isEnabled = this.storeUrl !== null && this.publicKey !== null;
    this.environment = options.environment || 'production';
    this.release = options.release || 'jansetu-web@1.0.0';
    this.beforeSend = options.beforeSend || defaultBeforeSend;
  }

  public addBreadcrumb(breadcrumb: SentryBreadcrumb): void {
    if (!this.isEnabled) return;
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: breadcrumb.timestamp || Date.now() / 1000,
    });
    if (this.breadcrumbs.length > 30) this.breadcrumbs.shift();
  }

  public async captureException(
    error: unknown,
    context?: { extra?: Record<string, unknown>; tags?: Record<string, string>; user?: SentryUser }
  ): Promise<string | null> {
    if (!this.isEnabled || !this.storeUrl || !this.publicKey) return null;

    const eventId = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/-/g, '');
    const err = error instanceof Error ? error : new Error(String(error));

    const rawEvent: SentryEvent = {
      event_id: eventId,
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      level: 'error',
      logger: 'jansetu.web',
      environment: this.environment,
      release: this.release,
      exception: {
        values: [
          {
            type: err.name || 'Error',
            value: err.message || 'Unknown error',
          },
        ],
      },
      user: context?.user,
      extra: context?.extra,
      tags: context?.tags,
      breadcrumbs: [...this.breadcrumbs],
    };

    const finalEvent = this.beforeSend(rawEvent);
    if (!finalEvent) return null;

    try {
      const authHeader = `Sentry sentry_version=7, sentry_client=jansetu-web/1.0.0, sentry_key=${this.publicKey}`;
      const res = await fetch(this.storeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': authHeader,
        },
        body: JSON.stringify(finalEvent),
      });
      return res.ok ? eventId : null;
    } catch {
      return null;
    }
  }

  public async captureMessage(
    message: string,
    level: SentryEvent['level'] = 'info',
    context?: { extra?: Record<string, unknown>; tags?: Record<string, string> }
  ): Promise<string | null> {
    if (!this.isEnabled || !this.storeUrl || !this.publicKey) return null;

    const eventId = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/-/g, '');
    const rawEvent: SentryEvent = {
      event_id: eventId,
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      level,
      logger: 'jansetu.web',
      environment: this.environment,
      release: this.release,
      message: { formatted: message },
      extra: context?.extra,
      tags: context?.tags,
      breadcrumbs: [...this.breadcrumbs],
    };

    const finalEvent = this.beforeSend(rawEvent);
    if (!finalEvent) return null;

    try {
      const authHeader = `Sentry sentry_version=7, sentry_client=jansetu-web/1.0.0, sentry_key=${this.publicKey}`;
      const res = await fetch(this.storeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': authHeader,
        },
        body: JSON.stringify(finalEvent),
      });
      return res.ok ? eventId : null;
    } catch {
      return null;
    }
  }
}

let activeWebSentry: WebSentryClient | null = null;

export function initWebSentry(options?: SentryInitOptions): WebSentryClient {
  const dsn =
    options?.dsn ??
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SENTRY_DSN
      ? import.meta.env.VITE_SENTRY_DSN
      : undefined);

  activeWebSentry = new WebSentryClient({
    ...options,
    dsn,
  });

  if (activeWebSentry.isEnabled && typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      void activeWebSentry?.captureException(event.error || event.message);
    });
    window.addEventListener('unhandledrejection', (event) => {
      void activeWebSentry?.captureException(event.reason);
    });
  }

  return activeWebSentry;
}

export function getWebSentry(): WebSentryClient {
  if (!activeWebSentry) {
    activeWebSentry = initWebSentry();
  }
  return activeWebSentry;
}
