import { create } from 'zustand';
import i18n, { saveLanguage } from '../i18n';
import { analyticsService } from '../services/analyticsService';
import { ANALYTICS_SCREENS, ANALYTICS_BUTTONS, ANALYTICS_PARAMS } from '../constants/analyticsScreens';

export type LanguageCode = 'en' | 'fr' | 'nl';

interface LanguageState {
  currentLanguage: LanguageCode;
  /**
   * @param screenName where the change was initiated, for analytics. Defaults
   *   to the tracking-settings screen because LanguageSelector is only rendered
   *   there; EditProfileScreen passes its own.
   */
  changeLanguage: (lang: LanguageCode, screenName?: string) => Promise<void>;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  currentLanguage: (i18n.language as LanguageCode) || 'en',
  
  changeLanguage: async (lang: LanguageCode, screenName: string = ANALYTICS_SCREENS.TRACKING_SETTINGS) => {
    // Instrumented HERE rather than at the six call sites: every caller funnels
    // through this store method, and it is never invoked on app start (the
    // initial value is read straight off i18n.language), so there is no risk of
    // logging a language "change" that never happened.
    //
    // Re-selecting the current language is not a change — web guards the same
    // way in useLanguageSwitcher — so it is not logged.
    if (lang !== get().currentLanguage) {
      void analyticsService.logInteraction(
        screenName,
        ANALYTICS_BUTTONS.LANGUAGE_SELECT,
        'select',
        { [ANALYTICS_PARAMS.LANGUAGE]: lang },
      );
    }

    try {
      // Change i18n language
      await i18n.changeLanguage(lang);
      
      // Save to AsyncStorage
      await saveLanguage(lang);
      
      // Update store
      set({ currentLanguage: lang });
      
      console.log('✅ Language changed to:', lang);
    } catch (error) {
      console.error('❌ Error changing language:', error);
    }
  },
}));