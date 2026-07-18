import { createContext, useContext, useState, useEffect } from 'react';
import type { Lang } from './i18n';
import { t } from './i18n';

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  T: typeof t.en;
}

export const LangContext = createContext<LangContextValue>({
  lang: 'en',
  setLang: () => {},
  toggleLang: () => {},
  T: t.en,
});

const STORAGE_KEY = 'jansetu_lang';

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'hi' || stored === 'en') return stored;
    }
    return 'en';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
  }, [lang]);

  const setLang = (newLang: Lang) => setLangState(newLang);
  const toggleLang = () => setLangState(l => (l === 'en' ? 'hi' : 'en'));

  return (
    <LangContext.Provider value={{ lang, setLang, toggleLang, T: t[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
