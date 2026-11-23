import { resolveWardByCoords, getDatabase } from '@jansetu/db';
import type { ValidatedEnv } from '../config/env.js';
import { createCacheService } from './cache.js';

export interface GeoResolvedWard {
  readonly wardId: string;
  readonly wardName: string;
  readonly wardCode: string;
  readonly locality: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode?: string | null;
  readonly formattedAddress: string;
  readonly boundaryMatched: boolean;
}

const KNOWN_WARDS: readonly {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  radius: number;
  city: string;
  state: string;
}[] = [
  {
    id: 'ward-04',
    name: 'Mayur Vihar Ward 04',
    code: 'MV-04',
    lat: 28.601,
    lng: 77.302,
    radius: 0.04,
    city: 'East Delhi',
    state: 'Delhi',
  },
  {
    id: 'ward-12',
    name: 'Indirapuram Ward 12',
    code: 'IND-12',
    lat: 28.636,
    lng: 77.371,
    radius: 0.04,
    city: 'Ghaziabad',
    state: 'Uttar Pradesh',
  },
  {
    id: 'ward-21',
    name: 'Connaught Place Ward 21',
    code: 'CP-21',
    lat: 28.631,
    lng: 77.219,
    radius: 0.03,
    city: 'New Delhi Central',
    state: 'Delhi',
  },
  {
    id: 'ward-08',
    name: 'Civil Lines Ward 08',
    code: 'CL-08',
    lat: 28.681,
    lng: 77.221,
    radius: 0.04,
    city: 'North Delhi',
    state: 'Delhi',
  },
];

export async function resolveWardAndAddress(
  lat: number,
  lng: number,
  env?: ValidatedEnv
): Promise<GeoResolvedWard> {
  const cache = createCacheService(env);
  const cacheKey = `geo:reverse:${lat.toFixed(3)}:${lng.toFixed(3)}`;

  const cached = await cache.get<GeoResolvedWard>(cacheKey);
  if (cached) {
    return cached;
  }

  let matchedWard: { id: string; name: string; code: string; city: string; state: string } | null = null;
  let boundaryMatched = false;

  // 1. PostGIS Database boundary check
  if (env?.DATABASE_URL) {
    try {
      const db = getDatabase(env.DATABASE_URL);
      const wardRecord = await resolveWardByCoords(db, lat, lng);
      if (wardRecord) {
        matchedWard = {
          id: wardRecord.id,
          name: wardRecord.name,
          code: wardRecord.code,
          city: 'Delhi NCR',
          state: 'Delhi',
        };
        boundaryMatched = true;
      }
    } catch {
      // Clean fallback if database is offline or not configured
    }
  }

  // 2. Known Wards In-Memory Proximity Fallback
  if (!matchedWard) {
    for (const kw of KNOWN_WARDS) {
      const dLat = Math.abs(kw.lat - lat);
      const dLng = Math.abs(kw.lng - lng);
      if (dLat <= kw.radius && dLng <= kw.radius) {
        matchedWard = {
          id: kw.id,
          name: kw.name,
          code: kw.code,
          city: kw.city,
          state: kw.state,
        };
        boundaryMatched = true;
        break;
      }
    }
  }

  // 3. Fallback to default municipal ward if outside known zones
  if (!matchedWard) {
    matchedWard = {
      id: 'ward-04',
      name: 'Mayur Vihar Ward 04',
      code: 'MV-04',
      city: 'Delhi NCR',
      state: 'Delhi',
    };
  }

  const result: GeoResolvedWard = {
    wardId: matchedWard.id,
    wardName: matchedWard.name,
    wardCode: matchedWard.code,
    locality: matchedWard.name,
    city: matchedWard.city,
    state: matchedWard.state,
    postalCode: '110091',
    formattedAddress: `${matchedWard.name}, ${matchedWard.city}, ${matchedWard.state}`,
    boundaryMatched,
  };

  // Cache in Redis for 24 hours
  await cache.set(cacheKey, result, 86400);

  return result;
}
