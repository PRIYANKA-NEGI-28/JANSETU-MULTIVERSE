import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { t as sharedTranslations, type Lang } from '@jansetu/shared';
import { STORAGE_LANG_KEY } from '../lib/i18n.js';

export type TranslationValue = string | ((...args: string[]) => string);
export type TranslationRecord = Record<string, TranslationValue>;

export interface LangContextType {
  readonly lang: Lang;
  readonly setLang: (lang: Lang) => void;
  readonly toggleLang: () => void;
  readonly T: Record<string, string>;
  readonly t: (key: string, fallback?: string) => string;
}

const LangContext = createContext<LangContextType | null>(null);

export function LangProvider({ children }: { readonly children: ReactNode }) {
  const { i18n, t: translate } = useTranslation();
  const [lang, setLangState] = useState<Lang>(() => (i18n.language === 'hi' ? 'hi' : 'en'));

  const setLang = useCallback(
    (newLang: Lang) => {
      setLangState(newLang);
      void i18n.changeLanguage(newLang);
      try {
        localStorage.setItem(STORAGE_LANG_KEY, newLang);
      } catch {
        // Ignored
      }
    },
    [i18n]
  );

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'hi' : 'en');
  }, [lang, setLang]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_LANG_KEY && (e.newValue === 'en' || e.newValue === 'hi')) {
        setLangState(e.newValue);
        void i18n.changeLanguage(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [i18n]);

  const rawDict = (sharedTranslations[lang] as unknown) as TranslationRecord;

  // Build clean string-only lookup for T dictionary
  const stringDict: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawDict)) {
    if (typeof v === 'string') {
      stringDict[k] = v;
    }
  }

  const safeTranslate = useCallback(
    (key: string, fallback?: string): string => {
      const val = rawDict[key];
      if (typeof val === 'string') return val;
      if (typeof val === 'function') return val(fallback ?? '');
      const fromI18n = translate(key);
      if (fromI18n && fromI18n !== key) return fromI18n;
      return fallback ?? key;
    },
    [rawDict, translate]
  );

  const value: LangContextType = {
    lang,
    setLang,
    toggleLang,
    T: stringDict,
    t: safeTranslate,
  };

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextType {
  const context = useContext(LangContext);
  if (!context) {
    throw new Error('useLang must be used within a LangProvider');
  }
  return context;
}
