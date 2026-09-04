import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import de from './locales/de.json';

const resources = {
  en: { translation: en },
  de: { translation: de },
};

// Check if user previously saved a language choice
const savedLang = localStorage.getItem('i18nextLng') || 'en';

i18n.use(initReactI18next).init({
  resources,
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // react already safes from xss
  },
});

export default i18n;
