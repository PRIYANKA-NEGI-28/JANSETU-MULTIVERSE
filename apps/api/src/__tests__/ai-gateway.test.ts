import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AiGateway,
  resetAiGateway,
  type AiLogEvent,
  ComplaintClassificationSchema,
  RtiDraftResultSchema,
  AudioTranscriptionResultSchema,
  HazardVerificationResultSchema,
  classifyComplaintDeterministic,
  draftRtiSection6Deterministic,
  verifyHazardImage,
} from '../services/ai/index.js';
import { createApp } from '../app.js';
import { getInMemoryLimiter } from '../middleware/rate-limiter.js';
import { getStorageService } from '../services/storage.js';

describe('AI Gateway — 3-Tier Multi-Provider Resilience', () => {
  const loggedEvents: AiLogEvent[] = [];

  beforeEach(() => {
    loggedEvents.length = 0;
    resetAiGateway();
    getInMemoryLimiter().reset();
  });

  afterEach(() => {
    resetAiGateway();
    vi.restoreAllMocks();
  });

  it('Tier 1 Success: Primary Gemini 2.5 Flash succeeds with structured JSON', async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  departmentCode: 'ELEC',
                  category: 'Street Light',
                  urgency: 'HIGH',
                  summaryEn: 'Defective street light causing safety hazards at night.',
                  summaryHi: 'स्ट्रीट लाइट खराब होने के कारण रात में सुरक्षा संबंधी परेशानी।',
                  confidence: 0.96,
                }),
              },
            ],
          },
        },
      ],
    };

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(JSON.stringify(mockGeminiResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const gateway = new AiGateway({
      geminiApiKey: 'test-gemini-key',
      groqApiKey: 'test-groq-key',
      timeoutMs: 8000,
      fetchFn: mockFetch as unknown as typeof fetch,
      onLog: (e) => loggedEvents.push(e),
    });

    const meta = await gateway.classifyComplaintWithMeta(
      'Streetlight is dead and it is pitch dark on the main corner',
      'en'
    );

    expect(meta.provider).toBe('gemini');
    expect(meta.data.departmentCode).toBe('ELEC');
    expect(meta.data.category).toBe('Street Light');
    expect(meta.data.urgency).toBe('HIGH');
    expect(meta.data.confidence).toBe(0.96);
    expect(meta.latencyMs).toBeGreaterThanOrEqual(0);
    expect(meta.fallbackReason).toBeUndefined();

    // Verify Zod schema compliance
    expect(() => ComplaintClassificationSchema.parse(meta.data)).not.toThrow();

    // Check logged telemetry
    expect(loggedEvents.length).toBe(1);
    expect(loggedEvents[0]?.provider).toBe('gemini');
    expect(loggedEvents[0]?.success).toBe(true);
    expect(loggedEvents[0]?.capability).toBe('classify_complaint');
  });

  it('Tier 2 Fallback: Primary Gemini times out → Secondary Groq API succeeds', async () => {
    const mockGroqResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              departmentCode: 'PWD',
              category: 'Road Damage',
              urgency: 'CRITICAL',
              summaryEn: 'Deep pothole on arterial road causing vehicle damage and accidents.',
              summaryHi: 'मुख्य सड़क पर गहरा गड्ढा जिससे दुर्घटना की संभावना है।',
              confidence: 0.92,
            }),
          },
        },
      ],
    };

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('generativelanguage.googleapis.com')) {
        // Simulate Gemini taking longer than timeout and aborting
        return new Promise((_, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          }
        });
      }

      if (url.includes('api.groq.com')) {
        return new Response(JSON.stringify(mockGroqResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404 });
    });

    const gateway = new AiGateway({
      geminiApiKey: 'test-gemini-key',
      groqApiKey: 'test-groq-key',
      timeoutMs: 50, // Short timeout for rapid test
      fetchFn: mockFetch as unknown as typeof fetch,
      onLog: (e) => loggedEvents.push(e),
    });

    const meta = await gateway.classifyComplaintWithMeta(
      'Huge dangerous gaddha on road, an accident already took place',
      'en'
    );

    expect(meta.provider).toBe('groq');
    expect(meta.data.departmentCode).toBe('PWD');
    expect(meta.data.category).toBe('Road Damage');
    expect(meta.data.urgency).toBe('CRITICAL');
    expect(meta.fallbackReason).toContain('gemini_timeout_50ms');

    // Telemetry log verify
    expect(loggedEvents.length).toBe(1);
    expect(loggedEvents[0]?.provider).toBe('groq');
    expect(loggedEvents[0]?.level).toBe('warn');
    expect(loggedEvents[0]?.fallbackReason).toContain('gemini_timeout_50ms');
  });

  it('Tier 3 Guaranteed Fallback: Gemini & Groq both fail → Deterministic classifier NEVER fails', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response('Gemini Service Unavailable', { status: 503 });
      }
      if (url.includes('api.groq.com')) {
        return new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), {
          status: 429,
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const gateway = new AiGateway({
      geminiApiKey: 'test-gemini-key',
      groqApiKey: 'test-groq-key',
      timeoutMs: 100,
      fetchFn: mockFetch as unknown as typeof fetch,
      onLog: (e) => loggedEvents.push(e),
    });

    const meta = await gateway.classifyComplaintWithMeta(
      'सीवर का गंदा पानी सड़क पर बह रहा है और नाली पूरी तरह जाम है',
      'hi'
    );

    expect(meta.provider).toBe('deterministic');
    expect(meta.data.departmentCode).toBe('SEW');
    expect(meta.data.category).toBe('Sewage');
    expect(meta.data.urgency).toBe('CRITICAL');
    expect(meta.data.summaryHi).toContain('सीवर');
    expect(meta.data.summaryEn).toContain('Sewage');
    expect(meta.fallbackReason).toContain('gemini_http_503');
    expect(meta.fallbackReason).toContain('groq_http_429');

    // Guaranteed Zod schema validation
    expect(() => ComplaintClassificationSchema.parse(meta.data)).not.toThrow();

    // Verify error level logged for dual provider failure
    expect(loggedEvents.length).toBe(1);
    expect(loggedEvents[0]?.provider).toBe('deterministic');
    expect(loggedEvents[0]?.level).toBe('error');
  });

  it('Deterministic Fallback accurately classifies Hindi Devanagari and Romanized Hinglish', () => {
    // Test 1: Hindi Devanagari Street Light
    const res1 = classifyComplaintDeterministic(
      'गली में स्ट्रीट लाइट की बत्ती खराब है, रात में बहुत अंधेरा रहता है',
      'hi'
    );
    expect(res1.departmentCode).toBe('ELEC');
    expect(res1.category).toBe('Street Light');
    expect(res1.urgency).toBe('HIGH');
    expect(res1.summaryHi).toBeDefined();

    // Test 2: Hinglish Water Supply with Risk Escalation
    const res2 = classifyComplaintDeterministic(
      'Roz paani nahi aata, pipeline leak ho gayi hai aur accident ka khatra hai',
      'auto'
    );
    expect(res2.departmentCode).toBe('DJB');
    expect(res2.category).toBe('Water Supply');
    expect(res2.urgency).toBe('CRITICAL');

    // Test 3: Live Wire Critical Electricity Hazard
    const res3 = classifyComplaintDeterministic(
      'Live wire hanging loose near primary school, sparks coming and current risk',
      'en'
    );
    expect(res3.departmentCode).toBe('DISCOM');
    expect(res3.category).toBe('Electricity Hazard');
    expect(res3.urgency).toBe('CRITICAL');

    // Test 4: Waste Management / Sanitation
    const res4 = classifyComplaintDeterministic(
      'कचरा डिब्बा ओवरफ्लो है और कूड़ा सड़क पर फैला हुआ है सफाई कर्मचारी नहीं आते',
      'hi'
    );
    expect(res4.departmentCode).toBe('SAN');
    expect(res4.category).toBe('Waste Management');
  });

  it('Statutory RTI Section 6 Drafting with Gemini and Deterministic Legal Fallback', async () => {
    const input = {
      applicantName: 'Ramesh Kumar',
      fatherOrSpouseName: 'Late Sh. Satish Kumar',
      address: 'Flat 402, Pocket B, Mayur Vihar Phase 2, Delhi 110091',
      contactNumber: '+91-9811223344',
      email: 'ramesh.kumar@example.com',
      authorityName: 'Municipal Corporation of Delhi (MCD)',
      publicAuthorityAddress: 'Civic Centre, Minto Road, New Delhi',
      subject: 'Non-repair of arterial road and missing street lights in Ward 42',
      description: 'Grievance was lodged 60 days ago without any field inspection or status resolution.',
      specificQuestions: [
        'Certified copy of the road re-carpeting tender and contractor work order.',
        'Name and designation of the Junior Engineer responsible for Ward 42.',
      ],
      preferredLanguage: 'en' as const,
      isBplExempt: false,
    };

    // Test deterministic statutory Form A generator
    const deterministicDraft = draftRtiSection6Deterministic(input);
    expect(() => RtiDraftResultSchema.parse(deterministicDraft)).not.toThrow();
    expect(deterministicDraft.statutoryText).toContain("FORM 'A'");
    expect(deterministicDraft.statutoryText).toContain('SECTION 6(1)');
    expect(deterministicDraft.statutoryText).toContain('Ramesh Kumar');
    expect(deterministicDraft.statutoryText).toContain('Rs. 10/- paid');
    expect(deterministicDraft.hindiDraft).toContain("प्रपत्र 'क'");
    expect(deterministicDraft.questions.length).toBe(2);

    // Test BPL fee waiver
    const bplInput = {
      ...input,
      isBplExempt: true,
      bplCardNo: 'BPL-DL-2024-998877',
      preferredLanguage: 'hi' as const,
    };
    const bplDraft = draftRtiSection6Deterministic(bplInput);
    expect(bplDraft.statutoryText).toContain("प्रपत्र 'क'");
    expect(bplDraft.statutoryText).toContain('धारा 7(5) के तहत शुल्क मुक्त');
    expect(bplDraft.statutoryText).toContain('BPL-DL-2024-998877');
    expect(bplDraft.isBplExempt).toBe(true);
  });

  it('Strict Security and Privacy: Logging never exposes API keys, raw prompts, or citizen PII', async () => {
    const captured: AiLogEvent[] = [];
    const gateway = new AiGateway({
      geminiApiKey: 'secret-gemini-token-do-not-leak',
      groqApiKey: 'secret-groq-token-do-not-leak',
      onLog: (e) => captured.push(e),
    });

    await gateway.classifyComplaintWithMeta(
      'Secret citizen Aadhaar 9999-8888-7777 and phone 9876543210 reported water pipe burst',
      'en'
    );

    expect(captured.length).toBe(1);
    const event = captured[0];
    const serialized = JSON.stringify(event);

    expect(serialized).not.toContain('secret-gemini-token');
    expect(serialized).not.toContain('secret-groq-token');
    expect(serialized).not.toContain('9999-8888-7777');
    expect(serialized).not.toContain('9876543210');
    expect(serialized).not.toContain('Aadhaar');
  });

  it('HTTP API Routes: POST /api/v1/ai/classify and POST /api/v1/ai/rti-draft', async () => {
    const app = createApp();

    // 1. Classification endpoint test
    const classifyRes = await app.request('/api/v1/ai/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Street light kharab hai aur raat ko andhera rehta hai',
        lang: 'hi',
      }),
    });

    expect(classifyRes.status).toBe(200);
    const classifyJson = await classifyRes.json() as Record<string, unknown>;
    expect(classifyJson['success']).toBe(true);
    expect(classifyJson['provider']).toBeDefined();
    const classification = classifyJson['classification'] as Record<string, unknown>;
    expect(classification['departmentCode']).toBe('ELEC');
    expect(classification['category']).toBe('Street Light');

    // 2. RTI drafting endpoint test
    const rtiRes = await app.request('/api/v1/ai/rti-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicantName: 'Sunita Sharma',
        address: 'Sector 4, Rohini, Delhi',
        contactNumber: '9876543210',
        authorityName: 'Delhi Jal Board',
        subject: 'Disruption of daily drinking water supply',
        description: 'Water has not been supplied for 5 consecutive days despite multiple complaints.',
        preferredLanguage: 'hi',
      }),
    });

    expect(rtiRes.status).toBe(200);
    const rtiJson = await rtiRes.json() as Record<string, unknown>;
    expect(rtiJson['success']).toBe(true);
    const draft = rtiJson['draft'] as Record<string, unknown>;
    expect(draft['authorityName']).toBe('Delhi Jal Board');
    expect(draft['statutoryText']).toContain("प्रपत्र 'क'");
    expect(draft['language']).toBe('hi');
  });

  describe('Multilingual Audio Transcription (Sarvam AI & Groq Whisper Fallback)', () => {
    it('transcribes and translates audio successfully via Primary Sarvam AI', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('api.sarvam.ai/speech-to-text')) {
          return new Response(
            JSON.stringify({
              transcript: 'हमारे इलाके में तीन दिन से पानी नहीं आ रहा है',
              language_code: 'hi-IN',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('api.sarvam.ai/translate')) {
          return new Response(
            JSON.stringify({
              translated_text: 'Water has not been supplied in our locality for three days',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not Found', { status: 404 });
      });

      const gateway = new AiGateway({
        sarvamApiKey: 'test-sarvam-key',
        groqApiKey: 'test-groq-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        onLog: (e) => loggedEvents.push(e),
      });

      const audioDummy = new Uint8Array([0, 1, 2, 3, 4, 5]);
      const result = await gateway.transcribeAudio({
        audioBytes: audioDummy,
        mimeType: 'audio/wav',
        langHint: 'hi-IN',
      });

      expect(() => AudioTranscriptionResultSchema.parse(result)).not.toThrow();
      expect(result.provider).toBe('sarvam');
      expect(result.transcript).toBe('हमारे इलाके में तीन दिन से पानी नहीं आ रहा है');
      expect(result.detectedLang).toBe('hi');
      expect(result.translatedEn).toContain('Water has not been supplied');
      expect(result.translatedHi).toBe('हमारे इलाके में तीन दिन से पानी नहीं आ रहा है');

      expect(loggedEvents.length).toBe(1);
      expect(loggedEvents[0]?.capability).toBe('transcribe_audio');
      expect(loggedEvents[0]?.provider).toBe('sarvam');
    });

    it('falls back to Groq Whisper when Sarvam AI times out or errors', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('api.sarvam.ai')) {
          // Simulate Sarvam timeout abort
          return new Promise((_, reject) => {
            const signal = init?.signal;
            if (signal) {
              signal.addEventListener('abort', () => {
                const abortErr = new Error('The operation was aborted');
                abortErr.name = 'AbortError';
                reject(abortErr);
              });
            }
          });
        }
        if (url.includes('api.groq.com/openai/v1/audio/transcriptions')) {
          return new Response(
            JSON.stringify({
              text: 'Road pe bada gaddha hai accident ka khatra hai',
              language: 'hindi',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('api.groq.com/openai/v1/audio/translations')) {
          return new Response(
            JSON.stringify({
              text: 'There is a huge pothole on the road with risk of accidents',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not Found', { status: 404 });
      });

      const gateway = new AiGateway({
        sarvamApiKey: 'test-sarvam-key',
        groqApiKey: 'test-groq-key',
        timeoutMs: 50,
        fetchFn: mockFetch as unknown as typeof fetch,
        onLog: (e) => loggedEvents.push(e),
      });

      const audioDummy = new Uint8Array([10, 20, 30, 40]);
      const result = await gateway.transcribeAudio({
        audioBytes: audioDummy,
        mimeType: 'audio/webm',
      });

      expect(result.provider).toBe('groq');
      expect(result.transcript).toBe('Road pe bada gaddha hai accident ka khatra hai');
      expect(result.translatedEn).toContain('huge pothole');

      expect(loggedEvents.length).toBe(1);
      expect(loggedEvents[0]?.provider).toBe('groq');
      expect(loggedEvents[0]?.level).toBe('warn');
      expect(loggedEvents[0]?.fallbackReason).toContain('sarvam_timeout_50ms');
    });

    it('POST /api/v1/ai/transcribe rejects unauthenticated and oversized files', async () => {
      const app = createApp();

      // 1. Unauthenticated request rejected
      const unauthRes = await app.request('/api/v1/ai/transcribe', {
        method: 'POST',
      });
      expect(unauthRes.status).toBe(401);

      const authHeaders = {
        'x-test-user': JSON.stringify({
          id: 'citizen-audio-tester',
          name: 'Citizen Tester',
          role: 'citizen',
        }),
      };

      // 2. Oversized audio file (>10MB) rejected with 400
      const oversizedBlob = new Blob([new Uint8Array(11 * 1024 * 1024)], { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('file', oversizedBlob, 'large-audio.wav');

      const oversizedRes = await app.request('/api/v1/ai/transcribe', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });

      expect(oversizedRes.status).toBe(400);
      const errJson = (await oversizedRes.json()) as Record<string, unknown>;
      expect(errJson['detail']).toContain('exceeds 10MB limit');
    });

    it('POST /api/v1/ai/transcribe successfully processes stored R2 audio key', async () => {
      const app = createApp();
      const storage = getStorageService();
      const testAudioKey = 'audio/voice-note-99.wav';
      await storage.putObject(testAudioKey, new Uint8Array([1, 2, 3, 4]), 'audio/wav');

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('api.sarvam.ai/speech-to-text')) {
          return new Response(
            JSON.stringify({
              transcript: 'Electric wire spark kar raha hai',
              language_code: 'hi-IN',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('api.sarvam.ai/translate')) {
          return new Response(
            JSON.stringify({
              translated_text: 'Electric wire is sparking',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not Found', { status: 404 });
      });

      const gateway = new AiGateway({
        sarvamApiKey: 'test-sarvam-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });
      resetAiGateway();
      // Test with custom gateway
      const authHeaders = {
        'x-test-user': JSON.stringify({
          id: 'citizen-audio-tester',
          name: 'Citizen Tester',
          role: 'citizen',
        }),
      };

      // Set instance
      const { setAiGateway: installGateway } = await import('../services/ai/gateway.js');
      installGateway(gateway);

      const res = await app.request('/api/v1/ai/transcribe', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          r2Key: testAudioKey,
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as Record<string, unknown>;
      expect(json['transcript']).toBe('Electric wire spark kar raha hai');
      expect(json['provider']).toBe('sarvam');
      expect(json['translatedEn']).toBe('Electric wire is sparking');
    });
  });

  describe('Multimodal Hazard Image Verification (Gemini 2.5 Flash Vision & Graceful Degradation)', () => {
    it('verifies civic hazard image via Gemini 2.5 Flash multimodal vision', async () => {
      const mockVisionResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    isCivicIssue: true,
                    detectedHazard: 'Massive Road Pothole Cluster',
                    severityBoost: 'HIGH',
                    confidence: 0.94,
                    labels: ['pothole', 'broken_road', 'asphalt_crater', 'water_puddle'],
                  }),
                },
              ],
            },
          },
        ],
      };

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('generativelanguage.googleapis.com')) {
          return new Response(JSON.stringify(mockVisionResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('Not Found', { status: 404 });
      });

      const gateway = new AiGateway({
        geminiApiKey: 'test-gemini-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        onLog: (e) => loggedEvents.push(e),
      });

      const imageDummy = new Uint8Array([255, 216, 255, 224, 0, 16]); // JPEG header
      const result = await gateway.verifyHazardImage({
        imageBytes: imageDummy,
        mimeType: 'image/jpeg',
        claimedCategory: 'Road Damage',
      });

      expect(() => HazardVerificationResultSchema.parse(result)).not.toThrow();
      expect(result.isCivicIssue).toBe(true);
      expect(result.detectedHazard).toBe('Massive Road Pothole Cluster');
      expect(result.severityBoost).toBe('HIGH');
      expect(result.confidence).toBe(0.94);
      expect(result.labels).toContain('pothole');

      expect(loggedEvents.length).toBe(1);
      expect(loggedEvents[0]?.capability).toBe('verify_hazard');
      expect(loggedEvents[0]?.provider).toBe('gemini');
    });

    it('gracefully degrades on Gemini timeout or quota exhaustion without failing', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('generativelanguage.googleapis.com')) {
          // Simulate 429 Quota Exhaustion
          return new Response(
            JSON.stringify({ error: { code: 429, message: 'Resource has been exhausted (rate limit)' } }),
            { status: 429 }
          );
        }
        return new Response('Not Found', { status: 404 });
      });

      const gateway = new AiGateway({
        geminiApiKey: 'test-gemini-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        onLog: (e) => loggedEvents.push(e),
      });

      const imageDummy = new Uint8Array([1, 2, 3, 4]);
      // Must NOT throw! Must gracefully degrade
      const result = await gateway.verifyHazardImage({
        imageBytes: imageDummy,
        mimeType: 'image/png',
        claimedCategory: 'Sewage Overflow',
      });

      expect(result.isCivicIssue).toBe(true);
      expect(result.severityBoost).toBe('NONE');
      expect(result.confidence).toBe(0);
      expect(result.detectedHazard).toBe('Sewage Overflow');

      expect(loggedEvents.length).toBe(1);
      expect(loggedEvents[0]?.level).toBe('warn');
      expect(loggedEvents[0]?.fallbackReason).toContain('gemini_http_429');
    });

    it('gracefully degrades when R2 image key does not exist', async () => {
      const storage = getStorageService();
      storage.reset();

      const result = await verifyHazardImage('non-existent-photo.jpg', 'Street Light');
      expect(result.isCivicIssue).toBe(true);
      expect(result.severityBoost).toBe('NONE');
      expect(result.confidence).toBe(0);
    });

    it('POST /api/v1/ai/verify-hazard endpoint executes and returns verification result', async () => {
      const app = createApp();
      const storage = getStorageService();
      const testPhotoKey = 'photos/hazard-sample-1.jpg';
      await storage.putObject(testPhotoKey, new Uint8Array([255, 216, 255]), 'image/jpeg');

      const authHeaders = {
        'x-test-user': JSON.stringify({
          id: 'officer-vision-tester',
          name: 'JE Officer',
          role: 'ward_officer',
        }),
      };

      const res = await app.request('/api/v1/ai/verify-hazard', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          r2Key: testPhotoKey,
          claimedCategory: 'Road Damage',
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as Record<string, unknown>;
      expect(json['success']).toBe(true);
      const verification = json['verification'] as Record<string, unknown>;
      expect(verification['isCivicIssue']).toBe(true);
      expect(verification['severityBoost']).toBeDefined();
    });
  });
});
