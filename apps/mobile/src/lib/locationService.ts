import * as Location from 'expo-location';
import { resolveWard, type WardResolutionDto } from './api-client';

export interface LocationTagResult {
  readonly latitude: number;
  readonly longitude: number;
  readonly city: string;
  readonly area: string;
  readonly ward: string;
  readonly address: string;
  readonly isAutoTagged: boolean;
}

export async function requestLocationPermission(): Promise<{ readonly granted: boolean; readonly canAskAgain: boolean }> {
  const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
  return {
    granted: status === 'granted',
    canAskAgain,
  };
}

export async function getCurrentCivicLocation(): Promise<LocationTagResult | null> {
  const permission = await requestLocationPermission();
  if (!permission.granted) {
    throw new Error('Location permission is required to accurately geotag civic grievances and map them to municipal wards.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const { latitude, longitude } = position.coords;

  // Resolve against PostGIS backend boundary
  const resolved = await resolveWard(latitude, longitude);

  if (resolved) {
    return {
      latitude,
      longitude,
      city: resolved.city || 'Delhi',
      area: resolved.zone || resolved.wardName || 'Local Municipal Area',
      ward: resolved.wardName || `Ward ${resolved.wardId}`,
      address: resolved.approximateAddress || `${resolved.city}, India`,
      isAutoTagged: true,
    };
  }

  // Reverse geocode via expo-location as fallback
  const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
  const first = geocoded[0];

  const city = first?.city || first?.subregion || 'Delhi';
  const area = first?.name || first?.district || first?.street || 'Local Area';
  const ward = first?.subregion ? `${first.subregion} Ward` : 'General Ward';
  const address = [first?.name, first?.street, first?.city].filter(Boolean).join(', ') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

  return {
    latitude,
    longitude,
    city,
    area,
    ward,
    address,
    isAutoTagged: true,
  };
}
