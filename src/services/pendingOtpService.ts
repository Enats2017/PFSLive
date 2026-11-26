import AsyncStorage from '@react-native-async-storage/async-storage';
import { PendingOtp, parsePendingOtp, usablePendingOtp } from './authFlowGuards';

// ✅ A registration whose code has not been entered yet (audit 2026-11-26,
// finding 3). The verification_token used to exist ONLY in the OTP screen's
// navigation params: kill the app there and the code in the inbox could never be
// used, while Login said "enter the code we emailed you". Kept on AsyncStorage
// (not SecureStore): it is not a credential - it only proves anything together
// with the 6-digit code sent to the mailbox.
const PENDING_OTP_KEY = '@PFSLive:pendingRegistrationOtp';

export const pendingOtpService = {
  async save(email: string, verification_token: string): Promise<void> {
    try {
      const value: PendingOtp = {
        email: email.trim().toLowerCase(),
        verification_token,
        savedAt: Date.now(),
      };
      await AsyncStorage.setItem(PENDING_OTP_KEY, JSON.stringify(value));
    } catch { /* best effort: the flow still works in this session */ }
  },

  /** The stored registration for this email, if still worth resuming. */
  async getFor(email: string): Promise<PendingOtp | null> {
    try {
      const raw = await AsyncStorage.getItem(PENDING_OTP_KEY);
      return usablePendingOtp(parsePendingOtp(raw), email, Date.now());
    } catch {
      return null;
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PENDING_OTP_KEY);
    } catch { /* silent */ }
  },
};
