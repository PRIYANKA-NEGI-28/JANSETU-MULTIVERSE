import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ValidatedEnv } from '../config/env.js';

export const ALLOWED_MEDIA_MIME_TYPES = [
  'image/webp',
  'image/jpeg',
  'image/png',
  'audio/webm',
  'audio/mp4',
  'audio/wav',
] as const;

export type AllowedMediaMimeType = (typeof ALLOWED_MEDIA_MIME_TYPES)[number];

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB (5,242,880 bytes)
export const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024; // 10MB (10,485,760 bytes)

export interface MediaValidationResult {
  readonly valid: boolean;
  readonly message?: string;
}

export function validateMediaMimeAndSize(
  mimeType: string,
  sizeBytes: number
): MediaValidationResult {
  if (!ALLOWED_MEDIA_MIME_TYPES.includes(mimeType as AllowedMediaMimeType)) {
    return {
      valid: false,
      message: `Invalid MIME type '${mimeType}'. Supported types: ${ALLOWED_MEDIA_MIME_TYPES.join(', ')}`,
    };
  }

  if (mimeType.startsWith('image/')) {
    if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
      return {
        valid: false,
        message: `Image size (${sizeBytes} bytes) exceeds maximum limit of 5MB (${MAX_IMAGE_SIZE_BYTES} bytes)`,
      };
    }
  } else if (mimeType.startsWith('audio/')) {
    if (sizeBytes > MAX_AUDIO_SIZE_BYTES) {
      return {
        valid: false,
        message: `Audio size (${sizeBytes} bytes) exceeds maximum limit of 10MB (${MAX_AUDIO_SIZE_BYTES} bytes)`,
      };
    }
  }

  return { valid: true };
}

export function validateMagicBytes(
  input: ArrayBuffer | Uint8Array,
  declaredMimeType?: string
): MediaValidationResult {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 4) {
    return {
      valid: false,
      message: 'File size is too small to contain valid media headers',
    };
  }

  let detectedType: AllowedMediaMimeType | null = null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    detectedType = 'image/jpeg';
  }
  // PNG: 89 50 4E 47 (\x89PNG)
  else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    detectedType = 'image/png';
  }
  // RIFF container: bytes 0..3 are 'RIFF' (0x52, 0x49, 0x46, 0x46)
  else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    if (bytes.length >= 12) {
      if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
        detectedType = 'image/webp';
      } else if (bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
        detectedType = 'audio/wav';
      } else {
        detectedType = declaredMimeType === 'audio/wav' ? 'audio/wav' : 'image/webp';
      }
    } else {
      detectedType = declaredMimeType === 'audio/wav' ? 'audio/wav' : 'image/webp';
    }
  }
  // WebM / EBML: 1A 45 DF A3
  else if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    detectedType = 'audio/webm';
  }
  // MP4 / M4A: ftyp at bytes 4..7 (0x66, 0x74, 0x79, 0x70)
  else if (
    bytes.length >= 8 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    detectedType = 'audio/mp4';
  }

  if (!detectedType) {
    return {
      valid: false,
      message: 'File binary header does not match any accepted civic media signature (JPEG, PNG, WebP, WebM, WAV, MP4)',
    };
  }

  if (declaredMimeType && declaredMimeType !== 'application/octet-stream' && detectedType !== declaredMimeType) {
    return {
      valid: false,
      message: `File binary signature (${detectedType}) does not match declared Content-Type (${declaredMimeType})`,
    };
  }

  return { valid: true };
}

export interface PresignUploadOptions {
  readonly filename: string;
  readonly mimeType: AllowedMediaMimeType;
  readonly sizeBytes: number;
  readonly prefix?: string;
  readonly expiresInSeconds?: number;
}

export interface PresignResult {
  readonly key: string;
  readonly uploadUrl: string;
  readonly publicUrl: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly expiresInSeconds: number;
}

export interface StoredMediaObject {
  readonly key: string;
  readonly data: Uint8Array;
  readonly contentType: string;
  readonly size: number;
  readonly etag: string;
  readonly uploadedAt: Date;
}

export class StorageService {
  private inMemoryObjects = new Map<string, StoredMediaObject>();

