import type {
  ComplaintClassification,
  DraftRtiInput,
  RtiDraftResult,
  HazardVerificationResult,
} from './types.js';
import {
  ComplaintClassificationSchema,
  RtiDraftResultSchema,
  HazardVerificationResultSchema,
  AI_DEPARTMENT_CODES,
} from './types.js';
import { COMPLAINT_CATEGORIES, URGENCY_LEVELS } from '@jansetu/shared';

export interface GeminiProviderOptions {
  readonly apiKey?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly fetchFn?: typeof fetch;
}

export class GeminiProvider {
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: GeminiProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.model = options.model || 'gemini-2.5-flash';
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async classifyComplaint(
    text: string,
    lang: 'en' | 'hi' | 'auto' = 'auto'
  ): Promise<ComplaintClassification> {
    if (!this.apiKey) {
      throw new Error('gemini_api_key_missing');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    const prompt = `You are the Civic Grievance Triage AI for JanSetu Multiverse (Government of NCT of Delhi / NCR).
Classify the following citizen complaint text into strict structured JSON.
Allowed departmentCode: ${JSON.stringify(AI_DEPARTMENT_CODES)}
Allowed category: ${JSON.stringify(COMPLAINT_CATEGORIES)}
Allowed urgency: ${JSON.stringify(URGENCY_LEVELS)}

Complaint text:
"""${text}"""

Citizen language preference: "${lang}"

Respond with ONLY valid JSON with keys:
- departmentCode: exact code from allowed list (e.g. ELEC, PWD, SAN, DJB, SEW, DISCOM, HEALTH, HORT, TRAFFIC, DPCC, POLICE, REV, VET, BLDG, FIRE, ADMIN)
- category: exact category from allowed list
- urgency: exact urgency (LOW, MEDIUM, HIGH, CRITICAL)
- summaryEn: concise single-sentence grievance summary in English
- summaryHi: concise single-sentence grievance summary in Hindi (Devanagari)
- confidence: float between 0.0 and 1.0 (e.g. 0.95)`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    try {
      const response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`gemini_http_${response.status}`);
      }

      const json = await response.json() as Record<string, unknown>;
      const candidates = json['candidates'] as Array<{
        content?: { parts?: Array<{ text?: string }> };
      }> | undefined;

      const rawText = candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('gemini_invalid_json');
      }

      const parsed = JSON.parse(rawText) as unknown;
      return ComplaintClassificationSchema.parse(parsed);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        throw new Error(`gemini_timeout_${this.timeoutMs}ms`);
      }
      if (err instanceof Error) {
        if (err.name === 'AbortError' || err.message.includes('abort') || err.message.includes('timeout')) {
          throw new Error(`gemini_timeout_${this.timeoutMs}ms`);
        }
        if (err.message.startsWith('gemini_')) {
          throw err;
        }
      }
      throw new Error(`gemini_schema_validation_failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async draftRtiSection6(input: DraftRtiInput): Promise<RtiDraftResult> {
    if (!this.apiKey) {
      throw new Error('gemini_api_key_missing');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    const isBpl = Boolean(input.isBplExempt || (input.bplCardNo && input.bplCardNo.trim().length > 0));

    const prompt = `You are a Senior Legal Officer specializing in Section 6(1) of the Right to Information Act, 2005.
Draft authentic statutory RTI applications in both English (Form 'A') and Hindi (प्रपत्र 'क') based on the citizen input:
- Applicant Name: ${input.applicantName}
- Father / Spouse: ${input.fatherOrSpouseName || 'N/A'}
- Address: ${input.address}
- Contact: ${input.contactNumber}
- Email: ${input.email || 'N/A'}
- Public Authority: ${input.authorityName}
- Authority Address: ${input.publicAuthorityAddress || 'Municipal Administrative Headquarters'}
- Subject: ${input.subject}
- Description: ${input.description}
- Specific Questions: ${JSON.stringify(input.specificQuestions || [])}
- BPL Exempt: ${isBpl ? 'YES' : 'NO'}
- Preferred Language: ${input.preferredLanguage}

Respond with ONLY valid JSON with keys:
- subject: string
- authorityName: string
- language: "en" or "hi" matching preferred language
- statutoryText: full legal text in preferred language
- questions: array of formulated statutory RTI questions
- isBplExempt: boolean
- englishDraft: complete Form 'A' statutory text in English
- hindiDraft: complete प्रपत्र 'क' statutory text in Hindi`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    try {
      const response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`gemini_http_${response.status}`);
      }

      const json = await response.json() as Record<string, unknown>;
      const candidates = json['candidates'] as Array<{
        content?: { parts?: Array<{ text?: string }> };
      }> | undefined;

      const rawText = candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('gemini_invalid_json');
      }

      const parsed = JSON.parse(rawText) as unknown;
      return RtiDraftResultSchema.parse(parsed);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        throw new Error(`gemini_timeout_${this.timeoutMs}ms`);
      }
      if (err instanceof Error) {
        if (err.name === 'AbortError' || err.message.includes('abort') || err.message.includes('timeout')) {
          throw new Error(`gemini_timeout_${this.timeoutMs}ms`);
        }
        if (err.message.startsWith('gemini_')) {
          throw err;
        }
      }
      throw new Error(`gemini_schema_validation_failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async verifyHazardImage(
    imageBytes: Uint8Array,
    mimeType: string,
    claimedCategory?: string
  ): Promise<HazardVerificationResult> {
    if (!this.apiKey) {
      throw new Error('gemini_api_key_missing');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    const base64Data =
      typeof Buffer !== 'undefined'
        ? Buffer.from(imageBytes).toString('base64')
        : btoa(
            Array.from(imageBytes)
              .map((b) => String.fromCharCode(b))
              .join('')
          );

    const prompt = `You are the Municipal Hazard Vision AI for JanSetu Multiverse (Government of NCT of Delhi / NCR).
Analyze this citizen-submitted photograph. The citizen claimed the category: "${claimedCategory || 'Unspecified'}".
Verify if this image depicts a genuine civic or infrastructure issue (e.g., potholes, road damage, open manholes, sewer overflow, street light defects, fallen electric wires, garbage piles, water supply leaks, broken public facilities, fire hazard, etc.).

Respond with ONLY valid JSON with keys:
- isCivicIssue: boolean (true if an actual civic/municipal problem is visible, false if irrelevant, indoor selfie, animal photo, meme, or unrelated)
- detectedHazard: concise name of the hazard detected in English (e.g. "Severe Pothole Cluster", "Live Wire Hanging", "Overflowing Garbage Dump", "None")
- severityBoost: one of ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"] based on visible hazard severity
- confidence: float between 0.0 and 1.0
- labels: array of visual tags detected (e.g. ["pothole", "asphalt", "cracked_road"])`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    try {
      const response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`gemini_http_${response.status}`);
      }

      const json = (await response.json()) as Record<string, unknown>;
      const candidates = json['candidates'] as
        | Array<{ content?: { parts?: Array<{ text?: string }> } }>
        | undefined;

      const rawText = candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('gemini_invalid_json');
      }

      const parsed = JSON.parse(rawText) as unknown;
      return HazardVerificationResultSchema.parse(parsed);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        throw new Error(`gemini_timeout_${this.timeoutMs}ms`);
      }
      if (err instanceof Error) {
        if (
          err.name === 'AbortError' ||
          err.message.includes('abort') ||
          err.message.includes('timeout')
        ) {
          throw new Error(`gemini_timeout_${this.timeoutMs}ms`);
        }
        if (err.message.startsWith('gemini_')) {
          throw err;
        }
      }
      throw new Error(
        `gemini_vision_failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
