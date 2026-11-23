import { ChevronLeft, LogOut, LogIn } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.js';
import { useLang } from '../../contexts/LangContext.js';

export default function MobileHeader() {
  const { user, isAuthenticated, logout } = useAuth();
  const { lang, toggleLang, T } = useLang();
  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === '/';

  const getPageTitle = (): string | null => {
    switch (location.pathname) {
      case '/submit':
        return T['nav_file'] || 'File Complaint';
      case '/track':
        return T['nav_track'] || 'Track Issue';
      case '/hazard-map':
        return T['nav_hazard_map'] || 'Hazard Map';
      case '/rti':
        return T['nav_rti'] || 'RTI Drafter';
      case '/grievance':
        return 'Grievance AI';
      case '/admin':
        return T['nav_admin'] || 'Admin Console';
      case '/iot':
        return 'IoT Monitor';
      case '/login':
        return 'Sign In';
      case '/register':
        return 'Register';
      default:
        return null;
    }
  };

  const title = getPageTitle();
  const displayName = user?.name || '';

  return (
    <header className="flex items-center justify-between h-14 px-4 bg-white border-b border-gray-100 shadow-xs">
      {/* Left Action: Home Brand or Back Button */}
      {isHome ? (
        <Link to="/" className="transition-transform duration-200 active:scale-95">
          <img
            src="/images/ChatGPT_Image_Jun_24,_2026,_08_18_26_PM copy copy.png"
            alt="JanSetu"
            className="h-9 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </Link>
      ) : (
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all duration-200 active:scale-90"
          title="Back"
        >
          <ChevronLeft size={20} />
        </button>
      )}

      {/* Center Title */}
      {!isHome && title && (
        <span className="absolute left-1/2 -translate-x-1/2 text-sm font-bold text-gray-900 truncate max-w-[160px]">
          {title}
        </span>
      )}

      {/* Right Actions: Lang Switcher & Profile / Login */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleLang}
          className="px-2.5 py-1 rounded-lg bg-orange-50 border border-orange-100 text-orange-600 text-xs font-bold transition-all duration-200 hover:bg-orange-100 active:scale-95"
        >
          {lang === 'en' ? 'हिं' : 'EN'}
        </button>

        {isAuthenticated && user ? (
          <button
            onClick={() => void logout()}
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-orange-600 flex items-center justify-center relative group transition-all duration-300 active:scale-90 text-white text-xs font-bold shadow-xs"
            title={`Sign out (${displayName})`}
          >
            <span className="group-hover:hidden">{displayName[0]?.toUpperCase() || 'U'}</span>
            <LogOut size={14} className="hidden group-hover:block" />
          </button>
        ) : (
          <Link
            to="/login"
            className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center shadow-xs active:scale-90"
            title="Sign In"
          >
            <LogIn size={15} />
          </Link>
        )}
      </div>
    </header>
  );
}
