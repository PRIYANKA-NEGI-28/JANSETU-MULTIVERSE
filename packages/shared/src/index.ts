export * from './roles/index.js';
export * from './domain/index.js';
export * from './schemas/index.js';
export * from './i18n.js';

export interface SharedPackageMeta {
  readonly name: '@jansetu/shared';
  readonly version: '1.0.0';
  readonly initialized: true;
}

export const SHARED_PACKAGE_INFO: SharedPackageMeta = {
  name: '@jansetu/shared',
  version: '1.0.0',
  initialized: true,
};
