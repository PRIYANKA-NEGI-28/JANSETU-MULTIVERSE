import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t, type Lang } from '@jansetu/shared';

export type TranslationDictionary = typeof t.en;

export interface LanguageContextValue {
  readonly lang: Lang;
  readonly setLang: (newLang: Lang) => void;
  readonly toggleLang: () => void;
  readonly T: TranslationDictionary;
}

const STORAGE_KEY = 'jansetu_lang';

export const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  toggleLang: () => {},
  T: t.en,
});

export function LanguageProvider({ children }: { readonly children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'hi' || stored === 'en') {
          setLangState(stored);
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
    }
  }, [lang, isLoaded]);

  const setLang = (newLang: Lang): void => setLangState(newLang);
  const toggleLang = (): void => setLangState((prev) => (prev === 'en' ? 'hi' : 'en'));

  const activeTranslations = (t[lang] || t.en) as TranslationDictionary;

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        toggleLang,
        T: activeTranslations,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang(): LanguageContextValue {
  return useContext(LanguageContext);
}
