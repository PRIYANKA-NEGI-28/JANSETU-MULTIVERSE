import type { AudioTranscriptionResult } from './types.js';
import { AudioTranscriptionResultSchema } from './types.js';

export interface GroqWhisperProviderOptions {
  readonly apiKey?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly fetchFn?: typeof fetch;
}

export class GroqWhisperProvider {
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: GroqWhisperProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.model = options.model || 'whisper-large-v3-turbo';
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async transcribeAudio(
    audioBytes: Uint8Array,
    mimeType: string,
    langHint?: string
  ): Promise<AudioTranscriptionResult> {
    if (!this.apiKey) {
      throw new Error('groq_api_key_missing');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    const ext = mimeType.includes('mp4')
      ? 'mp4'
      : mimeType.includes('webm')
        ? 'webm'
        : mimeType.includes('ogg')
          ? 'ogg'
          : 'wav';

    const formData = new FormData();
    const blob = new Blob([audioBytes.buffer as ArrayBuffer], { type: mimeType });
    formData.append('file', blob, `audio.${ext}`);
    formData.append('model', this.model);
    formData.append('response_format', 'verbose_json');
    if (langHint && langHint !== 'auto') {
      const cleanLang = langHint.split('-')[0] ?? 'hi';
      formData.append('language', cleanLang);
    }

    try {
      // 1. Groq Whisper Transcription
      const sttResponse = await this.fetchFn('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
        signal: controller.signal,
      });

      if (!sttResponse.ok) {
        throw new Error(`groq_http_${sttResponse.status}`);
      }

      const sttJson = (await sttResponse.json()) as Record<string, unknown>;
      const transcript = typeof sttJson['text'] === 'string' ? sttJson['text'].trim() : '';

      if (!transcript) {
        throw new Error('groq_empty_transcript');
      }

      const rawLang = typeof sttJson['language'] === 'string' ? sttJson['language'] : 'hindi';
      const isHindi = rawLang.toLowerCase().includes('hi') || /[\u0900-\u097F]/.test(transcript);
      const detectedLang = isHindi ? 'hi' : 'en';

      let translatedEn = transcript;
      let translatedHi = transcript;

      // 2. Dual-language translation: Groq Audio Translations endpoint provides native English translation
      if (isHindi) {
        translatedHi = transcript;
        try {
          const transFormData = new FormData();
          const transBlob = new Blob([audioBytes.buffer as ArrayBuffer], { type: mimeType });
          transFormData.append('file', transBlob, `audio.${ext}`);
          transFormData.append('model', this.model);

          const transResponse = await this.fetchFn('https://api.groq.com/openai/v1/audio/translations', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
            body: transFormData,
            signal: controller.signal,
          });

          if (transResponse.ok) {
            const transJson = (await transResponse.json()) as Record<string, unknown>;
            if (typeof transJson['text'] === 'string' && transJson['text'].trim()) {
              translatedEn = transJson['text'].trim();
            }
          }
        } catch {
          // Translation fallback
        }
      } else {
        translatedEn = transcript;
      }

      const result: AudioTranscriptionResult = {
        transcript,
        detectedLang,
        translatedEn,
        translatedHi,
        provider: 'groq',
      };

      return AudioTranscriptionResultSchema.parse(result);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        throw new Error(`groq_timeout_${this.timeoutMs}ms`);
      }
      if (err instanceof Error) {
        if (err.name === 'AbortError' || err.message.includes('abort') || err.message.includes('timeout')) {
          throw new Error(`groq_timeout_${this.timeoutMs}ms`);
        }
        if (err.message.startsWith('groq_')) {
          throw err;
        }
      }
      throw new Error(`groq_whisper_error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
