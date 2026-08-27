import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
// NOTE: deliberately does NOT import from constants/config. config.ts's
// getHeaders() calls tokenService.getToken(), so importing API_CONFIG back here
// (it was imported and never used) closed a circular dependency for nothing.

// ✅ The auth token lives in SecureStore, NOT AsyncStorage.
//
// app.config.js sets allowBackup: true with no backup rules, so Android Auto
// Backup sweeps the whole data dir — including AsyncStorage's RKStorage SQLite
// file. The bearer token used to sit in there in clear, which meant it was
// uploaded to Google's servers unencrypted and restored onto whatever device the
// user migrated to. (Not theoretical: it was readable via
// `adb exec-out run-as eu.passionforsports.livio cat databases/RKStorage`.)
//
// Backup stays ON — Play's device-migration requirement wants app state to carry
// over, so switching it off would trade one problem for another. Instead the
// credential moves somewhere backup cannot reach: SecureStore is Keystore-backed
// on Android and Keychain-backed on iOS, and Keystore keys are non-exportable by
// design, so the token physically cannot leave the device.
//
// SecureStore keys must be alphanumeric plus '.', '-', '_' — '@' and ':' are
// rejected outright, so these cannot reuse the old '@PFSLive:' names. Naming
// follows the existing `secure_device_id` in constants/config.ts.
const TOKEN_KEY = 'secure_auth_token';
const CUSTOMER_KEY = 'secure_customer_app_id';

// ⚠️ ACCESSIBILITY IS NOT OPTIONAL HERE — do not drop this and take the default.
//
// expo-secure-store defaults to WHEN_UNLOCKED, which on iOS makes the Keychain
// entry unreadable while the device is locked. This app's whole job is sending
// GPS from a background task with the phone locked in a runner's pocket for
// hours: getHeaders() would read null, and its `else` branch returns headers
// with NO Authorization at all, so every fix of the race would go out
// unauthenticated and be rejected. That is the 2026-08-23 "recorded nothing"
// failure re-created by a storage default.
//
// AFTER_FIRST_UNLOCK stays readable while locked once the phone has been
// unlocked after boot. THIS_DEVICE_ONLY additionally keeps the entry out of
// iCloud/iTunes backups, which is the point of moving off AsyncStorage in the
// first place. Android ignores this option (EncryptedSharedPreferences).
const SECURE_OPTS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
} as const;

// Legacy AsyncStorage keys. Read once by migrateLegacy(), then deleted — which
// is also what scrubs the token out of the backed-up RKStorage for users who
// upgrade. Do NOT reuse these for new writes.
const LEGACY_TOKEN_KEY = '@PFSLive:authToken';
const LEGACY_CUSTOMER_KEY = '@PFSLive:customer_app_id';

// Analytics flags stay on AsyncStorage — they are not credentials, and letting
// them ride the backup across a device swap is the desired behaviour.
const HAS_PARTICIPATED_KEY = 'analytics_has_participated';
const HAS_USED_FOLLOWER_FEATURE_KEY = 'analytics_has_used_follower_feature';

// ✅ ONE-TIME MIGRATION — without this, shipping the SecureStore switch would log
// out every existing user on update.
//
// Runs from every read path rather than app start, so there is no ordering
// dependency on AppNavigator's startup token read.
//
// The latch caches the PROMISE, not a boolean. A boolean flipped before the
// first await would let a second concurrent caller skip straight past and read
// SecureStore while the copy was still in flight — getting null and reporting a
// logged-out user who is not. That is not hypothetical: there are ~24 read call
// sites and several fire in the same tick at startup (AppNavigator's getToken,
// whose result drives setIsLoggedIn; AppHeader's isTokenValid/getCustomerId;
// getHeaders on any early request). Caching the promise makes every caller
// either start the migration or await the one already running.
//
// Copy-then-verify-then-delete: the legacy row is only removed once SecureStore
// definitely holds the value, so a crash mid-migration cannot lose the session.
// The promise is cleared on failure so a later read retries.
let migrationPromise: Promise<void> | null = null;

