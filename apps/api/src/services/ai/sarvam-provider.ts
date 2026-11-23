import type { AudioTranscriptionResult } from './types.js';
import { AudioTranscriptionResultSchema } from './types.js';

export interface SarvamProviderOptions {
  readonly apiKey?: string;
  readonly timeoutMs?: number;
  readonly fetchFn?: typeof fetch;
}

export class SarvamProvider {
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: SarvamProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async transcribeAudio(
    audioBytes: Uint8Array,
    mimeType: string,
    langHint?: string
  ): Promise<AudioTranscriptionResult> {
    if (!this.apiKey) {
      throw new Error('sarvam_api_key_missing');
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
    formData.append('model', 'saarika:v2');
    formData.append('language_code', langHint && langHint !== 'auto' ? langHint : 'hi-IN');

    try {
      // 1. Speech-to-Text
      const sttResponse = await this.fetchFn('https://api.sarvam.ai/speech-to-text', {
        method: 'POST',
        headers: {
          'api-subscription-key': this.apiKey,
        },
        body: formData,
        signal: controller.signal,
      });

      if (!sttResponse.ok) {
        throw new Error(`sarvam_http_${sttResponse.status}`);
      }

      const sttJson = (await sttResponse.json()) as Record<string, unknown>;
      const transcript = typeof sttJson['transcript'] === 'string' ? sttJson['transcript'].trim() : '';

      if (!transcript) {
        throw new Error('sarvam_empty_transcript');
      }

      const rawLang = typeof sttJson['language_code'] === 'string' ? sttJson['language_code'] : 'hi-IN';
      const isHindi = rawLang.startsWith('hi') || /[\u0900-\u097F]/.test(transcript);
      const detectedLang = isHindi ? 'hi' : rawLang.startsWith('en') ? 'en' : rawLang;

      let translatedEn = transcript;
      let translatedHi = transcript;

      // 2. Dual-language translation via Sarvam Translate API
      if (isHindi) {
        translatedHi = transcript;
        try {
          const transRes = await this.fetchFn('https://api.sarvam.ai/translate', {
            method: 'POST',
            headers: {
              'api-subscription-key': this.apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              input: transcript,
              source_language_code: 'hi-IN',
              target_language_code: 'en-IN',
              model: 'mayura:v1',
            }),
            signal: controller.signal,
          });

          if (transRes.ok) {
            const transJson = (await transRes.json()) as Record<string, unknown>;
            if (typeof transJson['translated_text'] === 'string' && transJson['translated_text'].trim()) {
              translatedEn = transJson['translated_text'].trim();
            }
          }
        } catch {
          // Translation fallback
        }
      } else {
        translatedEn = transcript;
        try {
          const transRes = await this.fetchFn('https://api.sarvam.ai/translate', {
            method: 'POST',
            headers: {
              'api-subscription-key': this.apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              input: transcript,
              source_language_code: 'en-IN',
              target_language_code: 'hi-IN',
              model: 'mayura:v1',
            }),
            signal: controller.signal,
          });

          if (transRes.ok) {
            const transJson = (await transRes.json()) as Record<string, unknown>;
            if (typeof transJson['translated_text'] === 'string' && transJson['translated_text'].trim()) {
              translatedHi = transJson['translated_text'].trim();
            }
          }
        } catch {
          // Translation fallback
        }
      }

      const result: AudioTranscriptionResult = {
        transcript,
        detectedLang,
        translatedEn,
        translatedHi,
        provider: 'sarvam',
      };

      return AudioTranscriptionResultSchema.parse(result);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        throw new Error(`sarvam_timeout_${this.timeoutMs}ms`);
      }
      if (err instanceof Error) {
        if (err.name === 'AbortError' || err.message.includes('abort') || err.message.includes('timeout')) {
          throw new Error(`sarvam_timeout_${this.timeoutMs}ms`);
        }
        if (err.message.startsWith('sarvam_')) {
          throw err;
        }
      }
      throw new Error(`sarvam_error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
