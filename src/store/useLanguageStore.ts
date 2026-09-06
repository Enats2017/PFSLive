import { create } from 'zustand';
import i18n, { saveLanguage } from '../i18n';
import { analyticsService } from '../services/analyticsService';
import { ANALYTICS_SCREENS, ANALYTICS_BUTTONS, ANALYTICS_PARAMS } from '../constants/analyticsScreens';

export type LanguageCode = 'en' | 'fr' | 'nl';

interface LanguageState {
  currentLanguage: LanguageCode;
  /**
   * @param opts.screenName where the change was initiated, for analytics.
   *   Defaults to the tracking-settings screen, where LanguageSelector is
   *   rendered (guest and logged-in); EditProfileScreen passes its own.
   * @param opts.userInitiated MUST be true for a real tap, and left false for
   *   every restore/hydration path. See the note in the implementation — this
   *   defaults to FALSE deliberately.
   */
  changeLanguage: (
    lang: LanguageCode,
    opts?: { screenName?: string; userInitiated?: boolean },
  ) => Promise<void>;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  currentLanguage: (i18n.language as LanguageCode) || 'en',

  changeLanguage: async (
    lang: LanguageCode,
    opts?: { screenName?: string; userInitiated?: boolean },
  ) => {
    const screenName = opts?.screenName ?? ANALYTICS_SCREENS.TRACKING_SETTINGS;

    // ✅ Analytics fires ONLY for a real tap (`userInitiated: true`).
    //
    // This used to log on any value change, on the theory that every caller was
    // a user action. It is not: changeLanguage is also called while RESTORING
    // state, and those paths were logging language_select for something nobody
    // touched —
    //   • App.tsx initializeApp() — restores the saved language on every cold
    //     start. currentLanguage seeds from i18n.language, which is the DEVICE
    //     language, so an English device with the app set to FR/NL differed on
    //     every launch and fired a phantom event attributed to a settings
    //     screen the user never opened.
    //   • Guest/UserTrackingSettings — apply the language returned by the
    //     settings API while hydrating on mount.
    //
    // Instrumenting the store cannot distinguish a tap from a restore, so the
    // caller has to say. The default is FALSE so a future non-user caller can
    // only ever UNDER-count (visible, harmless) rather than fabricate events
    // (invisible, and it corrupts the dimension retroactively).
    //
    // Re-selecting the current language is not a change — web guards the same
    // way in useLanguageSwitcher — so it is still not logged.
    if (opts?.userInitiated && lang !== get().currentLanguage) {
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