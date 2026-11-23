import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  PenLine,
  Search,
  MapPin,
  X,
  Scale,
  BarChart2,
  Languages,
  FileText,
  Cpu,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.js';
import { useLang } from '../../contexts/LangContext.js';

export default function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { user } = useAuth();
  const { lang, toggleLang, T } = useLang();

  const mainTabs = [
    { to: '/', icon: <Home size={20} />, label: T['nav_home'] || 'Home' },
    { to: '/submit', icon: <PenLine size={20} />, label: T['nav_file'] || 'File' },
    { to: '/track', icon: <Search size={20} />, label: T['nav_track'] || 'Track' },
    { to: '/hazard-map', icon: <MapPin size={20} />, label: T['nav_hazard_map'] || 'Hazards' },
  ];

  return (
    <>
      {/* Sliding 'More' drawer modal */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex flex-col justify-end">
          <div
            className="absolute inset-0"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div className="relative bg-white rounded-t-3xl border-t border-gray-100 shadow-2xl p-5 z-10 animate-fade-up max-h-[80vh] overflow-y-auto">
            {/* Grab handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-gray-900">{T['nav_more'] || 'More Services'}</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-2">
              <NavLink
                to="/rti"
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-left ${
                    isActive ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50 hover:bg-gray-100'
                  }`
                }
              >
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                  <Scale size={18} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900">{T['nav_rti'] || 'RTI Drafter'}</p>
                  <p className="text-xs text-gray-500">Draft statutory Section 6(1) applications</p>
                </div>
              </NavLink>

              <NavLink
                to="/grievance"
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-left ${
                    isActive ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50 hover:bg-gray-100'
                  }`
                }
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900">Grievance AI Assistant</p>
                  <p className="text-xs text-gray-500">Multilingual legal grievance drafting</p>
                </div>
              </NavLink>

              {user && (user.role === 'admin' || user.role === 'dept_head' || user.role === 'ward_officer') && (
                <NavLink
                  to="/admin"
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-left ${
                      isActive ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50 hover:bg-gray-100'
                    }`
                  }
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                    <BarChart2 size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{T['nav_admin'] || 'Admin Console'}</p>
                    <p className="text-xs text-gray-500">Cluster assignment & SLA metrics</p>
                  </div>
                </NavLink>
              )}

              {user?.role === 'admin' && (
                <NavLink
                  to="/iot"
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-left ${
                      isActive ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 hover:bg-gray-100'
                    }`
                  }
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Cpu size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">IoT Telemetry</p>
                    <p className="text-xs text-gray-500">Live streetlight hardware sensor monitor</p>
                  </div>
                </NavLink>
              )}

              <button
                onClick={() => {
                  toggleLang();
                  setMoreOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                  <Languages size={18} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900">{T['nav_language'] || 'Language'}</p>
                  <p className="text-xs text-gray-500">
                    {lang === 'en' ? 'Switch to Hindi (हिन्दी)' : 'Switch to English'}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed bottom navigation bar */}
      <nav className="bg-white border-t border-gray-100 px-2 py-1 shadow-lg flex items-center justify-around h-16 safe-bottom">
        {mainTabs.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isActive ? 'text-orange-600 font-bold' : 'text-gray-500 hover:text-gray-700'
              }`
            }
          >
            <div className="mb-0.5">{icon}</div>
            <span className="text-[10px] leading-tight">{label}</span>
          </NavLink>
        ))}

        <button
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            moreOpen ? 'text-orange-600 font-bold' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="w-5 h-5 flex flex-col items-center justify-center gap-0.5 mb-0.5">
            <span className="w-1 h-1 rounded-full bg-current" />
            <span className="w-1 h-1 rounded-full bg-current" />
            <span className="w-1 h-1 rounded-full bg-current" />
          </div>
          <span className="text-[10px] leading-tight">{T['nav_more'] || 'More'}</span>
        </button>
      </nav>
    </>
  );
}
