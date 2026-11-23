import { Hono } from 'hono';
import type { AppEnv } from '../types/index.js';
import { resolveWardAndAddress } from '../services/geo-service.js';
import { HttpError } from '../middleware/error-handler.js';

export const geoRoute = new Hono<AppEnv>();

geoRoute.get('/resolve-ward', async (c) => {
  const latStr = c.req.query('lat');
  const lngStr = c.req.query('lng');

  if (!latStr || !lngStr) {
    throw new HttpError(
      400,
      'Bad Request',
      "Query parameters 'lat' and 'lng' are both required",
      'https://jansetu.gov.in/errors/validation-error'
    );
  }

  const lat = Number(latStr);
  const lng = Number(lngStr);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new HttpError(
      400,
      'Bad Request',
      'Valid numeric latitude [-90, 90] and longitude [-180, 180] required',
      'https://jansetu.gov.in/errors/validation-error'
    );
  }

  const result = await resolveWardAndAddress(lat, lng, c.get('env'));
  return c.json(result, 200);
});
