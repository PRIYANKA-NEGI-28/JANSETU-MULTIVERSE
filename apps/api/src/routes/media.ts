import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types/index.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error-handler.js';
import {
  getStorageService,
  validateMediaMimeAndSize,
  type AllowedMediaMimeType,
} from '../services/storage.js';

export const mediaRoute = new Hono<AppEnv>();

const PresignPayloadSchema = z.object({
  filename: z.string().trim().min(1, 'filename is required'),
  mimeType: z.string().trim().min(1, 'mimeType is required'),
  sizeBytes: z.number().int().positive('sizeBytes must be a positive integer'),
});

mediaRoute.post('/presign', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const validated = PresignPayloadSchema.parse(body);

  const check = validateMediaMimeAndSize(validated.mimeType, validated.sizeBytes);
  if (!check.valid) {
    throw new HttpError(400, 'Invalid Media Payload', check.message || 'MIME type or size limit violated');
  }

  const storage = getStorageService();
  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const result = await storage.generatePresignedUploadUrl(
    {
      filename: validated.filename,
      mimeType: validated.mimeType as AllowedMediaMimeType,
      sizeBytes: validated.sizeBytes,
    },
    baseUrl,
    c.get('env')
  );

  return c.json(result, 200);
});

// Direct upload fallback endpoint (for local / test / fallback presigned URLs)
mediaRoute.put('/upload/:key{.*}', async (c) => {
  const key = c.req.param('key');
  if (!key) {
    throw new HttpError(400, 'Bad Request', 'Object key is required');
  }

  const expiresQuery = c.req.query('expires');
  if (expiresQuery) {
    const expiresTimestamp = parseInt(expiresQuery, 10);
    if (!isNaN(expiresTimestamp) && Date.now() > expiresTimestamp) {
      throw new HttpError(400, 'Expired Presigned URL', 'The presigned upload URL has expired');
    }
  }

  const contentType = c.req.header('content-type') || c.req.query('mime') || 'application/octet-stream';
  const arrayBuffer = await c.req.arrayBuffer();

  if (arrayBuffer.byteLength === 0) {
    throw new HttpError(400, 'Empty Payload', 'Uploaded file body cannot be empty');
  }

  const storage = getStorageService();
  const r2Bucket = c.env?.MEDIA_BUCKET;
  const result = await storage.putObject(key, arrayBuffer, contentType, c.get('env'), r2Bucket);

  return c.json(result, 200);
});

// Object retrieval endpoint
mediaRoute.get('/:key{.*}', async (c) => {
  const key = c.req.param('key');
  if (!key) {
    throw new HttpError(400, 'Bad Request', 'Media key is required');
  }

  const storage = getStorageService();
  const r2Bucket = c.env?.MEDIA_BUCKET;
  const object = await storage.getObject(key, c.get('env'), r2Bucket);

  if (!object) {
    throw new HttpError(404, 'Not Found', `Media object '${key}' not found`);
  }

  // Handle conditional ETag caching
  const clientEtag = c.req.header('if-none-match');
  if (clientEtag && clientEtag === object.etag) {
    return c.body(null, 304);
  }

  return new Response(object.data.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': object.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': object.etag,
      'Content-Length': object.size.toString(),
    },
  });
});
