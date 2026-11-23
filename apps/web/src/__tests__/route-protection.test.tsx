import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute.js';
import { AuthProvider } from '../contexts/AuthContext.js';
import { api } from '../lib/api.js';
import '../lib/i18n.js';

describe('Role-Based Route Protection & Guards', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(api.auth, 'getSession').mockRejectedValue(new Error('Unauthenticated'));
  });

  it('redirects unauthenticated users to login with redirect parameter', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div data-testid="login-view">Login Page</div>} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin', 'dept_head']}>
                  <div data-testid="admin-content">Admin Secret Data</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('login-view')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
  });

  it('blocks citizen role with Access Restricted screen when accessing admin route', async () => {
    localStorage.setItem(
      'jansetu_user',
      JSON.stringify({
        id: 'test-citizen-1',
        name: 'Citizen Rahul',
        email: 'rahul@jansetu.gov.in',
        role: 'citizen',
        phone: '+91 9999999999',
        wardId: 'ward-01',
        departmentId: null,
      })
    );
    localStorage.setItem(
      'jansetu_token',
      'local-jwt-token-123'
    );

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin', 'dept_head', 'ward_officer']}>
                  <div data-testid="admin-content">Admin Secret Data</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/citizen/i)).toBeInTheDocument();
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
  });

  it('grants access to authorized admin role', async () => {
    localStorage.setItem(
      'jansetu_user',
      JSON.stringify({
        id: 'test-admin-1',
        name: 'Chief Municipal Officer',
        email: 'admin@jansetu.gov.in',
        role: 'admin',
        phone: '+91 9999999998',
        wardId: null,
        departmentId: null,
      })
    );
    localStorage.setItem(
      'jansetu_token',
      'local-jwt-token-admin'
    );

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin', 'dept_head', 'ward_officer']}>
                  <div data-testid="admin-content">Admin Secret Data</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Access Restricted/i)).not.toBeInTheDocument();
  });
});
