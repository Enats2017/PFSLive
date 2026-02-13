import { create } from 'zustand';
import i18n, { saveLanguage } from '../i18n';

export type LanguageCode = 'en' | 'fr' | 'nl';

interface LanguageState {
  currentLanguage: LanguageCode;
  changeLanguage: (lang: LanguageCode) => Promise<void>;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  currentLanguage: (i18n.language as LanguageCode) || 'en',
  
  changeLanguage: async (lang: LanguageCode) => {
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