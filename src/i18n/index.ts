import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import translations
import commonEN from './common/en.json';
import commonFR from './common/fr.json';
import commonNL from './common/nl.json';
import homeEN from './HomeScreen/en.json';
import homeFR from './HomeScreen/fr.json';
import homeNL from './HomeScreen/nl.json';
import routeEN from './RouteScreen/en.json';
import routeFR from './RouteScreen/fr.json';
import routeNL from './RouteScreen/nl.json';

const LANGUAGE_STORAGE_KEY = '@PFSLive:language';

export const LANGUAGES = {
  en: { name: 'English', flag: '🇬🇧' },
  fr: { name: 'Français', flag: '🇫🇷' },
  nl: { name: 'Nederlands', flag: '🇳🇱' },
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

// Save language preference
export const saveLanguage = async (language: LanguageCode) => {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    console.log('✅ Language saved:', language);
  } catch (error) {
    console.error('❌ Error saving language:', error);
  }
};

// Load language preference
export const loadLanguage = async (): Promise<LanguageCode> => {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && (saved === 'en' || saved === 'fr' || saved === 'nl')) {
      console.log('✅ Loaded saved language:', saved);
      return saved as LanguageCode;
    }
  } catch (error) {
    console.error('❌ Error loading language:', error);
  }
  return 'en';
};

// Initialize i18n synchronously with default language
i18n.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  resources: {
    en: {
      common: commonEN,
      home: homeEN,
      route: routeEN,
    },
    fr: {
      common: commonFR,
      home: homeFR,
      route: routeFR,
    },
    nl: {
      common: commonNL,
      home: homeNL,
      route: routeNL,
    },
  },
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'home', 'route'],
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

console.log('✅ i18n initialized');

export default i18n;