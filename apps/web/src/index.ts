import { SHARED_PACKAGE_INFO, type SharedPackageMeta } from '@jansetu/shared';

export interface WebAppMeta {
  readonly name: '@jansetu/web';
  readonly version: '1.0.0';
  readonly shared: SharedPackageMeta;
}

export const WEB_APP_INFO: WebAppMeta = {
  name: '@jansetu/web',
  version: '1.0.0',
  shared: SHARED_PACKAGE_INFO,
};
