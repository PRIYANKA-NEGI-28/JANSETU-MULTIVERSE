import { useState, useEffect } from 'react';
import { Home, PenLine, Search, MapPin, Grid3x3, X, Scale, BarChart2, Languages } from 'lucide-react';
import type { Page } from '../types';
import { useLang } from '../lib/langContext';

interface BottomNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const MAIN_TABS: { page: Page; icon: React.ReactNode; label: string }[] = [
  { page: 'home', icon: <Home size={21} />, label: 'Home' },
  { page: 'submit', icon: <PenLine size={21} />, label: 'File' },
  { page: 'track', icon: <Search size={21} />, label: 'Track' },
  { page: 'hazardmap', icon: <MapPin size={21} />, label: 'Map' },
];

export default function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { lang, toggleLang, T } = useLang();
  const isMore = currentPage === 'rti' || currentPage === 'admin';

  const mainTabs = [
    { page: 'home' as Page, icon: <Home size={21} />, label: T.nav_home },
    { page: 'submit' as Page, icon: <PenLine size={21} />, label: T.nav_file },
    { page: 'track' as Page, icon: <Search size={21} />, label: T.nav_track },
    { page: 'hazardmap' as Page, icon: <MapPin size={21} />, label: T.nav_hazard_map },
  ];

  // Close sheet on navigation
  useEffect(() => { setMoreOpen(false); }, [currentPage]);

  return (
    <>
      {/* More sheet — absolute bottom-full = sits directly above the nav bar */}
      {moreOpen && (
        <div className="absolute bottom-full left-0 right-0 z-50 bg-white rounded-t-3xl border-t border-gray-100 shadow-[0_-8px_40px_rgba(0,0,0,0.12)]">
          <div className="px-5 pt-4 pb-5">
            {/* Drag handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-gray-800">{T.nav_more}</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X size={14} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => { onNavigate('rti'); setMoreOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all text-left ${
                  currentPage === 'rti' ? 'bg-orange-50' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  currentPage === 'rti' ? 'bg-orange-100' : 'bg-white border border-gray-200'
                }`}>
                  <Scale size={18} className={currentPage === 'rti' ? 'text-orange-600' : 'text-gray-500'} />
                </div>
                <div>
                  <p className={`font-semibold text-sm ${currentPage === 'rti' ? 'text-orange-700' : 'text-gray-900'}`}>{T.nav_rti}</p>
                  <p className="text-xs text-gray-400">{T.nav_rti_desc}</p>
                </div>
              </button>

              <button
                onClick={() => { onNavigate('admin'); setMoreOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all text-left ${
                  currentPage === 'admin' ? 'bg-orange-50' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  currentPage === 'admin' ? 'bg-orange-100' : 'bg-white border border-gray-200'
                }`}>
                  <BarChart2 size={18} className={currentPage === 'admin' ? 'text-orange-600' : 'text-gray-500'} />
                </div>
                <div>
                  <p className={`font-semibold text-sm ${currentPage === 'admin' ? 'text-orange-700' : 'text-gray-900'}`}>{T.nav_admin}</p>
                  <p className="text-xs text-gray-400">{T.nav_admin_desc}</p>
                </div>
              </button>

              <button
                onClick={() => { toggleLang(); setMoreOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0">
                  <Languages size={18} className="text-orange-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900">{T.nav_language}</p>
                  <p className="text-xs text-gray-400">{lang === 'en' ? T.nav_switch_hi : T.nav_switch_en}</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-stretch bg-white border-t border-gray-100 h-[68px] px-1">
        {mainTabs.map(({ page, icon, label }) => {
          const active = currentPage === page;
          return (
            <button
              key={page}
              onClick={() => { setMoreOpen(false); onNavigate(page); }}
              className="flex-1 flex flex-col items-center justify-center gap-[3px] transition-all"
            >
              <div className={`w-10 h-8 rounded-2xl flex items-center justify-center transition-all ${
                active ? 'bg-orange-500 text-white shadow-md shadow-orange-200' : 'text-gray-400'
              }`}>
                {icon}
              </div>
              <span className={`text-[10px] font-semibold leading-none ${active ? 'text-orange-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </button>
          );
        })}

        {/* More tab */}
        <button
          onClick={() => setMoreOpen(v => !v)}
          className="flex-1 flex flex-col items-center justify-center gap-[3px] transition-all"
        >
          <div className={`w-10 h-8 rounded-2xl flex items-center justify-center transition-all ${
            isMore || moreOpen ? 'bg-orange-500 text-white shadow-md shadow-orange-200' : 'text-gray-400'
          }`}>
            <Grid3x3 size={21} />
          </div>
          <span className={`text-[10px] font-semibold leading-none ${isMore || moreOpen ? 'text-orange-600' : 'text-gray-400'}`}>
            {T.nav_more}
          </span>
        </button>
      </div>
    </>
  );
}
