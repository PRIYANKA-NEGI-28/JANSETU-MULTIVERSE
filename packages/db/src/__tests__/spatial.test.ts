import { describe, it, expect } from 'vitest';
import { obfuscatePublicCoords } from '../helpers/spatial.js';

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

describe('Privacy Coordinates Obfuscation', () => {
  it('deterministically snaps coordinates', () => {
    const lat = 28.613939;
    const lng = 77.209021;

    const snap1 = obfuscatePublicCoords(lat, lng);
    const snap2 = obfuscatePublicCoords(lat, lng);

    expect(snap1.lat).toBe(snap2.lat);
    expect(snap1.lng).toBe(snap2.lng);
  });

  it('keeps obfuscated point within ~50 meters of exact location', () => {
    // Delhi Connaught Place
    const lat = 28.6315;
    const lng = 77.2167;

    const obfuscated = obfuscatePublicCoords(lat, lng);
    const distance = haversineDistanceMeters(lat, lng, obfuscated.lat, obfuscated.lng);

    // Max diagonal displacement across 50m cell is 50 * sqrt(2)/2 ≈ 35.4m
    expect(distance).toBeLessThanOrEqual(50);
  });

  it('merges micro-jittered coordinates from the same house into identical grid cells', () => {
    // Two phones in the same building with slight GPS drift (3 meters apart)
    const phone1 = { lat: 28.613939, lng: 77.209021 };
    const phone2 = { lat: 28.613945, lng: 77.209025 };

    const snap1 = obfuscatePublicCoords(phone1.lat, phone1.lng);
    const snap2 = obfuscatePublicCoords(phone2.lat, phone2.lng);

    expect(snap1.lat).toBe(snap2.lat);
    expect(snap1.lng).toBe(snap2.lng);
  });

  it('separates distant coordinates into different grid cells', () => {
    const cp = { lat: 28.6315, lng: 77.2167 };
    const indiaGate = { lat: 28.6129, lng: 77.2295 };

    const snap1 = obfuscatePublicCoords(cp.lat, cp.lng);
    const snap2 = obfuscatePublicCoords(indiaGate.lat, indiaGate.lng);

    expect(snap1.lat).not.toBe(snap2.lat);
    expect(snap1.lng).not.toBe(snap2.lng);
  });
});
