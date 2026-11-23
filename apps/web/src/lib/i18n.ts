import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { t as sharedTranslations, type Lang } from '@jansetu/shared';

export const SUPPORTED_LANGUAGES: readonly Lang[] = ['en', 'hi'] as const;
export const DEFAULT_LANGUAGE: Lang = 'en';
export const STORAGE_LANG_KEY = 'jansetu_lang';

export function getInitialLanguage(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_LANG_KEY);
    if (saved === 'en' || saved === 'hi') {
      return saved;
    }
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('hi')) {
      return 'hi';
    }
  } catch {
    // LocalStorage or navigator inaccessible
  }
  return DEFAULT_LANGUAGE;
}

const resources = {
  en: {
    translation: sharedTranslations.en,
  },
  hi: {
    translation: sharedTranslations.hi,
  },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
