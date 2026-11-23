import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LangProvider } from './contexts/LangContext.js';
import { AuthProvider } from './contexts/AuthContext.js';
import { ProtectedRoute } from './components/auth/ProtectedRoute.js';
import AppShell from './components/layout/AppShell.js';
import ErrorBoundary from './components/ErrorBoundary.js';
import PageLoader from './components/PageLoader.js';

// Lazy-loaded route chunks for fast initial load
const HomeView = lazy(() => import('./pages/HomeView.js'));
const LoginView = lazy(() => import('./pages/LoginView.js'));
const RegisterView = lazy(() => import('./pages/RegisterView.js'));
const SubmitComplaintView = lazy(() => import('./pages/SubmitComplaintView.js'));
const TrackComplaintView = lazy(() => import('./pages/TrackComplaintView.js'));
const HazardMapView = lazy(() => import('./pages/HazardMapView.js'));
const RtiDrafterView = lazy(() => import('./pages/RtiDrafterView.js'));
const GrievanceOfficerView = lazy(() => import('./pages/GrievanceOfficerView.js'));
const AdminDashboardView = lazy(() => import('./pages/AdminDashboardView.js'));
const IotDashboardView = lazy(() => import('./pages/IotDashboardView.js'));
const NotFoundView = lazy(() => import('./pages/NotFoundView.js'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LangProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<AppShell />}>
                  {/* Public routes */}
                  <Route
                    index
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <HomeView />
                      </Suspense>
                    }
                  />
                  <Route
                    path="login"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <LoginView />
                      </Suspense>
                    }
                  />
                  <Route
                    path="register"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <RegisterView />
                      </Suspense>
                    }
                  />
                  <Route
                    path="track"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <TrackComplaintView />
                      </Suspense>
                    }
                  />
                  <Route
                    path="hazard-map"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <HazardMapView />
                      </Suspense>
                    }
                  />
                  <Route
                    path="rti"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <RtiDrafterView />
                      </Suspense>
                    }
                  />
                  <Route
                    path="grievance"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <GrievanceOfficerView />
                      </Suspense>
                    }
                  />

                  {/* Citizen / Authenticated submission route */}
                  <Route
                    path="submit"
                    element={
                      <ProtectedRoute>
                        <Suspense fallback={<PageLoader />}>
                          <SubmitComplaintView />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />

                  {/* Role-guarded administrative console */}
                  <Route
                    path="admin"
                    element={
                      <ProtectedRoute allowedRoles={['admin', 'dept_head', 'ward_officer']}>
                        <Suspense fallback={<PageLoader />}>
                          <AdminDashboardView />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />

                  {/* Admin-only IoT telemetry console */}
                  <Route
                    path="iot"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <Suspense fallback={<PageLoader />}>
                          <IotDashboardView />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />

                  {/* Catch-all 404 */}
                  <Route
                    path="*"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <NotFoundView />
                      </Suspense>
                    }
                  />
                </Route>
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </LangProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
