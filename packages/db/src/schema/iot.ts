import { pgTable, text, integer, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { wards } from './wards.js';
import { departments } from './departments.js';
import { pointGeometry } from './postgis.js';

export const iotDevices = pgTable(
  'iot_devices',
  {
    id: text('id').primaryKey(),
    deviceUid: text('device_uid').notNull(),
    deviceType: text('device_type').default('STREETLIGHT').notNull(),
    wardId: text('ward_id').references(() => wards.id, { onDelete: 'set null' }),
    departmentId: text('department_id').references(() => departments.id, { onDelete: 'set null' }),
    location: pointGeometry('location').notNull(),
    status: text('status').default('NORMAL').notNull(),
    batteryLevel: integer('battery_level'),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_iot_devices_device_uid').on(table.deviceUid),
    index('idx_iot_devices_location').using('gist', table.location),
    index('idx_iot_devices_ward_status').on(table.wardId, table.status),
  ]
);

export const iotTelemetry = pgTable(
  'iot_telemetry',
  {
    id: text('id').primaryKey(),
    deviceId: text('device_id')
      .notNull()
      .references(() => iotDevices.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    status: text('status').notNull(),
    payload: jsonb('payload').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_telemetry_device_recorded').on(table.deviceId, table.recordedAt),
  ]
);

export type IotDevice = typeof iotDevices.$inferSelect;
export type NewIotDevice = typeof iotDevices.$inferInsert;
export type IotTelemetry = typeof iotTelemetry.$inferSelect;
export type NewIotTelemetry = typeof iotTelemetry.$inferInsert;
