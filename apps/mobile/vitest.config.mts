import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    server: {
      deps: {
        inline: [
          /expo-modules-core/,
          /@better-auth\/expo/,
          /expo-secure-store/,
          /expo-sqlite/,
          /@react-native-community\/netinfo/,
        ],
      },
    },
  },
});
