import { customType } from 'drizzle-orm/pg-core';

export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

export const pointGeometry = customType<{
  data: GeoPoint | string;
  driverData: string;
}>({
  dataType() {
    return 'geometry(Point, 4326)';
  },
  toDriver(value: GeoPoint | string): string {
    if (typeof value === 'string') return value;
    return `SRID=4326;POINT(${value.lng} ${value.lat})`;
  },
  fromDriver(value: string): GeoPoint {
    const match = value.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match && match[1] && match[2]) {
      return {
        lng: parseFloat(match[1]),
        lat: parseFloat(match[2]),
      };
    }
    return { lat: 0, lng: 0 };
  },
});

export const multiPolygonGeometry = customType<{
  data: string | Record<string, unknown>;
  driverData: string;
}>({
  dataType() {
    return 'geometry(MultiPolygon, 4326)';
  },
  toDriver(value: string | Record<string, unknown>): string {
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  },
  fromDriver(value: string): string | Record<string, unknown> {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return value;
    }
  },
});
