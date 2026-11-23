import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Role } from '@jansetu/shared';
import { api, type AuthUserDto, type AuthSessionDto, ApiClientError } from '../lib/api.js';

export interface AuthContextType {
  readonly user: AuthUserDto | null;
  readonly session: AuthSessionDto | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly error: string | null;
  readonly login: (email: string, password: string) => Promise<void>;
  readonly register: (data: {
    name: string;
    email: string;
    password: string;
    role?: Role;
    phone?: string;
    wardId?: string;
    departmentId?: string;
  }) => Promise<void>;
  readonly switchDemoRole: (role: Role) => void;
  readonly logout: () => Promise<void>;
  readonly clearError: () => void;
}

const STORAGE_USER_KEY = 'jansetu_user';
const STORAGE_TOKEN_KEY = 'jansetu_token';

// Preset demo accounts matching packages/db/src/seed.ts & legacy auth
export const DEMO_ACCOUNTS: Record<Role, { readonly user: AuthUserDto; readonly passwordHint: string }> = {
  citizen: {
    user: {
      id: 'demo-citizen-id',
      name: 'Ramesh Sharma',
      email: 'citizen@jansetu.gov.in',
      role: 'citizen',
      phone: '+91 98765 43210',
      wardId: 'ward-ghz-01-indirapuram',
      departmentId: null,
      image: null,
    },
    passwordHint: 'Password123! or 123456',
  },
  ward_officer: {
    user: {
      id: 'demo-officer-id',
      name: 'Anjali Verma (Ward 01)',
      email: 'officer.indirapuram@jansetu.gov.in',
      role: 'ward_officer',
      phone: '+91 98765 43211',
      wardId: 'ward-ghz-01-indirapuram',
      departmentId: null,
      image: null,
    },
    passwordHint: 'Password123!',
  },
  dept_head: {
    user: {
      id: 'demo-dept-head-id',
      name: 'Vikram Singh (PWD)',
      email: 'head.pwd@jansetu.gov.in',
      role: 'dept_head',
      phone: '+91 98765 43214',
      wardId: null,
      departmentId: 'dept-pwd',
      image: null,
    },
    passwordHint: 'Password123!',
  },
  admin: {
    user: {
      id: 'demo-admin-id',
      name: 'District Administrator',
      email: 'admin@jansetu.gov.in',
      role: 'admin',
      phone: '+91 98765 43215',
      wardId: null,
      departmentId: null,
      image: null,
    },
    passwordHint: 'Password123! or 123456',
  },
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [user, setUser] = useState<AuthUserDto | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_USER_KEY);
      if (!stored || stored === 'null') return null;
      return JSON.parse(stored) as AuthUserDto;
    } catch {
      return null;
    }
  });

  const [session, setSession] = useState<AuthSessionDto | null>(() => {
    try {
      const token = localStorage.getItem(STORAGE_TOKEN_KEY);
      const storedUser = localStorage.getItem(STORAGE_USER_KEY);
      if (token && storedUser && storedUser !== 'null') {
        const parsed = JSON.parse(storedUser) as AuthUserDto;
        return {
          id: 'local-session-id',
          userId: parsed.id,
          token,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        };
      }
      return null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Verify session on mount with backend if token exists
  useEffect(() => {
    let mounted = true;
    async function checkSession() {
      try {
        const res = await api.auth.getSession();
        if (mounted && res?.user) {
          setUser(res.user);
          setSession(res.session);
          localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(res.user));
          if (res.session?.token) {
            localStorage.setItem(STORAGE_TOKEN_KEY, res.session.token);
          }
        }
      } catch {
        // Backend not online or unauthenticated, keep local session if valid token
        if (mounted && !localStorage.getItem(STORAGE_TOKEN_KEY)) {
          setUser(null);
          setSession(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }
    void checkSession();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    // Fast-path for legacy credentials (citizen/123456, admin/123456)
    if (email === 'citizen' && (password === '123456' || password === 'Password123!')) {
      const demo = DEMO_ACCOUNTS.citizen.user;
      setUser(demo);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(demo));
      setIsLoading(false);
      return;
    }
    if (email === 'admin' && (password === '123456' || password === 'Password123!')) {
      const demo = DEMO_ACCOUNTS.admin.user;
      setUser(demo);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(demo));
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.auth.signIn({ email, password });
      setUser(res.user);
      setSession(res.session);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(res.user));
      if (res.session?.token) {
        localStorage.setItem(STORAGE_TOKEN_KEY, res.session.token);
      }
    } catch (err: unknown) {
      // Check if matches seeded demo accounts for offline / test mock
      const matchedRole = Object.entries(DEMO_ACCOUNTS).find(
        ([, v]) => v.user.email.toLowerCase() === email.toLowerCase()
      );
      if (matchedRole && (password === '123456' || password === 'Password123!')) {
        const demo = matchedRole[1].user;
        setUser(demo);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(demo));
        return;
      }

      const msg = err instanceof ApiClientError ? err.detail : 'Invalid credentials. Please verify and try again.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(
    async (data: {
      name: string;
      email: string;
      password: string;
      role?: Role;
      phone?: string;
      wardId?: string;
      departmentId?: string;
    }) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.auth.signUp(data);
        setUser(res.user);
        setSession(res.session);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(res.user));
        if (res.session?.token) {
          localStorage.setItem(STORAGE_TOKEN_KEY, res.session.token);
        }
      } catch (err: unknown) {
        const msg = err instanceof ApiClientError ? err.detail : 'Registration failed. Please check your details.';
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const switchDemoRole = useCallback((role: Role) => {
    const demo = DEMO_ACCOUNTS[role].user;
    const demoSession: AuthSessionDto = {
      id: `demo-session-${role}`,
      userId: demo.id,
      token: `demo-token-${role}`,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    setUser(demo);
    setSession(demoSession);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(demo));
    localStorage.setItem(STORAGE_TOKEN_KEY, demoSession.token);
    setError(null);
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await api.auth.signOut().catch(() => {});
    } finally {
      setUser(null);
      setSession(null);
      localStorage.removeItem(STORAGE_USER_KEY);
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: user !== null && session !== null,
        error,
        login,
        register,
        switchDemoRole,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
