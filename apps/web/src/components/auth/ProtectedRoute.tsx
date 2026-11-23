import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '@jansetu/shared';
import { useAuth } from '../../contexts/AuthContext.js';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface ProtectedRouteProps {
  readonly children: ReactNode;
  readonly allowedRoles?: readonly Role[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-gray-500 animate-pulse">Verifying credentials...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-2xl border border-red-100 shadow-xl p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
            <ShieldAlert size={28} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-sm text-gray-600 mb-6">
            Your current role (<span className="font-semibold text-gray-800">{user.role}</span>) does not have
            permission to view this section. Allowed roles: {allowedRoles.join(', ')}.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-all"
            >
              <ArrowLeft size={16} /> Return Home
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-all shadow-md shadow-orange-500/20"
            >
              Switch Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
