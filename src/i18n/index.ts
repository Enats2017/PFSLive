import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

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

/**
 * Get device language and map to supported language
 */
const getDeviceLanguage = (): LanguageCode => {
  try {
    // Try to get device locale using multiple methods
    let deviceLocale = Localization.locale;
    
    // Fallback methods if locale is undefined
    if (!deviceLocale) {
      // Try getLocales array (newer API)
      const locales = Localization.getLocales();
      if (locales && locales.length > 0) {
        deviceLocale = locales[0].languageCode || 'en';
      }
    }
    
    // If still undefined, use default
    if (!deviceLocale) {
      console.warn('⚠️ Could not detect device locale, using English');
      return 'en';
    }
    
    console.log('📱 Device locale:', deviceLocale);
    
    // Extract language code (first 2 letters)
    // Handle both "en-US" format and "en" format
    const languageCode = String(deviceLocale).split('-')[0].toLowerCase();
    
    console.log('📱 Device language code:', languageCode);
    
    // Check if device language is supported
    if (languageCode === 'en' || languageCode === 'fr' || languageCode === 'nl') {
      console.log('✅ Device language is supported:', languageCode);
      return languageCode as LanguageCode;
    }
    
    // Fallback to English if not supported
    console.log('⚠️ Device language not supported, using English');
    return 'en';
  } catch (error) {
    console.error('❌ Error detecting device language:', error);
    return 'en';
  }
};

/**
 * Save language to storage
 */
export const saveLanguage = async (language: LanguageCode) => {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    console.log('✅ Language saved to storage:', language);
  } catch (error) {
    console.error('❌ Error saving language:', error);
  }
};

/**
 * Load language from storage, or use device language if not found
 */
export const loadLanguage = async (): Promise<LanguageCode> => {
  try {
    // Check if language is stored
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    
    if (saved && (saved === 'en' || saved === 'fr' || saved === 'nl')) {
      console.log('✅ Loaded language from storage:', saved);
      return saved as LanguageCode;
    }
    
    // No stored language, use device language
    console.log('ℹ️ No stored language, detecting device language...');
    const deviceLanguage = getDeviceLanguage();
    
    // Save device language for next time
    await saveLanguage(deviceLanguage);
    
    return deviceLanguage;
  } catch (error) {
    console.error('❌ Error loading language:', error);
    return 'en';
  }
};

/**
 * Get initial language for i18n initialization
 * This runs synchronously at module load time
 */
const getInitialLanguage = (): LanguageCode => {
  try {
    return getDeviceLanguage();
  } catch (error) {
    console.error('❌ Error getting initial language:', error);
    return 'en';
  }
};

// Initialize i18n synchronously with device language as default
const initialLanguage = getInitialLanguage();

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
  lng: initialLanguage,
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

console.log('✅ i18n initialized with language:', initialLanguage);

export default i18n;