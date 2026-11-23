import type { ValidatedEnv } from '../../config/env.js';
import type {
  ComplaintClassification,
  DraftRtiInput,
  RtiDraftResult,
  AiGatewayOptions,
  AiLogEvent,
  AiLogSink,
  ClassificationMetaResult,
  RtiDraftMetaResult,
  AudioTranscriptionResult,
  HazardVerificationResult,
} from './types.js';
import { GeminiProvider } from './gemini-provider.js';
import { GroqProvider } from './groq-provider.js';
import { SarvamProvider } from './sarvam-provider.js';
import { GroqWhisperProvider } from './groq-whisper-provider.js';
import {
  classifyComplaintDeterministic,
  draftRtiSection6Deterministic,
} from './deterministic.js';
import { getStorageService } from '../storage.js';

let defaultAiLogSink: AiLogSink = (event: AiLogEvent) => {
  const payload = JSON.stringify(event);
  if (event.level === 'error') {
    console.error(payload);
  } else if (event.level === 'warn') {
    console.warn(payload);
  } else {
    console.info(payload);
  }
};

export function setAiLogSink(sink: AiLogSink): void {
  defaultAiLogSink = sink;
}

export function resetAiLogSink(): void {
  defaultAiLogSink = (event: AiLogEvent) => {
    const payload = JSON.stringify(event);
    if (event.level === 'error') {
      console.error(payload);
    } else if (event.level === 'warn') {
      console.warn(payload);
    } else {
      console.info(payload);
    }
  };
}

export class AiGateway {
  private readonly gemini: GeminiProvider;
  private readonly groq: GroqProvider;
  private readonly sarvam: SarvamProvider;
  private readonly groqWhisper: GroqWhisperProvider;
  private readonly timeoutMs: number;
  private readonly onLog?: AiLogSink;

  constructor(options: AiGatewayOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.onLog = options.onLog;

    this.gemini = new GeminiProvider({
      apiKey: options.geminiApiKey,
      model: options.geminiModel,
      timeoutMs: this.timeoutMs,
      fetchFn: options.fetchFn,
    });

    this.groq = new GroqProvider({
      apiKey: options.groqApiKey,
      model: options.groqModel,
      timeoutMs: this.timeoutMs,
      fetchFn: options.fetchFn,
    });

    this.sarvam = new SarvamProvider({
      apiKey: options.sarvamApiKey,
      timeoutMs: this.timeoutMs,
      fetchFn: options.fetchFn,
    });

    this.groqWhisper = new GroqWhisperProvider({
      apiKey: options.groqApiKey,
      model: options.groqWhisperModel,
      timeoutMs: this.timeoutMs,
      fetchFn: options.fetchFn,
    });
  }

  private emitLog(event: AiLogEvent): void {
    if (this.onLog) {
      this.onLog(event);
    } else {
      defaultAiLogSink(event);
    }
  }

  async classifyComplaintWithMeta(
    text: string,
    lang: 'en' | 'hi' | 'auto' = 'auto'
  ): Promise<ClassificationMetaResult> {
    const startOverall = Date.now();
    let geminiFallbackReason: string | undefined;

    // 1. Primary: Google Gemini 2.5 Flash
    try {
      const startGemini = Date.now();
      const result = await this.gemini.classifyComplaint(text, lang);
      const latencyMs = Date.now() - startGemini;

      this.emitLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        event: 'ai_gateway_call',
        capability: 'classify_complaint',
        provider: 'gemini',
        latencyMs,
        success: true,
      });

