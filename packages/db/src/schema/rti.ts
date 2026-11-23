import { pgTable, text, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const rtiApplications = pgTable(
  'rti_applications',
  {
    id: text('id').primaryKey(),
    citizenId: text('citizen_id').references(() => users.id, { onDelete: 'set null' }),
    clusterId: text('cluster_id'),
    applicantName: text('applicant_name').notNull(),
    fatherOrSpouseName: text('father_or_spouse_name'),
    address: text('address').notNull(),
    contactNumber: text('contact_number').notNull(),
    email: text('email'),
    bplCardNo: text('bpl_card_no'),
    bplYear: text('bpl_year'),
    authorityName: text('authority_name').notNull(),
    publicAuthorityAddress: text('public_authority_address'),
    subject: text('subject').notNull(),
    description: text('description').notNull(),
    specificQuestions: jsonb('specific_questions').default([]).notNull(),
    englishDraft: text('english_draft').notNull(),
    hindiDraft: text('hindi_draft').notNull(),
    isBplExempt: boolean('is_bpl_exempt').default(false).notNull(),
    status: text('status').default('DRAFT').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_rti_citizen_created').on(table.citizenId, table.createdAt),
    index('idx_rti_cluster').on(table.clusterId),
  ]
);

export type RtiApplication = typeof rtiApplications.$inferSelect;
export type NewRtiApplication = typeof rtiApplications.$inferInsert;
