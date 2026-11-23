import { describe, it, expect, afterAll } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import {
  buildResolveWardSql,
  buildNearbyClusterSql,
  resolveWardByCoords,
  findNearbyOpenCluster,
} from '../helpers/spatial.js';
import { getDatabase, closeDatabase } from '../client.js';
import { seedDatabase } from '../seed.js';

describe('Spatial SQL Query Builders', () => {
  const pgDialect = new PgDialect();

  it('generates valid PostGIS ST_Contains SQL for resolveWardByCoords', () => {
    const lat = 28.6412;
    const lng = 77.3712;
    const query = buildResolveWardSql(lat, lng);
    const compiled = pgDialect.sqlToQuery(query);

    expect(compiled.sql).toContain('ST_Contains');
    expect(compiled.sql).toContain('ST_SetSRID');
    expect(compiled.sql).toContain('ST_MakePoint');
    expect(compiled.sql).toContain('4326');
    // Ensure coordinate parameters are bound in (lng, lat) order for PostGIS
    expect(compiled.params).toEqual([lng, lat]);
  });

  it('generates valid PostGIS ST_DWithin SQL with SLA/department filters for findNearbyOpenCluster', () => {
    const lat = 28.6412;
    const lng = 77.3712;
    const deptId = 'dept-streetlights';
    const radiusMeters = 250;
    const windowDays = 14;

    const query = buildNearbyClusterSql(lat, lng, deptId, radiusMeters, windowDays);
    expect(query).toBeDefined();
    if (!query) throw new Error('Query expression expected to be defined');

    const compiled = pgDialect.sqlToQuery(query);

    expect(compiled.sql).toContain('ST_DWithin');
    expect(compiled.sql).toContain('::geography');
    expect(compiled.sql).toContain('ST_MakePoint');
    expect(compiled.sql).toContain('"status" <>');
    expect(compiled.sql).toContain('"department_id" =');

    // Parameters should contain departmentId, 'RESOLVED', windowDate cutoff, lng, lat, radiusMeters
    expect(compiled.params).toContain(deptId);
    expect(compiled.params).toContain('RESOLVED');
    expect(compiled.params).toContain(lng);
    expect(compiled.params).toContain(lat);
    expect(compiled.params).toContain(radiusMeters);
  });
});

const isLiveDbConfigured = Boolean(process.env.DATABASE_URL);

describe('Live Database PostGIS Integration', () => {
  if (!isLiveDbConfigured) {
    it.skip('SKIPPED: DATABASE_URL not set — configure DATABASE_URL to test live PostGIS instance', () => {
      // Intentionally skipped when no live PostgreSQL instance is available.
      // Set DATABASE_URL=postgresql://user:pass@host/dbname to run.
    });
    return;
  }

  const db = getDatabase();

  afterAll(async () => {
    await closeDatabase();
  });

  it('seeds database idempotently and verifies record counts', async () => {
    const result = await seedDatabase(db);
    expect(result.departmentsCount).toBe(6);
    expect(result.wardsCount).toBe(4);
    expect(result.usersCount).toBe(6);
    expect(result.iotDevicesCount).toBe(2);
    expect(result.clustersCount).toBe(1);
    expect(result.complaintsCount).toBe(2);
  });

  it('resolves ward by GPS coordinates inside Mayur Vihar (Ward 04)', async () => {
    // Center of Mayur Vihar polygon: lat 28.6000, lng 77.3000
    const ward = await resolveWardByCoords(db, 28.60, 77.30);
    expect(ward).not.toBeNull();
    expect(ward?.id).toBe('ward-04');
    expect(ward?.name).toBe('Mayur Vihar');
  });

  it('returns null for coordinates outside all configured ward boundaries', async () => {
    // Mumbai coordinates: lat 19.0760, lng 72.8777
    const ward = await resolveWardByCoords(db, 19.076, 72.8777);
    expect(ward).toBeNull();
  });

  it('finds nearby open cluster for coordinates near Kala Patthar Road', async () => {
    // Near seeded cluster (lat 28.6412, lng 77.3712) within 100 meters
    const cluster = await findNearbyOpenCluster(
      db,
      28.6413,
      77.3713,
      'dept-streetlights',
      200,
      7
    );
    expect(cluster).not.toBeNull();
    expect(cluster?.id).toBe('cluster-indirapuram-elec');
  });

  it('returns null when searching for clusters beyond radius threshold', async () => {
    // 5 km away from Kala Patthar Road cluster
    const cluster = await findNearbyOpenCluster(
      db,
      28.6800,
      77.4200,
      'dept-streetlights',
      200,
      7
    );
    expect(cluster).toBeNull();
  });
});
