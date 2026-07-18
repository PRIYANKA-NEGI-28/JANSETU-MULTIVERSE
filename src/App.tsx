import { useState, useEffect } from 'react';
import type { AuthUser } from './lib/auth';
import { LangProvider } from './lib/langContext';
import { LocationProvider, useLocation } from './contexts/LocationContext';
import Navbar from './components/Navbar';
import MobileHeader from './components/MobileHeader';
import BottomNav from './components/BottomNav';
import LoginPage from './pages/LoginPage';
import Home from './pages/Home';
import SubmitComplaint from './pages/SubmitComplaint';
import TrackComplaint from './pages/TrackComplaint';
import AdminDashboard from './pages/AdminDashboard';
import HazardMap from './pages/HazardMap';
import RTIDrafter from './pages/RTIDrafter';
import type { Page } from './types';
import { DashboardProvider } from './contexts/DashboardContext';

function AuthenticatedApp({
  currentPage,
  navigate,
  user,
  handleLogout,
}: {
  currentPage: Page;
  navigate: (page: Page) => void;
  user: AuthUser;
  handleLogout: () => void;
}) {
  const { lat, lng, permission, requestLocation } = useLocation();

  function renderPage() {
    switch (currentPage) {
      case 'home': return <Home onNavigate={navigate} user={user} />;
      case 'submit': return (
        <SubmitComplaint
          onNavigate={navigate}
          user={user}
          location={{ lat, lng, permission }}
          onRequestLocation={requestLocation}
        />
      );
      case 'track': return <TrackComplaint onNavigate={navigate} user={user} />;
      case 'admin':
        if (user.role !== 'admin') {
          return <Home onNavigate={navigate} user={user} />;
        }
        return <AdminDashboard onAdminLogout={() => navigate('home')} />;
      case 'hazardmap': return <HazardMap onNavigate={navigate} />;
      case 'rti': return <RTIDrafter onNavigate={navigate} />;
      default: return <Home onNavigate={navigate} user={user} />;
    }
  }

  return (
    <DashboardProvider>
      <LangProvider>
        <div className="min-h-screen bg-gray-50">
          {/* Desktop: full-width fixed Navbar */}
          <div className="hidden md:block">
            <Navbar
              currentPage={currentPage}
              onNavigate={navigate}
              user={user}
              onLogout={handleLogout}
            />
          </div>

          {/* Mobile: fixed header */}
          <div className="md:hidden fixed top-0 inset-x-0 z-50">
            <MobileHeader
              currentPage={currentPage}
              onNavigate={navigate}
              user={user}
              onLogout={handleLogout}
            />
          </div>

          {/* Page content */}
          <main className="pb-[68px] md:pb-0">
            {renderPage()}
          </main>

          {/* Mobile: fixed bottom navigation */}
          <div className="md:hidden fixed bottom-0 inset-x-0 z-50">
            <div className="relative">
              <BottomNav currentPage={currentPage} onNavigate={navigate} user={user} />
            </div>
          </div>
        </div>
      </LangProvider>
    </DashboardProvider>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const savedUser = localStorage.getItem('jansetu_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [currentPage, setCurrentPage] = useState<Page>(() => {
    const savedUser = localStorage.getItem('jansetu_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      return parsed.role === 'admin' ? 'admin' : 'home';
    }
    return 'home';
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('jansetu_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('jansetu_user');
    }
  }, [user]);

  function navigate(page: Page) {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  }

  function handleLogout() {
    setUser(null);
    setCurrentPage('home');
  }

  // Login gate — show login page before anything else in the app
  if (!user) {
    return (
      <LangProvider>
        <LoginPage onLogin={(u) => {
          setUser(u);
          setCurrentPage(u.role === 'admin' ? 'admin' : 'home');
        }} />
      </LangProvider>
    );
  }

  return (
    <LocationProvider>
      <AuthenticatedApp
        currentPage={currentPage}
        navigate={navigate}
        user={user}
        handleLogout={handleLogout}
      />
    </LocationProvider>
  );
}
