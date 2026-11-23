import type { ErrorHandler, NotFoundHandler } from 'hono';
import { z } from 'zod';
import type { AppEnv, RfcProblemDetails } from '../types/index.js';
import { getSentry } from '../lib/sentry.js';

export class HttpError extends Error {
  readonly status: number;
  readonly title: string;
  readonly type: string;
  readonly detail: string;
  readonly errors?: readonly Record<string, unknown>[];

  constructor(
    status: number,
    title: string,
    detail: string,
    type?: string,
    errors?: readonly Record<string, unknown>[]
  ) {
    super(detail);
    this.name = 'HttpError';
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.type = type ?? `https://jansetu.gov.in/errors/${status}`;
    this.errors = errors;
  }
}

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) => {
  const requestId = c.get('requestId') || c.req.header('x-request-id') || crypto.randomUUID();
  const problem: RfcProblemDetails = {
    type: 'https://jansetu.gov.in/errors/404',
    title: 'Not Found',
    status: 404,
    detail: `Cannot ${c.req.method} ${c.req.path}`,
    instance: c.req.path,
    requestId,
    timestamp: new Date().toISOString(),
  };

  return c.json(problem, 404, {
    'Content-Type': 'application/problem+json',
    'X-Request-ID': requestId,
  });
};

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const env = c.get('env');
  const isProd = env ? env.NODE_ENV === 'production' : process.env.NODE_ENV === 'production';
  const requestId = c.get('requestId') || c.req.header('x-request-id') || crypto.randomUUID();

  let status = 500;
  let title = 'Internal Server Error';
  let detail = isProd ? 'An unexpected internal server error occurred' : err.message;
  let type = 'https://jansetu.gov.in/errors/500';
  let errors: readonly Record<string, unknown>[] | undefined;

  if (err instanceof HttpError) {
    status = err.status;
    title = err.title;
    detail = err.detail;
    type = err.type;
    errors = err.errors;
  } else if (err instanceof z.ZodError) {
    status = 400;
    title = 'Bad Request';
    detail = 'Validation failed for request parameters';
    type = 'https://jansetu.gov.in/errors/validation-error';
    errors = err.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
  }

  // Capture unhandled 5xx exceptions in Sentry with automatic PII scrubbing
  if (status >= 500) {
    const sentry = getSentry();
    void sentry.captureException(err, {
      request: {
        url: c.req.url,
        method: c.req.method,
      },
      extra: {
        requestId,
        path: c.req.path,
        status,
      },
      user: c.get('user')
        ? {
            id: c.get('user')?.id,
            role: c.get('user')?.role,
          }
        : undefined,
    });
  }

  const problem: RfcProblemDetails = {
    type,
    title,
    status,
    detail,
    instance: c.req.path,
    requestId,
    timestamp: new Date().toISOString(),
    ...(errors ? { errors } : {}),
    ...(!isProd && err.stack ? { stack: err.stack } : {}),
  };

  // Status code cast is needed because Hono c.json expects ContentfulStatusCode
  return c.json(problem, (status >= 400 && status <= 599 ? status : 500) as 500, {
    'Content-Type': 'application/problem+json',
    'X-Request-ID': requestId,
  });
};
