import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authClient } from '../lib/auth-client';
import type { Role } from '@jansetu/shared';

export interface MobileUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly phone?: string | null;
}

export interface AuthContextValue {
  readonly user: MobileUser | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly signIn: (credentials: {
    readonly email: string;
    readonly password: string;
  }) => Promise<{ readonly success: boolean; readonly error?: string }>;
  readonly signUp: (data: {
    readonly email: string;
    readonly password: string;
    readonly name: string;
    readonly phone?: string;
  }) => Promise<{ readonly success: boolean; readonly error?: string }>;
  readonly signOut: () => Promise<void>;
  readonly refreshSession: () => Promise<void>;
}

const FALLBACK_SESSION_KEY = 'jansetu_cached_user';

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  signIn: async () => ({ success: false, error: 'AuthContext not initialized' }),
  signUp: async () => ({ success: false, error: 'AuthContext not initialized' }),
  signOut: async () => {},
  refreshSession: async () => {},
});

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  async function refreshSession(): Promise<void> {
    try {
      const sessionResult = await authClient.getSession();
      if (sessionResult?.data?.user) {
        const u = sessionResult.data.user;
        const mobileUser: MobileUser = {
          id: u.id,
          email: u.email,
          name: u.name || 'Citizen',
          role: (('role' in u && typeof u.role === 'string' ? u.role : 'citizen') as Role),
          phone: 'phone' in u && typeof u.phone === 'string' ? u.phone : null,
        };
        setUser(mobileUser);
        await SecureStore.setItemAsync(FALLBACK_SESSION_KEY, JSON.stringify(mobileUser));
      } else {
        const cached = await SecureStore.getItemAsync(FALLBACK_SESSION_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as MobileUser;
            setUser(parsed);
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    } catch {
      const cached = await SecureStore.getItemAsync(FALLBACK_SESSION_KEY);
      if (cached) {
        try {
          setUser(JSON.parse(cached) as MobileUser);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshSession();
  }, []);

  async function signIn(credentials: {
    readonly email: string;
    readonly password: string;
  }): Promise<{ readonly success: boolean; readonly error?: string }> {
    try {
      const res = await authClient.signIn.email({
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
      });

      if (res.error) {
        return {
          success: false,
          error: res.error.message || 'Invalid email or password',
        };
      }

      await refreshSession();
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      return { success: false, error: message };
    }
  }

  async function signUp(data: {
    readonly email: string;
    readonly password: string;
    readonly name: string;
    readonly phone?: string;
  }): Promise<{ readonly success: boolean; readonly error?: string }> {
    try {
      const res = await authClient.signUp.email({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        name: data.name.trim(),
      });

      if (res.error) {
        return {
          success: false,
          error: res.error.message || 'Registration failed',
        };
      }

      await refreshSession();
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      return { success: false, error: message };
    }
  }

  async function signOut(): Promise<void> {
    try {
      await authClient.signOut();
    } catch {
      // Ignore network errors on signout
    } finally {
      setUser(null);
      await SecureStore.deleteItemAsync(FALLBACK_SESSION_KEY).catch(() => {});
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        signIn,
        signUp,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
