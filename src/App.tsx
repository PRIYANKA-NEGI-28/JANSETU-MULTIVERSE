import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { LangProvider } from './lib/langContext';
import Navbar from './components/Navbar';
import MobileHeader from './components/MobileHeader';
import BottomNav from './components/BottomNav';
import AdminLogin from './components/AdminLogin';
import Home from './pages/Home';
import SubmitComplaint from './pages/SubmitComplaint';
import TrackComplaint from './pages/TrackComplaint';
import AdminDashboard from './pages/AdminDashboard';
import UserAuth from './pages/UserAuth';
import HazardMap from './pages/HazardMap';
import RTIDrafter from './pages/RTIDrafter';
import type { Page } from './types';
import { DashboardProvider } from './contexts/DashboardContext';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [user, setUser] = useState<User | null>(null);
  const [adminAuthed, setAdminAuthed] = useState(
    sessionStorage.getItem('jansetu_admin_auth') === 'true'
  );
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  function navigate(page: Page) {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    navigate('home');
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
            <span className="text-white font-black text-lg">JS</span>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderPage() {
    if (currentPage === 'admin' && !adminAuthed) {
      return <AdminLogin onSuccess={() => setAdminAuthed(true)} onBack={() => navigate('home')} />;
    }
    if (currentPage === 'login') {
      return <UserAuth onAuthSuccess={() => navigate('home')} onBack={() => navigate('home')} />;
    }
    switch (currentPage) {
      case 'home': return <Home onNavigate={navigate} user={user} />;
      case 'submit': return <SubmitComplaint onNavigate={navigate} user={user} />;
      case 'track': return <TrackComplaint onNavigate={navigate} />;
      case 'admin': return <AdminDashboard onAdminLogout={() => { setAdminAuthed(false); sessionStorage.removeItem('jansetu_admin_auth'); navigate('home'); }} />;
      case 'hazardmap': return <HazardMap onNavigate={navigate} />;
      case 'rti': return <RTIDrafter onNavigate={navigate} />;
      default: return <Home onNavigate={navigate} user={user} />;
    }
  }

  const showBottomNav = currentPage !== 'login';

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

          {/* Mobile: fixed header (mirrors desktop Navbar behaviour so pages' pt-20 works on both) */}
          <div className="md:hidden fixed top-0 inset-x-0 z-50">
            <MobileHeader
              currentPage={currentPage}
              onNavigate={navigate}
              user={user}
              onLogout={handleLogout}
            />
          </div>

          {/* Page content — pb accounts for fixed bottom nav on mobile */}
          <main className="pb-[68px] md:pb-0">
            {renderPage()}
          </main>

          {/* Mobile: fixed bottom navigation */}
          {showBottomNav && (
            <div className="md:hidden fixed bottom-0 inset-x-0 z-50">
              <div className="relative">
                <BottomNav currentPage={currentPage} onNavigate={navigate} />
              </div>
            </div>
          )}
        </div>
      </LangProvider>
    </DashboardProvider>
  );
}
