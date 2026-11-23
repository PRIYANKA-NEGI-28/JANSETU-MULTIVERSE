import { z } from 'zod';
import { COMPLAINT_CATEGORIES, URGENCY_LEVELS } from '@jansetu/shared';

export const AI_DEPARTMENT_CODES = [
  'ELEC',
  'PWD',
  'SAN',
  'DJB',
  'SEW',
  'DISCOM',
  'HEALTH',
  'HORT',
  'TRAFFIC',
  'DPCC',
  'POLICE',
  'REV',
  'VET',
  'BLDG',
  'FIRE',
  'ADMIN',
] as const;

export type AiDepartmentCode = (typeof AI_DEPARTMENT_CODES)[number];

export const ComplaintClassificationSchema = z.object({
  departmentCode: z.string().min(1, 'departmentCode is required'),
  category: z.enum(COMPLAINT_CATEGORIES).or(z.string().min(1)),
  urgency: z.enum(URGENCY_LEVELS),
  summaryEn: z.string().min(1, 'summaryEn is required'),
  summaryHi: z.string().min(1, 'summaryHi is required'),
  confidence: z.number().min(0).max(1),
});

export type ComplaintClassification = z.infer<typeof ComplaintClassificationSchema>;

export interface DraftRtiInput {
  readonly applicantName?: string;
  readonly fatherOrSpouseName?: string;
  readonly address?: string;
  readonly contactNumber?: string;
  readonly email?: string;
  readonly bplCardNo?: string;
  readonly bplCardNumber?: string;
  readonly bplYear?: string;
  readonly authorityName: string;
  readonly publicAuthorityAddress?: string;
  readonly subject: string;
  readonly description?: string;
  readonly complaintDetails?: string;
  readonly specificQuestions?: readonly string[];
  readonly preferredLanguage?: 'en' | 'hi';
  readonly language?: 'en' | 'hi';
  readonly isBplExempt?: boolean;
  readonly clusterId?: string;
}

export const DraftRtiInputSchema = z
  .object({
    applicantName: z.string().trim().optional().default('Citizen Applicant'),
    fatherOrSpouseName: z.string().trim().optional(),
    address: z.string().trim().optional().default('Ward Area, Municipal Corporation'),
    contactNumber: z.string().trim().optional().default('+91 98765 43210'),
    email: z.string().trim().email().optional().or(z.literal('')),
    bplCardNo: z.string().trim().optional(),
    bplCardNumber: z.string().trim().optional(),
    bplYear: z.string().trim().optional(),
    authorityName: z.string().trim().min(1, 'Public authority name is required'),
    publicAuthorityAddress: z.string().trim().optional(),
    subject: z.string().trim().min(3, 'Subject is required'),
    description: z.string().trim().optional(),
    complaintDetails: z.string().trim().optional(),
    specificQuestions: z.array(z.string().trim().min(1)).optional().default([]),
    preferredLanguage: z.enum(['en', 'hi']).optional(),
    language: z.enum(['en', 'hi']).optional(),
    isBplExempt: z.boolean().optional().default(false),
    clusterId: z.string().trim().optional(),
  })
  .transform((data): DraftRtiInput => ({
    applicantName: data.applicantName || 'Citizen Applicant',
    fatherOrSpouseName: data.fatherOrSpouseName,
    address: data.address || 'Ward Area, Municipal Corporation',
    contactNumber: data.contactNumber || '+91 98765 43210',
    email: data.email,
    bplCardNo: data.bplCardNo ?? data.bplCardNumber,
    bplYear: data.bplYear,
    authorityName: data.authorityName,
    publicAuthorityAddress: data.publicAuthorityAddress,
    subject: data.subject,
    description: data.description ?? data.complaintDetails ?? data.subject,
    specificQuestions: data.specificQuestions ?? [],
    preferredLanguage: data.preferredLanguage ?? data.language ?? 'en',
    isBplExempt: data.isBplExempt ?? false,
    clusterId: data.clusterId,
  }));

export const RtiDraftResultSchema = z.object({
  subject: z.string().min(1),
  authorityName: z.string().min(1),
  language: z.enum(['en', 'hi']),
  statutoryText: z.string().min(1),
  questions: z.array(z.string().min(1)),
  isBplExempt: z.boolean(),
  englishDraft: z.string().min(1),
  hindiDraft: z.string().min(1),
});

export type RtiDraftResult = z.infer<typeof RtiDraftResultSchema>;

export const AudioTranscriptionResultSchema = z.object({
  transcript: z.string().min(1, 'Transcript cannot be empty'),
  detectedLang: z.string().min(1, 'detectedLang is required'),
  translatedEn: z.string().min(1, 'translatedEn is required'),
  translatedHi: z.string().min(1, 'translatedHi is required'),
  provider: z.enum(['sarvam', 'groq']),
});

export type AudioTranscriptionResult = z.infer<typeof AudioTranscriptionResultSchema>;

export const HazardVerificationResultSchema = z.object({
  isCivicIssue: z.boolean(),
  detectedHazard: z.string().min(1),
  severityBoost: z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  confidence: z.number().min(0).max(1),
  labels: z.array(z.string()),
});

export type HazardVerificationResult = z.infer<typeof HazardVerificationResultSchema>;

export type AiProviderName = 'gemini' | 'groq' | 'sarvam' | 'deterministic';

export interface AiLogEvent {
  readonly timestamp: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly event: 'ai_gateway_call';
  readonly capability: 'classify_complaint' | 'draft_rti' | 'transcribe_audio' | 'verify_hazard';
  readonly provider: AiProviderName;
  readonly latencyMs: number;
  readonly success: boolean;
  readonly fallbackReason?: string;
  readonly model?: string;
}

export type AiLogSink = (event: AiLogEvent) => void;

export interface AiGatewayOptions {
  readonly geminiApiKey?: string;
  readonly geminiModel?: string;
  readonly groqApiKey?: string;
  readonly groqModel?: string;
  readonly groqWhisperModel?: string;
  readonly sarvamApiKey?: string;
  readonly timeoutMs?: number;
  readonly onLog?: AiLogSink;
  readonly fetchFn?: typeof fetch;
}

export interface ClassificationMetaResult {
  readonly data: ComplaintClassification;
  readonly provider: AiProviderName;
  readonly latencyMs: number;
  readonly fallbackReason?: string;
}

export interface RtiDraftMetaResult {
  readonly data: RtiDraftResult;
  readonly provider: AiProviderName;
  readonly latencyMs: number;
  readonly fallbackReason?: string;
}
