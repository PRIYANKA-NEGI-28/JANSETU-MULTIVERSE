import { pgTable, text, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { departments } from './departments.js';
import { wards } from './wards.js';
import { users } from './users.js';
import { complaintClusters } from './clusters.js';
import { pointGeometry } from './postgis.js';

export const complaints = pgTable(
  'complaints',
  {
    id: text('id').primaryKey(),
    trackingCode: text('tracking_code').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    citizenId: text('citizen_id').references(() => users.id, { onDelete: 'set null' }),
    departmentId: text('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
    wardId: text('ward_id')
      .notNull()
      .references(() => wards.id, { onDelete: 'cascade' }),
    clusterId: text('cluster_id').references(() => complaintClusters.id, { onDelete: 'set null' }),
    category: text('category').notNull(),
    urgency: text('urgency').default('MEDIUM').notNull(),
    status: text('status').default('PENDING').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    rawText: text('raw_text').notNull(),
    language: text('language').default('en').notNull(),
    citizenName: text('citizen_name').default('Anonymous').notNull(),
    citizenPhone: text('citizen_phone'),
    exactLocation: pointGeometry('exact_location').notNull(),
    publicLocation: pointGeometry('public_location').notNull(),
    photoUrl: text('photo_url'),
    assignedOfficerId: text('assigned_officer_id').references(() => users.id, { onDelete: 'set null' }),
    slaDueAt: timestamp('sla_due_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    escalatedAt: timestamp('escalated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_complaints_tracking_code').on(table.trackingCode),
    uniqueIndex('idx_complaints_idempotency_key').on(table.idempotencyKey),
    index('idx_complaints_public_location').using('gist', table.publicLocation),
    index('idx_complaints_ward_dept_status').on(table.wardId, table.departmentId, table.status),
    index('idx_complaints_status_sla_due').on(table.status, table.slaDueAt),
  ]
);

export const complaintEvents = pgTable(
  'complaint_events',
  {
    id: text('id').primaryKey(),
    complaintId: text('complaint_id')
      .notNull()
      .references(() => complaints.id, { onDelete: 'cascade' }),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorRole: text('actor_role').notNull(),
    eventType: text('event_type').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    notes: text('notes'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_events_complaint_created').on(table.complaintId, table.createdAt),
  ]
);

export type Complaint = typeof complaints.$inferSelect;
export type NewComplaint = typeof complaints.$inferInsert;
export type ComplaintEvent = typeof complaintEvents.$inferSelect;
export type NewComplaintEvent = typeof complaintEvents.$inferInsert;
