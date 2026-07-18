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
import IoTDashboard from './pages/IoTDashboard';
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
  const [fadePage, setFadePage] = useState<Page>(currentPage);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    setIsFading(true);
    const timer = setTimeout(() => {
      setFadePage(currentPage);
      setIsFading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [currentPage]);

  function renderPage() {
    switch (fadePage) {
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
      case 'hazardmap': return <HazardMap onNavigate={navigate} user={user} />;
      case 'rti': return <RTIDrafter onNavigate={navigate} />;
      case 'iot': 
        if (user?.role !== 'admin') {
          return <Home onNavigate={navigate} user={user} />;
        }
        return <IoTDashboard onNavigate={navigate} />;
      default: return <Home onNavigate={navigate} user={user} />;
    }
  }

  return (
    <DashboardProvider>
      <LangProvider>
        <div className="min-h-screen bg-gray-50 bg-dot-mesh">
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
          <main className={`pb-[68px] md:pb-0 transition-opacity duration-200 ease-in-out ${isFading ? 'opacity-0' : 'opacity-100'}`}>
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

  const [showPreloader, setShowPreloader] = useState(true);
  const [fadePreloader, setFadePreloader] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem('jansetu_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('jansetu_user');
    }
  }, [user]);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFadePreloader(true);
      const removeTimer = setTimeout(() => {
        setShowPreloader(false);
      }, 500);
      return () => clearTimeout(removeTimer);
    }, 1200);
    return () => clearTimeout(fadeTimer);
  }, []);

  function navigate(page: Page) {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  }

  function handleLogout() {
    setUser(null);
    setCurrentPage('home');
  }

  function renderContent() {
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

  return (
    <>
      {showPreloader && (
        <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gray-950 transition-opacity duration-500 ${fadePreloader ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="text-center">
            <div className="inline-flex items-center gap-3 mb-6 animate-pulse">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-2xl">
                <span className="text-white font-black text-2xl">JS</span>
              </div>
              <div className="text-left">
                <div className="font-black text-4xl text-white tracking-tight">JanSetu</div>
                <div className="text-xs text-orange-500 font-bold uppercase tracking-widest">Multiverse</div>
              </div>
            </div>
            {/* Elegant spinner */}
            <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mx-auto mt-4" />
          </div>
        </div>
      )}
      {renderContent()}
    </>
  );
}
