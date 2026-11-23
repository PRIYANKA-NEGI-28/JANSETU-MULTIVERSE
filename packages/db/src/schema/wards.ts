import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { multiPolygonGeometry } from './postgis.js';

export const wards = pgTable(
  'wards',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    number: text('number').notNull(),
    zone: text('zone').notNull(),
    city: text('city').default('Delhi NCR').notNull(),
    boundary: multiPolygonGeometry('boundary').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_wards_boundary').using('gist', table.boundary),
    index('idx_wards_city_number').on(table.city, table.number),
  ]
);

export type Ward = typeof wards.$inferSelect;
export type NewWard = typeof wards.$inferInsert;
