// JanSetu local auth system — two hardcoded users backed by Neo4j profiles.
// No Supabase, no external auth provider.

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: 'citizen' | 'admin';
}

export const USERS: Record<string, AuthUser> = {
  citizen: {
    id: 'citizen-001',
    name: 'Rituraj Sharma',
    phone: '9876543210',
    email: 'rituraj@jansetu.in',
    role: 'citizen',
  },
  admin: {
    id: 'admin-001',
    name: 'Rishav Kumar',
    phone: '9988776655',
    email: 'rishav@jansetu.in',
    role: 'admin',
  },
};

// Simple credential map — password is the key
const CREDENTIALS: Record<string, { password: string; userKey: string }> = {
  'citizen': { password: '123456', userKey: 'citizen' },
  'admin': { password: '123456', userKey: 'admin' },
};

export function authenticate(username: string, password: string): AuthUser | null {
  const cred = CREDENTIALS[username.toLowerCase().trim()];
  if (!cred) return null;
  if (cred.password !== password) return null;
  return USERS[cred.userKey];
}
