import { ChevronLeft, Languages, LogOut, User } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Page } from '../types';
import { useLang } from '../lib/langContext';

interface MobileHeaderProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  user: SupabaseUser | null;
  onLogout: () => void;
}

export default function MobileHeader({ currentPage, onNavigate, user, onLogout }: MobileHeaderProps) {
  const { lang, toggleLang, T } = useLang();
  const isHome = currentPage === 'home';
  const title = currentPage === 'submit' ? T.nav_file
    : currentPage === 'track' ? T.nav_track
    : currentPage === 'admin' ? T.nav_admin
    : currentPage === 'hazardmap' ? T.nav_hazard_map
    : currentPage === 'rti' ? T.nav_rti
    : currentPage === 'login' ? T.nav_login
    : undefined;
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';

  return (
    <div className="flex items-center justify-between h-14 px-4 bg-white border-b border-gray-100">
      {/* Left */}
      {isHome ? (
        <button onClick={() => onNavigate('home')}>
          <img
            src="/images/ChatGPT_Image_Jun_24,_2026,_08_18_26_PM copy copy.png"
            alt="JanSetu"
            className="h-9 w-auto object-contain"
          />
        </button>
      ) : (
        <button
          onClick={() => onNavigate('home')}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <ChevronLeft size={20} className="text-gray-700" />
        </button>
      )}

      {/* Center title */}
      {!isHome && title && (
        <span className="absolute left-1/2 -translate-x-1/2 text-sm font-bold text-gray-900">{title}</span>
      )}

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleLang}
          className="px-2.5 py-1.5 rounded-lg bg-orange-50 border border-orange-100 text-orange-600 text-xs font-bold transition-colors hover:bg-orange-100"
        >
          {lang === 'en' ? 'हिं' : 'EN'}
        </button>

        {user ? (
          <button
            onClick={onLogout}
            className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center relative group"
            title={`Sign out (${displayName})`}
          >
            <span className="text-white text-xs font-bold group-hover:hidden">
              {displayName[0]?.toUpperCase() || 'U'}
            </span>
            <LogOut size={14} className="text-white hidden group-hover:block" />
          </button>
        ) : (
          <button
            onClick={() => onNavigate('login')}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <User size={16} className="text-gray-600" />
          </button>
        )}
      </div>
    </div>
  );
}
