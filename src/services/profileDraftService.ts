import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProfileDraft, ProfileDraftValues, usableProfileDraft } from './authFlowGuards';

// ✅ Unsaved Edit Profile changes that survive the screen being torn down by a
// logout (re-audit A11) - see authFlowGuards.ts. Best effort everywhere: a
// storage failure only means nothing is restored.
const PROFILE_DRAFT_KEY = '@PFSLive:editProfileDraft';

export const profileDraftService = {
  async save(customerId: number, values: ProfileDraftValues): Promise<void> {
    try {
      const d: ProfileDraft = { customerId, savedAt: Date.now(), values };
      await AsyncStorage.setItem(PROFILE_DRAFT_KEY, JSON.stringify(d));
    } catch { /* silent */ }
  },

  async getFor(customerId: number | null): Promise<ProfileDraftValues | null> {
    try {
      return usableProfileDraft(await AsyncStorage.getItem(PROFILE_DRAFT_KEY), customerId, Date.now());
    } catch {
      return null;
    }
  },

  async clear(): Promise<void> {
    try { await AsyncStorage.removeItem(PROFILE_DRAFT_KEY); } catch { /* silent */ }
  },
};
