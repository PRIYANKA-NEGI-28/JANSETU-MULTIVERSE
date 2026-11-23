export * from './schema/index.js';
export * from './helpers/index.js';
export * from './client.js';

export interface DbPackageMeta {
  readonly name: '@jansetu/db';
  readonly version: '1.0.0';
  readonly orm: 'drizzle';
  readonly postgis: true;
}

export const DB_PACKAGE_INFO: DbPackageMeta = {
  name: '@jansetu/db',
  version: '1.0.0',
  orm: 'drizzle',
  postgis: true,
};
