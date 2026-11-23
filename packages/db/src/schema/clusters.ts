import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { departments } from './departments.js';
import { wards } from './wards.js';
import { pointGeometry } from './postgis.js';

export const complaintClusters = pgTable(
  'complaint_clusters',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    departmentId: text('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
    wardId: text('ward_id')
      .notNull()
      .references(() => wards.id, { onDelete: 'cascade' }),
    status: text('status').default('PENDING').notNull(),
    centroid: pointGeometry('centroid').notNull(),
    complaintCount: integer('complaint_count').default(1).notNull(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_clusters_centroid').using('gist', table.centroid),
    index('idx_clusters_dept_ward_status').on(table.departmentId, table.wardId, table.status),
  ]
);

export type ComplaintCluster = typeof complaintClusters.$inferSelect;
export type NewComplaintCluster = typeof complaintClusters.$inferInsert;
