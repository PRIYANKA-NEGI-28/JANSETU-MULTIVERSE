import { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Zap,
  Shield,
  BarChart2,
  FileText,
  LogOut,
  Languages,
  MapPin,
  Scale,
  Cpu,
  LogIn,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.js';
import { useLang } from '../../contexts/LangContext.js';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { lang, toggleLang, T } = useLang();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const allLinks = [
    { label: T['nav_home'] || 'Home', to: '/', icon: <Zap size={16} />, public: true },
    { label: T['nav_track'] || 'Track Status', to: '/track', icon: <Shield size={16} />, public: true },
    { label: T['nav_hazard_map'] || 'Hazard Map', to: '/hazard-map', icon: <MapPin size={16} />, public: true },
    { label: T['nav_rti'] || 'RTI Drafter', to: '/rti', icon: <Scale size={16} />, public: true },
    { label: 'Grievance AI', to: '/grievance', icon: <FileText size={16} />, public: true },
    { label: T['nav_file'] || 'File Complaint', to: '/submit', icon: <FileText size={16} />, highlight: true, public: true },
    {
      label: T['nav_admin'] || 'Admin Console',
      to: '/admin',
      icon: <BarChart2 size={16} />,
      roles: ['admin', 'dept_head', 'ward_officer'],
    },
    {
      label: 'IoT Telemetry',
      to: '/iot',
      icon: <Cpu size={16} />,
      roles: ['admin'],
    },
  ];

  const visibleLinks = allLinks.filter((link) => {
    if (link.public && !link.roles) return true;
    if (link.roles && user) {
      return link.roles.includes(user.role);
    }
    return false;
  });

  const displayName = user?.name || 'Citizen';

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/85 backdrop-blur-md border-b border-gray-200/70 shadow-sm'
          : 'bg-white border-b border-gray-100 shadow-xs'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className={`flex items-center justify-between transition-all duration-300 ${isScrolled ? 'h-16' : 'h-20'}`}>
          {/* Logo & Status Badge */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center transition-transform duration-200 hover:scale-102 active:scale-98">
              <img
                src="/images/ChatGPT_Image_Jun_24,_2026,_08_18_26_PM copy copy.png"
                alt="JanSetu"
                className={`w-auto object-contain transition-all duration-300 ${isScrolled ? 'h-12' : 'h-14'}`}
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('.fallback-logo')) {
                    const fallback = document.createElement('div');
                    fallback.className = 'fallback-logo font-black text-2xl text-orange-600 tracking-tight';
                    fallback.innerText = 'JanSetu';
                    parent.appendChild(fallback);
                  }
                }}
              />
            </Link>
            <div className="flex items-center gap-1.5 ml-3 px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-full select-none hidden lg:flex relative">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute" />
              <span className="text-[10px] font-extrabold text-emerald-700 tracking-wider uppercase pl-3">
                {T['nav_system_online'] || 'System Online'}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1">
            {visibleLinks.map(({ label, to, icon, highlight }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all group relative btn-premium ${
                    highlight
                      ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm shadow-green-900/20'
                      : isActive
                        ? 'bg-orange-50 text-orange-600 font-semibold'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 nav-link-hover'
                  }`
                }
              >
                <span className="transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110 flex items-center">
                  {icon}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </div>

          {/* Right Action Controls: Language Toggle & User Session */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleLang}
              title={lang === 'en' ? 'Switch to Hindi (हिन्दी)' : 'Switch to English'}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold transition-all hover:scale-105 active:scale-95"
            >
              <Languages size={14} className="text-orange-600" />
              <span>{lang === 'en' ? 'हिन्दी' : 'EN'}</span>
            </button>

            {isAuthenticated && user ? (
              <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 hover:shadow-xs transition-all duration-300">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-orange-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                  {displayName[0]?.toUpperCase() || 'U'}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-semibold text-gray-800 max-w-[90px] truncate leading-tight">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50 ml-1"
                  title={T['nav_sign_out'] || 'Sign Out'}
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                <LogIn size={14} />
                <span className="hidden sm:inline">{T['nav_login'] || 'Sign In'}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
