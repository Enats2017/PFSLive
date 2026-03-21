import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

// ✅ COMMON TRANSLATIONS
import commonEN from './common/en.json';
import commonFR from './common/fr.json';
import commonNL from './common/nl.json';

// ✅ HOME SCREEN
import homeEN from './HomeScreen/en.json';
import homeFR from './HomeScreen/fr.json';
import homeNL from './HomeScreen/nl.json';

import raceResultEN from "./RaceResult/en.json";
import raceResultFR from "./RaceResult/fr.json";
import raceResultNL from "./RaceResult/nl.json";

import ResultListEN from "./ResultList/en.json";
import ResultListFr from   "./ResultList/fr.json";
import ResultListNL from "./ResultList/nl.json";

import eventEN from './ParticipantEvent/en.json';
import eventFR from './ParticipantEvent/fr.json';
import eventNL from './ParticipantEvent/nl.json';

// ✅ PERSONAL EVENT
import personalEventEN from "./PersonalEvent/en.json";
import personalEventFR from './PersonalEvent/fr.json';
import personalEventNL from './PersonalEvent/nl.json';

// ✅ EVENT DETAILS
import detailsEN from './EventDetails/en.json';
import detailsFR from './EventDetails/fr.json';
import detailsNL from './EventDetails/nl.json';

// ✅ PARTICIPANT RESULT
import participantResultEN from './ParticipantResult/en.json';
import participantResultFR from './ParticipantResult/fr.json';
import participantResultNL from './ParticipantResult/nl.json';

// ✅ REGISTER SCREEN
import registerEN from './RegisterScreen/en.json';
import registerFR from './RegisterScreen/fr.json';
import registerNL from './RegisterScreen/nl.json';

// ✅ LOGIN SCREEN
import loginEN from './LoginScreen/en.json';
import loginFR from './LoginScreen/fr.json';
import loginNL from './LoginScreen/nl.json';

// ✅ OTP SCREEN
import otpEN from './OtpScreen/en.json';
import otpFR from './OtpScreen/fr.json';
import otpNL from './OtpScreen/nl.json';

// ✅ CONFIRM RACE RESULT MODAL
import confirmModalEN from './ConfirmModal/en.json';
import confirmModalFR from './ConfirmModal/fr.json';
import confirmModalNL from './ConfirmModal/nl.json';

// ✅ UNDO CONFIRM MODAL
import undoModalEN from './UndoModal/en.json';
import undoModalFR from './UndoModal/fr.json';
import undoModalNL from './UndoModal/nl.json';

// ✅ ERROR MODAL
import errorModalEN from './ErrorModal/en.json';
import errorModalFR from './ErrorModal/fr.json';
import errorModalNL from './ErrorModal/nl.json';

import ProfileEN from "./ProfileScreen/en.json";
import ProfileFR from "./ProfileScreen/fr.json";
import ProfileNL from "./ProfileScreen/nl.json";

import ResultDetailsEN from "./Resultdetails/en.json";
import ResultDetailsFR from "./Resultdetails/fr.json";
import ResultDetailsNL from "./Resultdetails/nl.json";

import FollowerEN from "./FollowerEvent/en.json";
import FollowerFR from "./FollowerEvent/fr.json";
import FollowerNL from "./FollowerEvent/nl.json";

import ForgetEN from "./ForgotPassword/en.json";
import ForgetFR from "./ForgotPassword/fr.json";
import ForgetNL from "./ForgotPassword/nl.json";

import LiveTrackingEN from "./livetracking/en.json";
import LiveTrackingFR from "./livetracking/fr.json";
import LiveTrackingNL from "./livetracking/nl.json";

import FavouriteEN from "./FavouriteList/en.json";
import FavouriteFR from "./FavouriteList/fr.json";
import FavouriteNL from "./FavouriteList/nl.json";

const LANGUAGE_STORAGE_KEY = '@PFSLive:language';

