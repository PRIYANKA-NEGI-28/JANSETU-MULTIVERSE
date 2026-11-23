import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const departments = pgTable('departments', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  nameHi: text('name_hi'),
  code: text('code').notNull().unique(),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  defaultSlaHours: integer('default_sla_hours').default(48).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
