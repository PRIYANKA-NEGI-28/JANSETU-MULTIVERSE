import { useState, useEffect } from 'react';
import { Zap, Shield, BarChart2, FileText, LogOut, Languages, MapPin, Scale, Cpu } from 'lucide-react';
import type { AuthUser } from '../lib/auth';
import type { Page } from '../types';
import { useLang } from '../lib/langContext';

interface NavbarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  user: AuthUser | null;
  onLogout: () => void;
}

export default function Navbar({ currentPage, onNavigate, user, onLogout }: NavbarProps) {
  const { lang, toggleLang, T } = useLang();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const allLinks: { label: string; page: Page; icon: React.ReactNode }[] = [
    { label: T.nav_home, page: 'home', icon: <Zap size={16} /> },
    { label: T.nav_track, page: 'track', icon: <Shield size={16} /> },
    { label: T.nav_hazard_map, page: 'hazardmap', icon: <MapPin size={16} /> },
    { label: T.nav_rti, page: 'rti', icon: <Scale size={16} /> },
    { label: T.nav_file, page: 'submit', icon: <FileText size={16} /> },
    { label: T.nav_admin, page: 'admin', icon: <BarChart2 size={16} /> },
    { label: 'IoT Monitor', page: 'iot', icon: <Cpu size={16} /> },
  ];

  const links = user?.role === 'admin'
    ? allLinks.filter(link => link.page === 'admin' || link.page === 'hazardmap' || link.page === 'iot')
    : allLinks.filter(link => link.page !== 'admin' && link.page !== 'iot');

  const displayName = user?.name || 'User';

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 animate-fade-down transition-all duration-300 ${
      isScrolled 
        ? 'bg-white/80 backdrop-blur-md border-b border-gray-200/50 shadow-md' 
        : 'bg-white border-b border-gray-100 shadow-sm'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className={`flex items-center justify-between transition-all duration-300 ${
          isScrolled ? 'h-16' : 'h-20'
        }`}>
          {/* Logo */}
          <div className="flex items-center">
            <button 
              onClick={() => onNavigate('home')} 
              className="flex items-center transition-transform duration-200 hover:scale-105 active:scale-95"
            >
              <img
                src="/images/ChatGPT_Image_Jun_24,_2026,_08_18_26_PM copy copy.png"
                alt="JanSetu"
                className={`h-16 w-auto object-contain transition-all duration-300 ${
                  isScrolled ? 'scale-90' : 'scale-100'
                }`}
              />
            </button>
            <div className="flex items-center gap-1.5 ml-3 px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-full select-none hidden lg:flex relative">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute"></span>
              <span className="text-[10px] font-extrabold text-emerald-700 tracking-wider uppercase pl-3">{T.nav_system_online || 'System Online'}</span>
            </div>
          </div>

          {/* Nav Links */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {links.map(({ label, page, icon }) => (
              <button
                key={page}
                onClick={() => onNavigate(page)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all group relative btn-premium ${
                  page === 'submit' 
                    ? 'bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-900/20'
                    : currentPage === page
                      ? 'bg-orange-50 text-orange-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 nav-link-hover'
                }`}
              >
                <span className="transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110 flex items-center">
                  {icon}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleLang}
              title={lang === 'en' ? 'Switch to Hindi' : 'Switch to English'}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
            >
              <Languages size={14} className="animate-pulse" />
              <span className="hidden sm:inline">{lang === 'en' ? 'हिं' : 'EN'}</span>
            </button>

            <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 hover:shadow-sm transition-all duration-300">
                <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center transition-transform duration-300 hover:rotate-12">
                  <span className="text-white text-xs font-bold">{displayName[0].toUpperCase()}</span>
                </div>
                <span className="text-sm font-medium text-gray-700 max-w-[60px] sm:max-w-[80px] truncate hidden sm:inline">{displayName}</span>
                <button
                  onClick={onLogout}
                  className="text-gray-400 hover:text-red-500 transition-colors duration-200 hover:scale-110 active:scale-90"
                  title={T.nav_sign_out}
                >
                  <LogOut size={14} />
                </button>
              </div>

          </div>
        </div>
      </div>
    </nav>
  );
}

