import { ChevronLeft, LogOut } from 'lucide-react';
import type { AuthUser } from '../lib/auth';
import type { Page } from '../types';
import { useLang } from '../lib/langContext';

interface MobileHeaderProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  user: AuthUser | null;
  onLogout: () => void;
}

export default function MobileHeader({ currentPage, onNavigate, user, onLogout }: MobileHeaderProps) {
  const { lang, toggleLang, T } = useLang();
  const isHome = currentPage === 'home' || (user?.role === 'admin' && currentPage === 'admin');
  const goHome = () => onNavigate(user?.role === 'admin' ? 'admin' : 'home');
  const title = currentPage === 'submit' ? T.nav_file
    : currentPage === 'track' ? T.nav_track
    : currentPage === 'admin' ? T.nav_admin
    : currentPage === 'hazardmap' ? T.nav_hazard_map
    : currentPage === 'rti' ? T.nav_rti
    : undefined;
  const displayName = user?.name || '';

  return (
    <div className="flex items-center justify-between h-14 px-4 bg-white border-b border-gray-100">
      {/* Left */}
      {isHome ? (
        <button onClick={goHome} className="transition-transform duration-200 active:scale-95">
          <img
            src="/images/ChatGPT_Image_Jun_24,_2026,_08_18_26_PM copy copy.png"
            alt="JanSetu"
            className="h-9 w-auto object-contain"
          />
        </button>
      ) : (
        <button
          onClick={goHome}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition-all duration-200 active:scale-90"
        >
          <ChevronLeft size={20} className="text-gray-700" />
        </button>
      )}

      {/* Center title */}
      {!isHome && title && (
        <span className="absolute left-1/2 -translate-x-1/2 text-sm font-bold text-gray-900 animate-fade-down">{title}</span>
      )}

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleLang}
          className="px-2.5 py-1.5 rounded-lg bg-orange-50 border border-orange-100 text-orange-600 text-xs font-bold transition-all duration-200 hover:bg-orange-100 active:scale-95"
        >
          {lang === 'en' ? 'हिं' : 'EN'}
        </button>

        <button
            onClick={onLogout}
            className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center relative group transition-all duration-300 active:scale-90"
            title={`Sign out (${displayName})`}
          >
            <span className="text-white text-xs font-bold group-hover:hidden transition-opacity">
              {displayName[0]?.toUpperCase() || 'U'}
            </span>
            <LogOut size={14} className="text-white hidden group-hover:block transition-all" />
          </button>
      </div>
    </div>
  );
}