// Retries are capped. A Keystore failure is effectively permanent for an install,
// and getHeaders() runs on EVERY request — including every GPS send, which is
// every 5s near the finish line. Retrying forever would throw and re-throw inside
// a background task for the whole race for no gain. A few attempts cover the
// genuinely transient case; after that reads just use the fallback.
const MAX_MIGRATION_ATTEMPTS = 3;
let migrationAttempts = 0;

function migrateLegacy(): Promise<void> {
  if (!migrationPromise) {
    if (migrationAttempts >= MAX_MIGRATION_ATTEMPTS) return Promise.resolve();
    migrationAttempts++;
    migrationPromise = runMigration().catch((error) => {
      // Only re-arm while attempts remain; readWithFallback covers us either way.
      if (migrationAttempts < MAX_MIGRATION_ATTEMPTS) migrationPromise = null;
      console.error('❌ Credential migration failed:', error);
    });
  }
  return migrationPromise;
}

async function runMigration(): Promise<void> {
  const [legacyToken, legacyCustomer] = await Promise.all([
    AsyncStorage.getItem(LEGACY_TOKEN_KEY),
    AsyncStorage.getItem(LEGACY_CUSTOMER_KEY),
  ]);

  if (!legacyToken && !legacyCustomer) return;   // fresh install, nothing to do

  if (legacyToken && !(await SecureStore.getItemAsync(TOKEN_KEY))) {
    await SecureStore.setItemAsync(TOKEN_KEY, legacyToken, SECURE_OPTS);
  }
  if (legacyCustomer && !(await SecureStore.getItemAsync(CUSTOMER_KEY))) {
    await SecureStore.setItemAsync(CUSTOMER_KEY, legacyCustomer, SECURE_OPTS);
  }

  // Only now is it safe to drop the plaintext copies.
  const keysToDrop: string[] = [];
  if (legacyToken && (await SecureStore.getItemAsync(TOKEN_KEY))) {
    keysToDrop.push(LEGACY_TOKEN_KEY);
  }
  if (legacyCustomer && (await SecureStore.getItemAsync(CUSTOMER_KEY))) {
    keysToDrop.push(LEGACY_CUSTOMER_KEY);
  }
  if (keysToDrop.length) await AsyncStorage.multiRemove(keysToDrop);

  if (__DEV__) console.log('✅ Credentials migrated to SecureStore');
}

// ✅ FAIL SOFT ON A BROKEN KEYSTORE — do not "simplify" these away.
//
// SecureStore is Keystore-backed on Android, and a minority of devices have it
// genuinely broken (bad vendor implementations, keys invalidated by a lock-screen
// or biometric change, keys lost on restore). Without a fallback such a user is
// locked out permanently rather than merely inconvenienced: migration throws so
// they appear logged out, they log in again fine, saveToken() throws, nothing is
// persisted, and the next read finds nothing — a login loop with no way out. On
// AsyncStorage they worked before, so that would be a regression, not a trade.
//
// So: SecureStore is the happy path and gets the credential on every healthy
// device; the plaintext key is used ONLY when SecureStore actually fails. Reads
// consult it only after SecureStore yields nothing, which on a healthy device is
// never — migration deletes it and the successful-write paths above remove it.
async function writeFallback(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    console.error('❌ Fallback write failed:', error);
  }
}

async function readWithFallback(secureKey: string, legacyKey: string): Promise<string | null> {
  let value: string | null = null;
  try {
    value = await SecureStore.getItemAsync(secureKey);
  } catch (error) {
    console.error('❌ SecureStore read failed, trying fallback:', error);
  }
  if (value) return value;
  try {
    return await AsyncStorage.getItem(legacyKey);
  } catch {
    return null;
  }
}

// ✅ Every location is cleared INDEPENDENTLY — one failure must not skip the rest.
//
// These used to sit in a single try block: on a broken-Keystore device the first
// SecureStore.deleteItemAsync threw, control jumped to catch, and the
// AsyncStorage cleanup never ran — so logout left the plaintext fallback token in
// place and the user stayed signed in. Same path is used by
// useRegistrationHandler.handleUnauthorized on a 401, so a bad token could not be
// cleared either. Logout must be best-effort across every store, not all-or-nothing.
async function wipeCredentials(): Promise<void> {
  const results = await Promise.allSettled([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(CUSTOMER_KEY),
    AsyncStorage.multiRemove([LEGACY_TOKEN_KEY, LEGACY_CUSTOMER_KEY]),
  ]);
  for (const r of results) {
    if (r.status === 'rejected') console.error('❌ Error clearing credential store:', r.reason);
  }
}

