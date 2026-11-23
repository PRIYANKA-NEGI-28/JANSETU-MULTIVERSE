import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar.js';
import MobileHeader from './MobileHeader.js';
import BottomNav from './BottomNav.js';
import TricolorWaves from '../TricolorWaves.js';
import PageLoader from '../PageLoader.js';

export default function AppShell() {
  return (
    <div className="min-h-screen bg-gray-50 bg-dot-mesh flex flex-col relative text-gray-900 selection:bg-orange-500/20 selection:text-orange-700">
      <TricolorWaves />

      {/* Desktop Header */}
      <div className="hidden md:block">
        <Navbar />
      </div>

      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40">
        <MobileHeader />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 pt-14 md:pt-20 pb-20 md:pb-8 relative z-10">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Mobile Fixed Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40">
        <BottomNav />
      </div>
    </div>
  );
}