export const LANGUAGES = {
  en: { name: 'English', flag: '🇬🇧', id: 1 },
  fr: { name: 'Français', flag: '🇫🇷', id: 3 },
  nl: { name: 'Nederlands', flag: '🇳🇱', id: 2 },
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

/**
 * Get device language and map to supported language
 */
const getDeviceLanguage = (): LanguageCode => {
  try {
    let deviceLocale = Localization.locale;

    if (!deviceLocale) {
      const locales = Localization.getLocales();
      if (locales && locales.length > 0) {
        deviceLocale = locales[0].languageCode || 'en';
      }
    }

    if (!deviceLocale) {
      console.warn('⚠️ Could not detect device locale, using English');
      return 'en';
    }

    console.log('📱 Device locale:', deviceLocale);

    const languageCode = String(deviceLocale).split('-')[0].toLowerCase();

    console.log('📱 Device language code:', languageCode);

    if (languageCode === 'en' || languageCode === 'fr' || languageCode === 'nl') {
      console.log('✅ Device language is supported:', languageCode);
      return languageCode as LanguageCode;
    }

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
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);

    if (saved && (saved === 'en' || saved === 'fr' || saved === 'nl')) {
      console.log('✅ Loaded language from storage:', saved);
      return saved as LanguageCode;
    }

    console.log('ℹ️ No stored language, detecting device language...');
    const deviceLanguage = getDeviceLanguage();

    await saveLanguage(deviceLanguage);

    return deviceLanguage;
  } catch (error) {
    console.error('❌ Error loading language:', error);
    return 'en';
  }
};

/**
 * Get language ID from language code
 */
export const getLanguageId = (languageCode: string): number | null => {
  const code = languageCode as LanguageCode;
  return LANGUAGES[code]?.id ?? null;
};

/**
 * Get current language ID from i18n
 */
export const getCurrentLanguageId = (): number => {
  const currentLanguage = i18n.language as LanguageCode;
  return LANGUAGES[currentLanguage]?.id ?? LANGUAGES.en.id;
};

/**
 * Get language code from language ID
 */
export const getLanguageCodeFromId = (id: number): LanguageCode | null => {
  const entry = Object.entries(LANGUAGES).find(([_, lang]) => lang.id === id);
  return entry ? (entry[0] as LanguageCode) : null;
};

/**
 * Get current language code from i18n
 */
export const getCurrentLanguageCode = (): LanguageCode => {
  const currentLanguage = i18n.language as LanguageCode;
  if (currentLanguage === 'en' || currentLanguage === 'fr' || currentLanguage === 'nl') {
    return currentLanguage;
  }
  return 'en';
};

/**
 * Get initial language for i18n initialization
 */
const getInitialLanguage = (): LanguageCode => {
  try {
    return getDeviceLanguage();
  } catch (error) {
    console.error('❌ Error getting initial language:', error);
    return 'en';
  }
};

const initialLanguage = getInitialLanguage();

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  resources: {
    en: {
      common: commonEN,
      home: homeEN,
      livetracking: LiveTrackingEN,
      event: eventEN,
      details: detailsEN,
      personal:personalEventEN,
      result:raceResultEN,
      allrace:ResultListEN,
      participantResult: participantResultEN,
      register: registerEN,
      login: loginEN,
      otp: otpEN,
      confirmModal: confirmModalEN,
      undoModal: undoModalEN,
      errorModal: errorModalEN,
      profile:ProfileEN,
      resultdetails:ResultDetailsEN,
      follower:FollowerEN,
      forget:ForgetEN,
      favourite:FavouriteEN
      
    },
    fr: {
      common: commonFR,
      home: homeFR,
      livetracking: LiveTrackingFR,
      event: eventFR,
      personal: personalEventFR,
      details: detailsFR,
      result:raceResultFR,
      participantResult: participantResultFR,
      register: registerFR,
      login: loginFR,
      otp: otpFR,
      confirmModal: confirmModalFR,
      undoModal: undoModalFR,
      errorModal: errorModalFR,
      profile:ProfileFR,
      allrace:ResultListFr,
      resultdetails:ResultDetailsFR,
      follower:FollowerFR,
      forget:ForgetFR,
      favourite:FavouriteFR
    },
    nl: {
      common: commonNL,
      home: homeNL,
      livetracking: LiveTrackingNL,
      event: eventNL,
      personal: personalEventNL,
      details: detailsNL,
      result:raceResultNL,
      participantResult: participantResultNL,
      register: registerNL,
      login: loginNL,
      otp: otpNL,
      confirmModal: confirmModalNL,
      undoModal: undoModalNL,
      errorModal: errorModalNL,
      profile:ProfileNL,
      allrace:ResultListNL,
      resultdetails:ResultDetailsNL,
      follower:FollowerNL,
      forget:ForgetNL,
      favourite:FavouriteNL
    },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: [
    'common',
    'home',
    'livetracking',
    'event',
    'personal',
    'details',
    'participantResult',
    'register',
    'login',
    'otp',
    'confirmModal',
    'undoModal',
    'errorModal',
    'profile',
    'resultdetails',
    'follower',
    'result',
    'forget',
    'favourite'
  ],
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

console.log('✅ i18n initialized with language:', initialLanguage);

export default i18n;