      return {
        data: result,
        provider: 'gemini',
        latencyMs,
      };
    } catch (geminiErr: unknown) {
      geminiFallbackReason = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
    }

    let groqFallbackReason: string | undefined;

    // 2. Secondary Fallback: Groq API
    try {
      const startGroq = Date.now();
      const result = await this.groq.classifyComplaint(text, lang);
      const latencyMs = Date.now() - startGroq;

      this.emitLog({
        timestamp: new Date().toISOString(),
        level: 'warn',
        event: 'ai_gateway_call',
        capability: 'classify_complaint',
        provider: 'groq',
        latencyMs,
        success: true,
        fallbackReason: geminiFallbackReason,
      });

      return {
        data: result,
        provider: 'groq',
        latencyMs,
        fallbackReason: geminiFallbackReason,
      };
    } catch (groqErr: unknown) {
      groqFallbackReason = groqErr instanceof Error ? groqErr.message : String(groqErr);
    }

    // 3. Guaranteed Tertiary Fallback: Deterministic Rule Classifier
    const startDeterministic = Date.now();
    const result = classifyComplaintDeterministic(text, lang);
    const latencyMs = Date.now() - startDeterministic;
    const combinedFallbackReason = `Primary failed (${geminiFallbackReason}); Secondary failed (${groqFallbackReason})`;

    this.emitLog({
      timestamp: new Date().toISOString(),
      level: 'error',
      event: 'ai_gateway_call',
      capability: 'classify_complaint',
      provider: 'deterministic',
      latencyMs: Date.now() - startOverall,
      success: true,
      fallbackReason: combinedFallbackReason,
    });

    return {
      data: result,
      provider: 'deterministic',
      latencyMs,
      fallbackReason: combinedFallbackReason,
    };
  }

  async classifyComplaint(
    text: string,
    lang: 'en' | 'hi' | 'auto' = 'auto'
  ): Promise<ComplaintClassification> {
    const meta = await this.classifyComplaintWithMeta(text, lang);
    return meta.data;
  }

  async draftRtiSection6WithMeta(input: DraftRtiInput): Promise<RtiDraftMetaResult> {
    const startOverall = Date.now();
    let geminiFallbackReason: string | undefined;

    // 1. Primary: Google Gemini 2.5 Flash
    try {
      const startGemini = Date.now();
      const result = await this.gemini.draftRtiSection6(input);
      const latencyMs = Date.now() - startGemini;

      this.emitLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        event: 'ai_gateway_call',
        capability: 'draft_rti',
        provider: 'gemini',
        latencyMs,
        success: true,
      });

      return {
        data: result,
        provider: 'gemini',
        latencyMs,
      };
    } catch (geminiErr: unknown) {
      geminiFallbackReason = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
    }

    let groqFallbackReason: string | undefined;

    // 2. Secondary Fallback: Groq API
    try {
      const startGroq = Date.now();
      const result = await this.groq.draftRtiSection6(input);
      const latencyMs = Date.now() - startGroq;

      this.emitLog({
        timestamp: new Date().toISOString(),
        level: 'warn',
        event: 'ai_gateway_call',
        capability: 'draft_rti',
        provider: 'groq',
        latencyMs,
        success: true,
        fallbackReason: geminiFallbackReason,
      });

      return {
        data: result,
        provider: 'groq',
        latencyMs,
        fallbackReason: geminiFallbackReason,
      };
    } catch (groqErr: unknown) {
      groqFallbackReason = groqErr instanceof Error ? groqErr.message : String(groqErr);
    }

    // 3. Guaranteed Tertiary Fallback: Deterministic Legal Serializer
    const startDeterministic = Date.now();
    const result = draftRtiSection6Deterministic(input);
    const latencyMs = Date.now() - startDeterministic;
    const combinedFallbackReason = `Primary failed (${geminiFallbackReason}); Secondary failed (${groqFallbackReason})`;

    this.emitLog({
      timestamp: new Date().toISOString(),
      level: 'error',
      event: 'ai_gateway_call',
      capability: 'draft_rti',
      provider: 'deterministic',
      latencyMs: Date.now() - startOverall,
      success: true,
      fallbackReason: combinedFallbackReason,
    });

    return {
      data: result,
      provider: 'deterministic',
      latencyMs,
      fallbackReason: combinedFallbackReason,
    };
  }

  async draftRtiSection6(input: DraftRtiInput): Promise<RtiDraftResult> {
    const meta = await this.draftRtiSection6WithMeta(input);
    return meta.data;
  }

  async transcribeAudio(params: {
    audioBytes: Uint8Array;
    mimeType: string;
    langHint?: string;
  }): Promise<AudioTranscriptionResult> {
    const startOverall = Date.now();
    let sarvamFallbackReason: string | undefined;

    // 1. Primary: Sarvam AI Speech-to-Text + Translation
    try {
      const startSarvam = Date.now();
      const result = await this.sarvam.transcribeAudio(
        params.audioBytes,
        params.mimeType,
        params.langHint
      );
      const latencyMs = Date.now() - startSarvam;

      this.emitLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        event: 'ai_gateway_call',
        capability: 'transcribe_audio',
        provider: 'sarvam',
        latencyMs,
        success: true,
      });

      return result;
    } catch (sarvamErr: unknown) {
      sarvamFallbackReason =
        sarvamErr instanceof Error ? sarvamErr.message : String(sarvamErr);
    }

    // 2. Secondary Fallback: Groq Whisper
    try {
      const startGroq = Date.now();
      const result = await this.groqWhisper.transcribeAudio(
        params.audioBytes,
        params.mimeType,
        params.langHint
      );
      const latencyMs = Date.now() - startGroq;

      this.emitLog({
        timestamp: new Date().toISOString(),
        level: 'warn',
        event: 'ai_gateway_call',
        capability: 'transcribe_audio',
        provider: 'groq',
        latencyMs,
        success: true,
        fallbackReason: sarvamFallbackReason,
      });

      return result;
    } catch (groqErr: unknown) {
      const groqReason =
        groqErr instanceof Error ? groqErr.message : String(groqErr);
      const combinedReason = `Sarvam failed (${sarvamFallbackReason}); Groq Whisper failed (${groqReason})`;

      this.emitLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'ai_gateway_call',
        capability: 'transcribe_audio',
        provider: 'groq',
        latencyMs: Date.now() - startOverall,
        success: false,
        fallbackReason: combinedReason,
      });

      throw new Error(`Audio transcription failed: ${combinedReason}`);
    }
  }

  async verifyHazardImage(
    r2KeyOrParams:
      | string
      | {
          r2Key?: string;
          imageBytes?: Uint8Array;
          mimeType?: string;
          claimedCategory?: string;
        },
    claimedCategory?: string,
    env?: ValidatedEnv,
    r2Bucket?: R2Bucket
  ): Promise<HazardVerificationResult> {
    const startOverall = Date.now();
    let r2Key: string | undefined;
    let imageBytes: Uint8Array | undefined;
    let mimeType = 'image/jpeg';
    let category = claimedCategory;

    if (typeof r2KeyOrParams === 'string') {
      r2Key = r2KeyOrParams;
    } else {
      r2Key = r2KeyOrParams.r2Key;
      imageBytes = r2KeyOrParams.imageBytes;
      if (r2KeyOrParams.mimeType) mimeType = r2KeyOrParams.mimeType;
      if (r2KeyOrParams.claimedCategory) category = r2KeyOrParams.claimedCategory;
    }

    const gracefulFallback: HazardVerificationResult = {
      isCivicIssue: true,
      detectedHazard: category || 'Civic Infrastructure Hazard',
      severityBoost: 'NONE',
      confidence: 0,
      labels: [],
    };

    if (!imageBytes && r2Key) {
      const storage = getStorageService();
      const obj = await storage.getObject(r2Key, env, r2Bucket);
      if (!obj) {
        this.emitLog({
          timestamp: new Date().toISOString(),
          level: 'warn',
          event: 'ai_gateway_call',
          capability: 'verify_hazard',
          provider: 'deterministic',
          latencyMs: Date.now() - startOverall,
          success: true,
          fallbackReason: `r2_image_not_found: ${r2Key}`,
        });
        return gracefulFallback;
      }
      imageBytes = obj.data;
      if (obj.contentType) {
        mimeType = obj.contentType;
      }
    }

    if (!imageBytes) {
      return gracefulFallback;
    }

    try {
      const startGemini = Date.now();
      const result = await this.gemini.verifyHazardImage(imageBytes, mimeType, category);
      const latencyMs = Date.now() - startGemini;

      this.emitLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        event: 'ai_gateway_call',
        capability: 'verify_hazard',
        provider: 'gemini',
        latencyMs,
        success: true,
      });

      return result;
    } catch (err: unknown) {
      const fallbackReason = err instanceof Error ? err.message : String(err);
      this.emitLog({
        timestamp: new Date().toISOString(),
        level: 'warn',
        event: 'ai_gateway_call',
        capability: 'verify_hazard',
        provider: 'deterministic',
        latencyMs: Date.now() - startOverall,
        success: true,
        fallbackReason,
      });

      return gracefulFallback;
    }
  }
}

