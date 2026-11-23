import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types/index.js';
import { getAiGateway } from '../services/ai/gateway.js';
import { DraftRtiInputSchema } from '../services/ai/types.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error-handler.js';
import { MAX_AUDIO_SIZE_BYTES, getStorageService } from '../services/storage.js';

export const aiRoute = new Hono<AppEnv>();

const ClassifyPayloadSchema = z.object({
  text: z.string().trim().min(3, 'Complaint text must be at least 3 characters'),
  lang: z.enum(['en', 'hi', 'auto']).default('auto'),
});

const VerifyHazardPayloadSchema = z.object({
  r2Key: z.string().trim().min(1, 'r2Key is required'),
  claimedCategory: z.string().trim().optional(),
});

// POST /api/v1/ai/classify - Intelligent grievance classification & triage
aiRoute.post('/classify', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const validated = ClassifyPayloadSchema.parse(body);

  const env = c.get('env');
  const gateway = getAiGateway(env);
  const result = await gateway.classifyComplaintWithMeta(validated.text, validated.lang);

  return c.json(
    {
      success: true,
      classification: result.data,
      provider: result.provider,
      latencyMs: result.latencyMs,
      fallbackReason: result.fallbackReason ?? null,
    },
    200
  );
});

// POST /api/v1/ai/rti-draft - Intelligent Section 6(1) RTI statutory drafting
aiRoute.post('/rti-draft', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const validated = DraftRtiInputSchema.parse(body);

  const env = c.get('env');
  const gateway = getAiGateway(env);
  const result = await gateway.draftRtiSection6WithMeta(validated);

  return c.json(
    {
      success: true,
      draft: result.data,
      provider: result.provider,
      latencyMs: result.latencyMs,
      fallbackReason: result.fallbackReason ?? null,
    },
    200
  );
});

// POST /api/v1/ai/transcribe - Multilingual speech-to-text & translation (Sarvam -> Groq Whisper)
aiRoute.post('/transcribe', requireAuth, async (c) => {
  const env = c.get('env');
  const r2Bucket = c.env?.MEDIA_BUCKET;
  const contentType = c.req.header('content-type') || '';

  let audioBytes: Uint8Array | undefined;
  let mimeType = 'audio/wav';
  let langHint: string | undefined;

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData().catch(() => null);
    if (!formData) {
      throw new HttpError(400, 'Bad Request', 'Malformed multipart/form-data payload');
    }

    const file = (formData.get('file') ?? formData.get('audio')) as File | null;
    const r2Key = (formData.get('r2Key') ?? formData.get('audioKey')) as string | null;
    const lang = formData.get('language') ?? formData.get('lang');
    if (typeof lang === 'string') {
      langHint = lang;
    }

    if (file && typeof file === 'object' && typeof file.size === 'number') {
      if (file.size > MAX_AUDIO_SIZE_BYTES) {
        throw new HttpError(
          400,
          'Payload Too Large',
          `Audio file size (${file.size} bytes) exceeds 10MB limit (maximum 60 seconds)`
        );
      }
      if (file.type && !file.type.startsWith('audio/')) {
        throw new HttpError(
          400,
          'Unsupported Media Type',
          `Invalid audio format '${file.type}'. Allowed formats: audio/webm, audio/mp4, audio/wav, audio/mpeg, audio/ogg`
        );
      }
      mimeType = file.type || 'audio/wav';
      const arrayBuffer = await file.arrayBuffer();
      audioBytes = new Uint8Array(arrayBuffer);
    } else if (r2Key && typeof r2Key === 'string') {
      const storage = getStorageService();
      const obj = await storage.getObject(r2Key.trim(), env, r2Bucket);
      if (!obj) {
        throw new HttpError(404, 'Not Found', `Audio file not found in storage: '${r2Key}'`);
      }
      if (obj.data.byteLength > MAX_AUDIO_SIZE_BYTES) {
        throw new HttpError(
          400,
          'Payload Too Large',
          `Audio file size (${obj.data.byteLength} bytes) exceeds 10MB limit`
        );
      }
      audioBytes = obj.data;
      mimeType = obj.contentType || 'audio/wav';
    }
  } else {
    // JSON body with r2Key or audioKey
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const r2Key = (body['r2Key'] ?? body['audioKey']) as string | undefined;
    const lang = (body['language'] ?? body['lang']) as string | undefined;
    if (lang) {
      langHint = lang;
    }

    if (r2Key && typeof r2Key === 'string') {
      const storage = getStorageService();
      const obj = await storage.getObject(r2Key.trim(), env, r2Bucket);
      if (!obj) {
        throw new HttpError(404, 'Not Found', `Audio file not found in storage: '${r2Key}'`);
      }
      if (obj.data.byteLength > MAX_AUDIO_SIZE_BYTES) {
        throw new HttpError(
          400,
          'Payload Too Large',
          `Audio file size (${obj.data.byteLength} bytes) exceeds 10MB limit`
        );
      }
      audioBytes = obj.data;
      mimeType = obj.contentType || 'audio/wav';
    }
  }

  if (!audioBytes || audioBytes.length === 0) {
    throw new HttpError(
      400,
      'Bad Request',
      'Either audio file (multipart/form-data) or a valid r2Key is required'
    );
  }

  const gateway = getAiGateway(env);
  const result = await gateway.transcribeAudio({
    audioBytes,
    mimeType,
    langHint,
  });

  return c.json(result, 200);
});

// POST /api/v1/ai/verify-hazard - Multimodal hazard verification via Gemini 2.5 Flash vision
aiRoute.post('/verify-hazard', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const validated = VerifyHazardPayloadSchema.parse(body);

  const env = c.get('env');
  const r2Bucket = c.env?.MEDIA_BUCKET;
  const gateway = getAiGateway(env);

  const result = await gateway.verifyHazardImage(
    validated.r2Key,
    validated.claimedCategory,
    env,
    r2Bucket
  );

  return c.json(
    {
      success: true,
      verification: result,
    },
    200
  );
});
