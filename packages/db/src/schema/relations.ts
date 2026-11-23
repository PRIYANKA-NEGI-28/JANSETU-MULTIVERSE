import { relations } from 'drizzle-orm';
import { users, sessions, accounts } from './users.js';
import { departments } from './departments.js';
import { wards } from './wards.js';
import { complaintClusters } from './clusters.js';
import { complaints, complaintEvents } from './complaints.js';
import { iotDevices, iotTelemetry } from './iot.js';
import { rtiApplications } from './rti.js';

export const usersRelations = relations(users, ({ one, many }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  ward: one(wards, {
    fields: [users.wardId],
    references: [wards.id],
  }),
  sessions: many(sessions),
  accounts: many(accounts),
  complaints: many(complaints, { relationName: 'citizenComplaints' }),
  assignedComplaints: many(complaints, { relationName: 'assignedOfficerComplaints' }),
  rtiApplications: many(rtiApplications),
}));

export const departmentsRelations = relations(departments, ({ many }) => ({
  officers: many(users),
  complaints: many(complaints),
  clusters: many(complaintClusters),
  iotDevices: many(iotDevices),
}));

export const wardsRelations = relations(wards, ({ many }) => ({
  complaints: many(complaints),
  clusters: many(complaintClusters),
  iotDevices: many(iotDevices),
}));

export const complaintClustersRelations = relations(complaintClusters, ({ one, many }) => ({
  department: one(departments, {
    fields: [complaintClusters.departmentId],
    references: [departments.id],
  }),
  ward: one(wards, {
    fields: [complaintClusters.wardId],
    references: [wards.id],
  }),
  complaints: many(complaints),
}));

export const complaintsRelations = relations(complaints, ({ one, many }) => ({
  citizen: one(users, {
    fields: [complaints.citizenId],
    references: [users.id],
    relationName: 'citizenComplaints',
  }),
  department: one(departments, {
    fields: [complaints.departmentId],
    references: [departments.id],
  }),
  ward: one(wards, {
    fields: [complaints.wardId],
    references: [wards.id],
  }),
  cluster: one(complaintClusters, {
    fields: [complaints.clusterId],
    references: [complaintClusters.id],
  }),
  assignedOfficer: one(users, {
    fields: [complaints.assignedOfficerId],
    references: [users.id],
    relationName: 'assignedOfficerComplaints',
  }),
  events: many(complaintEvents),
}));

export const complaintEventsRelations = relations(complaintEvents, ({ one }) => ({
  complaint: one(complaints, {
    fields: [complaintEvents.complaintId],
    references: [complaints.id],
  }),
  actor: one(users, {
    fields: [complaintEvents.actorId],
    references: [users.id],
  }),
}));

export const iotDevicesRelations = relations(iotDevices, ({ one, many }) => ({
  ward: one(wards, {
    fields: [iotDevices.wardId],
    references: [wards.id],
  }),
  department: one(departments, {
    fields: [iotDevices.departmentId],
    references: [departments.id],
  }),
  telemetry: many(iotTelemetry),
}));

export const iotTelemetryRelations = relations(iotTelemetry, ({ one }) => ({
  device: one(iotDevices, {
    fields: [iotTelemetry.deviceId],
    references: [iotDevices.id],
  }),
}));

export const rtiApplicationsRelations = relations(rtiApplications, ({ one }) => ({
  citizen: one(users, {
    fields: [rtiApplications.citizenId],
    references: [users.id],
  }),
}));
