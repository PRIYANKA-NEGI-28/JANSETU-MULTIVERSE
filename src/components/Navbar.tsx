import { Zap, Shield, BarChart2, FileText, User, LogOut, Languages, MapPin, Scale } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Page } from '../types';
import { useLang } from '../lib/langContext';

interface NavbarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  user: SupabaseUser | null;
  onLogout: () => void;
}

export default function Navbar({ currentPage, onNavigate, user, onLogout }: NavbarProps) {
  const { lang, toggleLang, T } = useLang();

  const links: { label: string; page: Page; icon: React.ReactNode }[] = [
    { label: T.nav_home, page: 'home', icon: <Zap size={16} /> },
    { label: T.nav_file, page: 'submit', icon: <FileText size={16} /> },
    { label: T.nav_track, page: 'track', icon: <Shield size={16} /> },
    { label: T.nav_hazard_map, page: 'hazardmap', icon: <MapPin size={16} /> },
    { label: T.nav_rti, page: 'rti', icon: <Scale size={16} /> },
    { label: T.nav_admin, page: 'admin', icon: <BarChart2 size={16} /> },
  ];

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <button onClick={() => onNavigate('home')} className="flex items-center">
            <img
              src="/images/ChatGPT_Image_Jun_24,_2026,_08_18_26_PM copy copy.png"
              alt="JanSetu"
              className="h-16 w-auto object-contain"
            />
          </button>

          {/* Nav Links */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {links.map(({ label, page, icon }) => (
              <button
                key={page}
                onClick={() => onNavigate(page)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  currentPage === page
                    ? 'bg-orange-50 text-orange-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleLang}
              title={lang === 'en' ? 'Switch to Hindi' : 'Switch to English'}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-semibold transition-all"
            >
              <Languages size={14} />
              <span className="hidden sm:inline">{lang === 'en' ? 'हिं' : 'EN'}</span>
            </button>

            {user ? (
              <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
                <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{displayName[0].toUpperCase()}</span>
                </div>
                <span className="text-sm font-medium text-gray-700 max-w-[60px] sm:max-w-[80px] truncate hidden sm:inline">{displayName}</span>
                <button
                  onClick={onLogout}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title={T.nav_sign_out}
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => onNavigate('login')}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 border border-gray-200 text-gray-700 text-xs sm:text-sm font-medium rounded-lg hover:bg-gray-50 transition-all"
              >
                <User size={14} />
                <span className="hidden sm:inline">{T.nav_login}</span>
              </button>
            )}

            <button
              onClick={() => onNavigate('submit')}
              className="px-3 sm:px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow-md"
            >
              {T.nav_file_btn}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
