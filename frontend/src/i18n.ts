import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const backendUrl = API_URL.replace('/api', '');

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR', 'en-US', 'es', 'fr', 'de'],
    defaultNS: 'common',
    ns: ['common', 'dashboard', 'clone', 'editor', 'settings'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'dexter_language',
      caches: ['localStorage'],
    },
    backend: {
      loadPath: backendUrl + '/locales/{{lng}}/{{ns}}.json',
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
