import { useState } from 'react';
import type { AuthUser } from './lib/auth';
import { LangProvider } from './lib/langContext';
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

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [user, setUser] = useState<AuthUser | null>(null);

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
        <LoginPage onLogin={(u) => setUser(u)} />
      </LangProvider>
    );
  }

  function renderPage() {
    switch (currentPage) {
      case 'home': return <Home onNavigate={navigate} user={user} />;
      case 'submit': return <SubmitComplaint onNavigate={navigate} user={user!} />;
      case 'track': return <TrackComplaint onNavigate={navigate} />;
      case 'admin':
        if (user!.role !== 'admin') {
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
              <BottomNav currentPage={currentPage} onNavigate={navigate} />
            </div>
          </div>
        </div>
      </LangProvider>
    </DashboardProvider>
  );
}