  async generatePresignedUploadUrl(
    options: PresignUploadOptions,
    baseUrl: string,
    env?: ValidatedEnv
  ): Promise<PresignResult> {
    const prefix = options.prefix ?? 'media';
    const cleanFilename = options.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${prefix}/${crypto.randomUUID()}-${cleanFilename}`;
    const expiresInSeconds = options.expiresInSeconds ?? 900; // 15 minutes default

    // If Cloudflare R2 / S3 credentials are fully provided, use official AWS S3 presigner
    if (env?.R2_ACCOUNT_ID && env?.R2_ACCESS_KEY_ID && env?.R2_SECRET_ACCESS_KEY) {
      const s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        },
      });

      const putCommand = new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME || 'jansetu-media',
        Key: key,
        ContentType: options.mimeType,
        ContentLength: options.sizeBytes,
      });

      const uploadUrl = await getSignedUrl(s3Client, putCommand, {
        expiresIn: expiresInSeconds,
      });

      const publicUrl = env.R2_PUBLIC_URL
        ? `${env.R2_PUBLIC_URL.replace(/\/+$/, '')}/${key}`
        : `${baseUrl.replace(/\/+$/, '')}/api/v1/media/${key}`;

      return {
        key,
        uploadUrl,
        publicUrl,
        mimeType: options.mimeType,
        sizeBytes: options.sizeBytes,
        expiresInSeconds,
      };
    }

    // Local / Dev / Test fallback: generate API direct upload URL with timestamp signature
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const uploadUrl = `${baseUrl.replace(/\/+$/, '')}/api/v1/media/upload/${key}?expires=${expiresAt}&mime=${encodeURIComponent(options.mimeType)}`;
    const publicUrl = `${baseUrl.replace(/\/+$/, '')}/api/v1/media/${key}`;

    return {
      key,
      uploadUrl,
      publicUrl,
      mimeType: options.mimeType,
      sizeBytes: options.sizeBytes,
      expiresInSeconds,
    };
  }

  async putObject(
    key: string,
    data: Uint8Array | ArrayBuffer | string,
    contentType: string,
    _env?: ValidatedEnv,
    r2Bucket?: R2Bucket
  ): Promise<{ key: string; etag: string; size: number }> {
    const bytes = typeof data === 'string'
      ? new TextEncoder().encode(data)
      : data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : data;

    const etag = `"${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}"`;

    if (r2Bucket) {
      try {
        await r2Bucket.put(key, bytes, {
          httpMetadata: {
            contentType,
          },
        });
      } catch {
        // Fall back to in-memory store if R2 binding fails
      }
    }

    const stored: StoredMediaObject = {
      key,
      data: bytes,
      contentType,
      size: bytes.byteLength,
      etag,
      uploadedAt: new Date(),
    };

    this.inMemoryObjects.set(key, stored);

    return {
      key,
      etag,
      size: bytes.byteLength,
    };
  }

  async getObject(
    key: string,
    _env?: ValidatedEnv,
    r2Bucket?: R2Bucket
  ): Promise<StoredMediaObject | null> {
    if (r2Bucket) {
      try {
        const r2Object = await r2Bucket.get(key);
        if (r2Object) {
          const arrayBuf = await r2Object.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          const contentType = r2Object.httpMetadata?.contentType || 'application/octet-stream';
          const etag = r2Object.httpEtag || `"${r2Object.etag}"`;
          return {
            key,
            data: bytes,
            contentType,
            size: bytes.byteLength,
            etag,
            uploadedAt: r2Object.uploaded,
          };
        }
      } catch {
        // Fall back to in-memory map
      }
    }

    return this.inMemoryObjects.get(key) ?? null;
  }

  async deleteObject(
    key: string,
    _env?: ValidatedEnv,
    r2Bucket?: R2Bucket
  ): Promise<boolean> {
    if (r2Bucket) {
      try {
        await r2Bucket.delete(key);
      } catch {
        // Fallback
      }
    }

    return this.inMemoryObjects.delete(key);
  }

  reset(): void {
    this.inMemoryObjects.clear();
  }
}

let storageServiceInstance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = new StorageService();
  }
  return storageServiceInstance;
}
