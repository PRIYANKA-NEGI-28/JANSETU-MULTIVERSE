const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo for workspace packages like @jansetu/shared, preserving Expo defaults
config.watchFolders = [...(config.watchFolders || []), monorepoRoot];

// 2. Resolve node_modules from both local package and monorepo root for pnpm symlinks
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = withNativeWind(config, {
  input: './global.css',
  configPath: './tailwind.config.js',
});