export async function verifyHazardImage(
  r2Key: string,
  claimedCategory?: string,
  env?: ValidatedEnv,
  r2Bucket?: R2Bucket
): Promise<HazardVerificationResult> {
  const gateway = getAiGateway(env);
  return gateway.verifyHazardImage(r2Key, claimedCategory, env, r2Bucket);
}

let gatewayInstance: AiGateway | null = null;

export function getAiGateway(
  env?: ValidatedEnv,
  overrides?: Partial<AiGatewayOptions>
): AiGateway {
  if (overrides || !gatewayInstance) {
    const instance = new AiGateway({
      geminiApiKey: overrides?.geminiApiKey ?? env?.GEMINI_API_KEY,
      geminiModel: overrides?.geminiModel ?? env?.GEMINI_MODEL,
      groqApiKey: overrides?.groqApiKey ?? env?.GROQ_API_KEY,
      groqModel: overrides?.groqModel ?? env?.GROQ_MODEL,
      groqWhisperModel: overrides?.groqWhisperModel ?? env?.GROQ_WHISPER_MODEL,
      sarvamApiKey: overrides?.sarvamApiKey ?? env?.SARVAM_API_KEY,
      timeoutMs: overrides?.timeoutMs ?? env?.AI_TIMEOUT_MS ?? 8000,
      onLog: overrides?.onLog,
      fetchFn: overrides?.fetchFn,
    });
    if (!overrides) {
      gatewayInstance = instance;
    }
    return instance;
  }
  return gatewayInstance;
}

export function setAiGateway(gateway: AiGateway): void {
  gatewayInstance = gateway;
}

export function resetAiGateway(): void {
  gatewayInstance = null;
}
