import type {
  ComplaintClassification,
  DraftRtiInput,
  RtiDraftResult,
} from './types.js';
import {
  ComplaintClassificationSchema,
  RtiDraftResultSchema,
  AI_DEPARTMENT_CODES,
} from './types.js';
import { COMPLAINT_CATEGORIES, URGENCY_LEVELS } from '@jansetu/shared';

export interface GroqProviderOptions {
  readonly apiKey?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly fetchFn?: typeof fetch;
}

export class GroqProvider {
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: GroqProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.model = options.model || 'llama-3.3-70b-versatile';
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async classifyComplaint(
    text: string,
    lang: 'en' | 'hi' | 'auto' = 'auto'
  ): Promise<ComplaintClassification> {
    if (!this.apiKey) {
      throw new Error('groq_api_key_missing');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    const systemPrompt = `You are a Civic Grievance Triage AI for JanSetu Multiverse (Government of NCT of Delhi / NCR).
Classify the citizen complaint text into strict structured JSON.
Allowed departmentCode: ${JSON.stringify(AI_DEPARTMENT_CODES)}
Allowed category: ${JSON.stringify(COMPLAINT_CATEGORIES)}
Allowed urgency: ${JSON.stringify(URGENCY_LEVELS)}

Respond with ONLY valid JSON with keys:
- departmentCode: exact code from allowed list
- category: exact category from allowed list
- urgency: exact urgency (LOW, MEDIUM, HIGH, CRITICAL)
- summaryEn: concise single-sentence grievance summary in English
- summaryHi: concise single-sentence grievance summary in Hindi (Devanagari)
- confidence: float between 0.0 and 1.0`;

    const userPrompt = `Complaint text: "${text}"\nLanguage preference: "${lang}"`;

    const url = 'https://api.groq.com/openai/v1/chat/completions';

    try {
      const response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`groq_http_${response.status}`);
      }

      const json = await response.json() as Record<string, unknown>;
      const choices = json['choices'] as Array<{
        message?: { content?: string };
      }> | undefined;

      const rawText = choices?.[0]?.message?.content;
      if (!rawText) {
        throw new Error('groq_invalid_json');
      }

      const parsed = JSON.parse(rawText) as unknown;
      return ComplaintClassificationSchema.parse(parsed);
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
      throw new Error(`groq_schema_validation_failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async draftRtiSection6(input: DraftRtiInput): Promise<RtiDraftResult> {
    if (!this.apiKey) {
      throw new Error('groq_api_key_missing');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    const isBpl = Boolean(input.isBplExempt || (input.bplCardNo && input.bplCardNo.trim().length > 0));

    const systemPrompt = `You are a Senior Legal Officer drafting statutory RTI applications compliant with Section 6(1) of the Right to Information Act, 2005.
Respond with ONLY valid JSON with keys:
- subject: string
- authorityName: string
- language: "en" or "hi"
- statutoryText: complete statutory draft text in preferred language
- questions: array of discrete legal RTI inquiry strings
- isBplExempt: boolean
- englishDraft: complete Form 'A' statutory text in English
- hindiDraft: complete प्रपत्र 'क' statutory text in Hindi`;

    const userPrompt = `Applicant: ${input.applicantName}
Father/Spouse: ${input.fatherOrSpouseName || 'N/A'}
Address: ${input.address}
Contact: ${input.contactNumber}
Email: ${input.email || 'N/A'}
Authority: ${input.authorityName}
Authority Address: ${input.publicAuthorityAddress || 'Municipal Administrative Headquarters'}
Subject: ${input.subject}
Description: ${input.description}
Questions: ${JSON.stringify(input.specificQuestions || [])}
BPL: ${isBpl ? 'YES' : 'NO'}
Preferred Language: ${input.preferredLanguage}`;

    const url = 'https://api.groq.com/openai/v1/chat/completions';

    try {
      const response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`groq_http_${response.status}`);
      }

      const json = await response.json() as Record<string, unknown>;
      const choices = json['choices'] as Array<{
        message?: { content?: string };
      }> | undefined;

      const rawText = choices?.[0]?.message?.content;
      if (!rawText) {
        throw new Error('groq_invalid_json');
      }

      const parsed = JSON.parse(rawText) as unknown;
      return RtiDraftResultSchema.parse(parsed);
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
      throw new Error(`groq_schema_validation_failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
