import { sql, and, ne, eq, gte } from 'drizzle-orm';
import type { AppDatabase } from '../client.js';
import { wards, type Ward } from '../schema/wards.js';
import { complaintClusters, type ComplaintCluster } from '../schema/clusters.js';
import type { GeoPoint } from '../schema/postgis.js';

export const LAT_METERS_PER_DEGREE = 111320;
// 0.0005 degrees latitude ≈ 55.6m; longitude at 28.6°N ≈ 48.8m
export const PRIVACY_GRID_STEP = 0.0005;

/**
 * Deterministically snaps exact GPS coordinates to a ~50m spatial grid.
 * Strips household-level micro-jitter to protect citizen location privacy
 * while keeping complaints spatially clusterable on municipal heat maps.
 */
export function obfuscatePublicCoords(lat: number, lng: number): GeoPoint {
  const snappedLat = Math.round(lat / PRIVACY_GRID_STEP) * PRIVACY_GRID_STEP;
  const snappedLng = Math.round(lng / PRIVACY_GRID_STEP) * PRIVACY_GRID_STEP;

  return {
    lat: Number(snappedLat.toFixed(4)),
    lng: Number(snappedLng.toFixed(4)),
  };
}

/**
 * Builds the PostGIS ST_Contains SQL expression for ward boundary containment.
 */
export function buildResolveWardSql(lat: number, lng: number) {
  return sql`ST_Contains(${wards.boundary}, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))`;
}

/**
 * Builds the composite filter SQL expression for matching nearby open complaint clusters.
 */
export function buildNearbyClusterSql(
  lat: number,
  lng: number,
  departmentId: string,
  radiusMeters: number = 200,
  windowDays: number = 7
) {
  const windowDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  return and(
    eq(complaintClusters.departmentId, departmentId),
    ne(complaintClusters.status, 'RESOLVED'),
    gte(complaintClusters.lastActivityAt, windowDate),
    sql`ST_DWithin(${complaintClusters.centroid}::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusMeters})`
  );
}

/**
 * Resolves the municipal ward containing the given GPS point using PostGIS ST_Contains.
 */
export async function resolveWardByCoords(
  db: AppDatabase,
  lat: number,
  lng: number
): Promise<Ward | null> {
  const result = await db
    .select()
    .from(wards)
    .where(buildResolveWardSql(lat, lng))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Finds an existing open complaint cluster within `radiusMeters` for the given department
 * and activity window using PostGIS ST_DWithin on geography types.
 */
export async function findNearbyOpenCluster(
  db: AppDatabase,
  lat: number,
  lng: number,
  departmentId: string,
  radiusMeters: number = 200,
  windowDays: number = 7
): Promise<ComplaintCluster | null> {
  const filterClause = buildNearbyClusterSql(lat, lng, departmentId, radiusMeters, windowDays);

  const result = await db
    .select()
    .from(complaintClusters)
    .where(filterClause)
    .orderBy(
      sql`ST_Distance(${complaintClusters.centroid}::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography)`
    )
    .limit(1);

  return result[0] ?? null;
}
