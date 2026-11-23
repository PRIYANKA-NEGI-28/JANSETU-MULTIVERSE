import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { getStorageService, MAX_IMAGE_SIZE_BYTES, MAX_AUDIO_SIZE_BYTES } from '../services/storage.js';
import type { PresignResult } from '../services/storage.js';
import type { RfcProblemDetails } from '../types/index.js';

describe('Media Storage Service & Endpoints (Cloudflare R2)', () => {
  const app = createApp();
  const storage = getStorageService();

  const citizenAuthHeader = {
    'x-test-user': JSON.stringify({
      id: 'citizen-media-test-1',
      name: 'Rohan Sharma',
      email: 'rohan.sharma@example.com',
      role: 'citizen',
    }),
  };

  beforeEach(() => {
    storage.reset();
  });

  describe('POST /api/v1/media/presign - Presigned Upload URLs', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await app.request('/api/v1/media/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'pothole.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1024 * 1024,
        }),
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as RfcProblemDetails;
      expect(json.status).toBe(401);
      expect(json.title).toBe('Unauthorized');
    });

    it('rejects unsupported MIME types with 400 Bad Request', async () => {
      const unsupportedMimes = [
        'application/pdf',
        'image/gif',
        'video/mp4',
        'text/plain',
        'application/zip',
      ];

      for (const mimeType of unsupportedMimes) {
        const res = await app.request('/api/v1/media/presign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...citizenAuthHeader,
          },
          body: JSON.stringify({
            filename: 'document.pdf',
            mimeType,
            sizeBytes: 500 * 1024,
          }),
        });

        expect(res.status).toBe(400);
        const json = (await res.json()) as RfcProblemDetails;
        expect(json.title).toBe('Invalid Media Payload');
        expect(json.detail).toContain('Invalid MIME type');
      }
    });

    it('rejects image files exceeding 5MB max size limit', async () => {
      const res = await app.request('/api/v1/media/presign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...citizenAuthHeader,
        },
        body: JSON.stringify({
          filename: 'huge-pothole.png',
          mimeType: 'image/png',
          sizeBytes: MAX_IMAGE_SIZE_BYTES + 1, // 5MB + 1 byte
        }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as RfcProblemDetails;
      expect(json.status).toBe(400);
      expect(json.detail).toContain('exceeds maximum limit of 5MB');
    });

    it('rejects audio files exceeding 10MB max size limit', async () => {
      const res = await app.request('/api/v1/media/presign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...citizenAuthHeader,
        },
        body: JSON.stringify({
          filename: 'long-recording.mp4',
          mimeType: 'audio/mp4',
          sizeBytes: MAX_AUDIO_SIZE_BYTES + 1024,
        }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as RfcProblemDetails;
      expect(json.status).toBe(400);
      expect(json.detail).toContain('exceeds maximum limit of 10MB');
    });

    it('generates presigned upload URL for valid image payload (image/jpeg, 2MB)', async () => {
      const res = await app.request('/api/v1/media/presign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...citizenAuthHeader,
        },
        body: JSON.stringify({
          filename: 'street-light-fault.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 2 * 1024 * 1024,
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as PresignResult;

      expect(json.key).toMatch(/^media\/[a-f0-9-]+-street-light-fault\.jpg$/);
      expect(json.uploadUrl).toContain(json.key);
      expect(json.publicUrl).toContain(`/api/v1/media/${json.key}`);
      expect(json.mimeType).toBe('image/jpeg');
      expect(json.sizeBytes).toBe(2 * 1024 * 1024);
      expect(json.expiresInSeconds).toBe(900);
    });

    it('generates presigned upload URL for valid audio payload (audio/webm, 4MB)', async () => {
      const res = await app.request('/api/v1/media/presign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...citizenAuthHeader,
        },
        body: JSON.stringify({
          filename: 'voice-note.webm',
          mimeType: 'audio/webm',
          sizeBytes: 4 * 1024 * 1024,
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as PresignResult;

      expect(json.key).toMatch(/^media\/[a-f0-9-]+-voice-note\.webm$/);
      expect(json.mimeType).toBe('audio/webm');
    });
  });

  describe('Direct Upload & Media Retrieval (GET /api/v1/media/:key)', () => {
    it('stores file via upload URL and serves it with cache headers', async () => {
      // 1. Get presigned URL
      const presignRes = await app.request('/api/v1/media/presign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...citizenAuthHeader,
        },
        body: JSON.stringify({
          filename: 'water-leak.webp',
          mimeType: 'image/webp',
          sizeBytes: 512,
        }),
      });
      const presign = (await presignRes.json()) as PresignResult;

      // 2. Upload sample binary data
      const sampleData = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x01, 0x02, 0x03]);
      const uploadRes = await app.request(presign.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/webp',
        },
        body: sampleData,
      });
      expect(uploadRes.status).toBe(200);

      // 3. Retrieve object via GET
      const getRes = await app.request(`/api/v1/media/${presign.key}`, {
        method: 'GET',
      });
      expect(getRes.status).toBe(200);
      expect(getRes.headers.get('Content-Type')).toBe('image/webp');
      expect(getRes.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
      expect(getRes.headers.get('ETag')).toBeDefined();

      const retrievedBytes = new Uint8Array(await getRes.arrayBuffer());
      expect(retrievedBytes).toEqual(sampleData);

      // 4. Test conditional ETag cache (304 Not Modified)
      const etag = getRes.headers.get('ETag')!;
      const cachedRes = await app.request(`/api/v1/media/${presign.key}`, {
        method: 'GET',
        headers: {
          'If-None-Match': etag,
        },
      });
      expect(cachedRes.status).toBe(304);
    });

    it('rejects uploads with invalid magic bytes or spoofed headers with 400 Bad Request', async () => {
      // Arbitrary binary that is not an allowed image or audio format
      const invalidData = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44]);
      const res = await app.request('/api/v1/media/upload/malicious-file.bin', {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: invalidData,
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as RfcProblemDetails;
      expect(json.title).toBe('Invalid Media Signature');
    });

    it('rejects uploads with MIME type mismatch against binary signature', async () => {
      // JPEG header (FF D8 FF) sent with PNG Content-Type
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const res = await app.request('/api/v1/media/upload/mismatched.png', {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: jpegBytes,
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as RfcProblemDetails;
      expect(json.title).toBe('Invalid Media Signature');
    });

    it('returns 404 Problem Details when object key does not exist', async () => {
      const res = await app.request('/api/v1/media/media/non-existent-uuid.png', {
        method: 'GET',
      });
      expect(res.status).toBe(404);
      const json = (await res.json()) as RfcProblemDetails;
      expect(json.status).toBe(404);
      expect(json.title).toBe('Not Found');
    });
  });

  describe('Mocked Cloudflare R2 Bucket Integration', () => {
    it('interacts transparently with mocked R2Bucket instance', async () => {
      const mockStorageMap = new Map<string, { body: Uint8Array; contentType: string }>();

      const mockR2Bucket = {
        put: async (key: string, body: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }) => {
          const bytes = body instanceof ArrayBuffer ? new Uint8Array(body) : body;
          mockStorageMap.set(key, {
            body: bytes,
            contentType: options?.httpMetadata?.contentType || 'application/octet-stream',
          });
          return {} as R2Object;
        },
        get: async (key: string) => {
          const item = mockStorageMap.get(key);
          if (!item) return null;
          return {
            key,
            size: item.body.byteLength,
            etag: 'r2-etag-test-1234',
            httpEtag: '"r2-etag-test-1234"',
            uploaded: new Date(),
            httpMetadata: { contentType: item.contentType },
            arrayBuffer: async () => item.body.buffer,
          } as unknown as R2ObjectBody;
        },
        delete: async (key: string) => {
          mockStorageMap.delete(key);
        },
      } as unknown as R2Bucket;

      const testKey = 'test-r2/node-telemetry.png';
      const testBytes = new Uint8Array([10, 20, 30, 40]);

      // Put to R2
      const putResult = await storage.putObject(testKey, testBytes, 'image/png', undefined, mockR2Bucket);
      expect(putResult.key).toBe(testKey);
      expect(mockStorageMap.has(testKey)).toBe(true);

      // Get from R2
      const fetched = await storage.getObject(testKey, undefined, mockR2Bucket);
      expect(fetched).not.toBeNull();
      expect(fetched?.contentType).toBe('image/png');
      expect(fetched?.data).toEqual(testBytes);

      // Delete from R2
      await storage.deleteObject(testKey, undefined, mockR2Bucket);
      expect(mockStorageMap.has(testKey)).toBe(false);
    });
  });
});
