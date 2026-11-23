import { SHARED_PACKAGE_INFO, type SharedPackageMeta } from '@jansetu/shared';

export interface MobileAppMeta {
  readonly name: '@jansetu/mobile';
  readonly version: '1.0.0';
  readonly shared: SharedPackageMeta;
}

export const MOBILE_APP_INFO: MobileAppMeta = {
  name: '@jansetu/mobile',
  version: '1.0.0',
  shared: SHARED_PACKAGE_INFO,
};
