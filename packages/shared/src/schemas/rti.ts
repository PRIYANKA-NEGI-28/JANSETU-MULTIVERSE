import { z } from 'zod';

export const RtiDraftInputSchema = z.object({
  applicantName: z.string().trim().min(1, 'Applicant name is required'),
  fatherOrSpouseName: z.string().trim().optional().default(''),
  address: z.string().trim().min(3, 'Address is required'),
  contactNumber: z.string().trim().min(10, 'Contact number is required'),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  bplCardNo: z.string().trim().optional().default(''),
  bplYear: z.string().trim().optional().default(''),
  authorityName: z.string().trim().min(1, 'Public authority name is required'),
  publicAuthorityAddress: z.string().trim().optional().default(''),
  subject: z.string().trim().min(3, 'Subject is required'),
  description: z.string().trim().min(10, 'Description is required'),
  specificQuestions: z.array(z.string().trim()).default([]),
  preferredLanguage: z.enum(['en', 'hi']).default('en'),
});

export type RtiDraftInput = z.infer<typeof RtiDraftInputSchema>;

export const RtiDraftResponseSchema = z.object({
  success: z.boolean(),
  english_draft: z.string(),
  hindi_draft: z.string(),
  is_bpl_exempt: z.boolean(),
  generated_at: z.string(),
});

export type RtiDraftResponse = z.infer<typeof RtiDraftResponseSchema>;
