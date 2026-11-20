import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import mr from './locales/mr.json';
import hi from './locales/hi.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'mr', label: 'Marathi', nativeName: 'मराठी' },
  { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी' },
] as const;

export type SupportedLanguage = 'en' | 'mr' | 'hi';

const savedLang = localStorage.getItem('gym_user_language') || 'en';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      mr: { translation: mr },
      hi: { translation: hi },
    },
    lng: ['en', 'mr', 'hi'].includes(savedLang) ? savedLang : 'en',
    fallbackLng: 'en',
    supportedLngs: ['en', 'mr', 'hi'],
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    missingKeyHandler: (lngs, ns, key) => {
      if (import.meta.env?.DEV) {
        console.warn(`[i18n missing key] "${key}" for languages:`, lngs);
      }
    },
    saveMissing: false,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'gym_user_language',
      caches: ['localStorage'],
    },
  });

// Keep html tag lang attribute in sync
if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language || 'en';
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng;
  });
}

export default i18n;
