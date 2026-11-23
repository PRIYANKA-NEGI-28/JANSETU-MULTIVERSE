import { type ReactNode } from 'react';
import type { Role } from '@jansetu/shared';
import { useAuth } from '../../contexts/AuthContext.js';

export interface RoleGuardProps {
  readonly allowedRoles: readonly Role[];
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
}

export function RoleGuard({ allowedRoles, children, fallback = null }: RoleGuardProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <>{fallback}</>;
  }

  if (!allowedRoles.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
