import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lang } from './i18n';
import { t } from './i18n';

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  T: (typeof t)['en'] | (typeof t)['hi'];
}

export const LangContext = createContext<LangContextValue>({
  lang: 'en',
  setLang: () => {},
  toggleLang: () => {},
  T: t.en,
});

const STORAGE_KEY = 'jansetu_lang';

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'hi' || stored === 'en') {
        setLangState(stored);
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem(STORAGE_KEY, lang);
    }
  }, [lang, loaded]);

  const setLang = (newLang: Lang) => setLangState(newLang);
  const toggleLang = () => setLangState((l) => (l === 'en' ? 'hi' : 'en'));

  return (
    <LangContext.Provider value={{ lang, setLang, toggleLang, T: t[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