export const tokenService = {
  /**
   * Save auth token to SecureStore, with an AsyncStorage fallback.
   */
  async saveToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token, SECURE_OPTS);
      // Healthy device — make sure no stale plaintext copy survives alongside it.
      await AsyncStorage.removeItem(LEGACY_TOKEN_KEY).catch(() => {});
      console.log('✅ Token saved to secure storage');
    } catch (error) {
      console.error('❌ Error saving token, falling back to AsyncStorage:', error);
      await writeFallback(LEGACY_TOKEN_KEY, token);
    }
  },

  async getToken(): Promise<string | null> {
    try {
      await migrateLegacy();
      const token = await readWithFallback(TOKEN_KEY, LEGACY_TOKEN_KEY);
      // ✅ Never log the token itself — this file exists to keep it out of
      // places it can leak from, and a dev console is one of them.
      if (__DEV__) console.log('🔑 Token from secure storage:', token ? 'present' : 'none');
      return token;
    } catch (error) {
      console.error('❌ Error loading token:', error);
      return null;
    }
  },

  async saveCustomerId(id: number | string): Promise<void> {
    try {
      await SecureStore.setItemAsync(CUSTOMER_KEY, String(id), SECURE_OPTS);
      await AsyncStorage.removeItem(LEGACY_CUSTOMER_KEY).catch(() => {});
    } catch (error) {
      console.error('❌ Error saving customer id, falling back to AsyncStorage:', error);
      await writeFallback(LEGACY_CUSTOMER_KEY, String(id));
    }
  },

  async getCustomerId(): Promise<number | null> {
    try {
      await migrateLegacy();
      const id = await readWithFallback(CUSTOMER_KEY, LEGACY_CUSTOMER_KEY);
      if (__DEV__) console.log('🔑 customer_app_id from secure storage:', id);
      return id ? Number(id) : null;
    } catch (error) {
      console.error('❌ Error loading customer id:', error);
      return null;
    }
  },

  async isTokenValid(): Promise<boolean> {
    try {
      await migrateLegacy();
      const token = await readWithFallback(TOKEN_KEY, LEGACY_TOKEN_KEY);
      return token !== null && token !== '';
    } catch {
      return false;
    }
  },

  async clearAll(): Promise<void> {
    await wipeCredentials();
    console.log('✅ Token and customer ID cleared');
  },

  async removeToken(): Promise<void> {
    await wipeCredentials();
    console.log('✅ Token removed from storage');
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await migrateLegacy();
      const token = await readWithFallback(TOKEN_KEY, LEGACY_TOKEN_KEY);
      return token !== null;
    } catch (error) {
      console.error('❌ Error checking authentication:', error);
      return false;
    }
  },

   /**
   * Check if this user has ever completed a participant action
   * (register / create event / start tracking).
   */
  async getHasParticipated(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(HAS_PARTICIPATED_KEY);
      return value === 'true';
    } catch (error) {
      console.error('❌ Error reading hasParticipated:', error);
      return false;
    }
  },

  async setHasParticipated(): Promise<void> {
    try {
      await AsyncStorage.setItem(HAS_PARTICIPATED_KEY, 'true');
      console.log('✅ hasParticipated flag set');
    } catch (error) {
      console.error('❌ Error saving hasParticipated:', error);
    }
  },

  async getHasUsedFollowerFeature(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(HAS_USED_FOLLOWER_FEATURE_KEY);
      return value === 'true';
    } catch (error) {
      console.error('❌ Error reading hasUsedFollowerFeature:', error);
      return false;
    }
  },

  async setHasUsedFollowerFeature(): Promise<void> {
    try {
      await AsyncStorage.setItem(HAS_USED_FOLLOWER_FEATURE_KEY, 'true');
      console.log('✅ hasUsedFollowerFeature flag set');
    } catch (error) {
      console.error('❌ Error saving hasUsedFollowerFeature:', error);
    }
  },


};
