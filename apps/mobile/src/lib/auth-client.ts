import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

export const API_BASE_URL: string = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  plugins: [
    expoClient({
      scheme: 'jansetu',
      storage: SecureStore,
      storagePrefix: 'jansetu_auth',
    }),
  ],
});
