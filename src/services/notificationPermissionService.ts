// src/services/notificationPermissionService.ts
//
// ✅ Owns the notification PERMISSION and the Expo push TOKEN, outside React.
//
// Why this left useNotifications: the hook used to call requestPermissionsAsync()
// on HomeScreen mount — i.e. on first launch, before the user had done anything.
// ~45% of users said no to a prompt with no context, and the OS only shows that
// prompt ONCE per install, so every one of those "no"s is permanent from inside
// the app. The ask now happens where it means something — the fan's first
// follow, the runner's "Get race-ready" flow, the Notifications screen — and
// each of those calls request() below. The hook only ever registers SILENTLY
// when permission is already granted.
//
// Module-level (not hook state) so the RaceReady screen, the follow sheet and
// the settings screen can all ask, and HomeScreen's hook still learns the token.

import { AppState, Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { followerApi } from "./registerFollowerServices";
import { API_CONFIG } from "../constants/config";
import { analyticsService } from "./analyticsService";

const EXPO_TOKEN_STORAGE_KEY = "expo_push_token";
const FOLLOWER_ID_KEY = "FOLLOWER_ID";
const EXPO_PROJECT_ID = "e72144dd-72cd-47f1-8409-125734130233";

let Notifications: any = null;
let Device: any = null;
let isNotificationsAvailable = false;

try {
  Notifications = require("expo-notifications");
  Device = require("expo-device");
  isNotificationsAvailable = true;
} catch {
  if (API_CONFIG.DEBUG) console.warn("⚠️ Expo Notifications not available");
}

export type NotificationPermissionStatus = "granted" | "denied" | "undetermined";

export interface NotificationPermissionState {
  status: NotificationPermissionStatus;
  /** false = the OS will not show its prompt again; Settings is the only route. */
  canAskAgain: boolean;
}

type TokenListener = (token: string | null) => void;
const tokenListeners = new Set<TokenListener>();
let currentToken: string | null = null;

/**
 * The server row lost this phone's push token (row gone / deactivated and
 * re-registered without it): forget that it was sent, so the next
 * registerIfGranted (foreground or launch) sends it again — also in this
 * session. No listener event: nothing changed for the UI.
 */
export function forgetSentPushToken(): void {
  currentToken = null;
}

const emitToken = (token: string | null) => {
  currentToken = token;
  tokenListeners.forEach((l) => {
    try { l(token); } catch { /* listener errors must not break the others */ }
  });
};

// ✅ Setup notification channel (Android only)
//
// Kept on EVERY launch even though we no longer prompt at launch: Android 13+
// only shows the POST_NOTIFICATIONS prompt once a channel exists, so a later
// request() from the follow sheet would otherwise show nothing at all.
async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android" || !Notifications) return;

  try {
    // The old "default" channel was created without `sound`, and Android does
    // not allow a channel's sound/importance to be changed after creation —
    // so we create a new channel id and point the server's channelId at it.
    await Notifications.setNotificationChannelAsync("default_v2", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",                 // ← the missing piece: plays the default tone
      vibrationPattern: [0, 250, 250, 250],
      // design-audit-ignore: Android LED colour, #AARRGGBB — opaque palette.lime.
      lightColor: "#FFC7D92C",
      enableVibrate: true,
      enableLights: true,
      showBadge: true,
    });

    if (API_CONFIG.DEBUG) console.log("✅ Android notification channel configured");
  } catch (error) {
    if (API_CONFIG.DEBUG) console.error("❌ Failed to setup Android channel:", error);
  }
}

// ✅ Setup iOS notification categories
async function setupiOSNotificationCategories(): Promise<void> {
  if (Platform.OS !== "ios" || !Notifications) return;

  try {
    await Notifications.setNotificationCategoryAsync("default", [
      {
        identifier: "view",
        buttonTitle: "View",
        options: { opensAppToForeground: true },
      },
    ]);

    if (API_CONFIG.DEBUG) console.log("✅ iOS notification categories configured");
  } catch (error) {
    if (API_CONFIG.DEBUG) console.error("❌ Failed to setup iOS categories:", error);
  }
}

// ✅ Send token to backend. true = the server has this token for this device.
async function sendTokenToBackend(token: string): Promise<boolean> {
  try {
    const savedToken = await AsyncStorage.getItem(EXPO_TOKEN_STORAGE_KEY);

    if (savedToken === token) {
      if (API_CONFIG.DEBUG) console.log("ℹ️ Expo token unchanged — skipping backend registration");
      return true;
    }

    // UPSERT on device_id server-side: a device that was registered as a
    // token-less follower (see followerIdentity) keeps the SAME follower_id —
    // its follows stay attached and simply start receiving pushes.
    // A phone learning its FIRST follower_id here (it had only local
    // follows — e.g. a 1.0.9 user who refused notifications) still owes the
    // merge with the server row. Literal key on purpose: followStorage owns
    // it, and importing it here would create a cycle.
    const previousId = await AsyncStorage.getItem(FOLLOWER_ID_KEY);

    const result = await followerApi.registerFollower(token);

    if (API_CONFIG.DEBUG) {
      console.log("✅ Follower registered successfully:", {
        follower_id: result.follower_id,
        platform: Platform.OS,
      });
    }

    // First id, or a DIFFERENT one (e.g. a backup restored onto a new phone):
    // the phone's follows were never merged with this server row.
    if (!(Number(previousId) > 0) || String(previousId) !== String(result.follower_id)) {
      await AsyncStorage.setItem("@PFSLive:followAdoptPending", "1");
    }
    await Promise.all([
      AsyncStorage.setItem(EXPO_TOKEN_STORAGE_KEY, token),
      AsyncStorage.setItem(FOLLOWER_ID_KEY, String(result.follower_id)),
    ]);

    if (API_CONFIG.DEBUG) console.log("💾 Token and follower_id saved to storage");
    return true;
  } catch (error) {
    if (API_CONFIG.DEBUG) console.error("❌ Failed to register token with backend:", error);
    return false;
  }
}

// One fetch at a time: the OS permission dialog pauses the app, so the
// AppState "active" listener fires registerIfGranted() while request() is
// still registering — without this, two token fetches and two POSTs.
let fetchInFlight: Promise<string | null> | null = null;
// getExpoPushTokenAsync can hang (iOS offline). Without a cap every later
// registerIfGranted() would join the hung promise for the whole session.
const TOKEN_FETCH_TIMEOUT_MS = 20000;

function fetchAndRegisterToken(): Promise<string | null> {
  if (fetchInFlight) return fetchInFlight;
  fetchInFlight = (async () => {
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const tokenData: { data: string } = await Promise.race([
        Notifications.getExpoPushTokenAsync({ projectId: EXPO_PROJECT_ID }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("push token fetch timed out")), TOKEN_FETCH_TIMEOUT_MS);
        }),
      ]).finally(() => clearTimeout(timer));
      const token: string = tokenData.data;
      if (API_CONFIG.DEBUG) console.log(`✅ ${Platform.OS} Expo push token obtained:`, token);
      // Only remember the token once the server has it — otherwise
      // registerIfGranted()'s "already registered" shortcut would stop the
      // next foreground from retrying a failed registration.
      if (!(await sendTokenToBackend(token))) return null;
      // Switched off in Settings while this was in flight? Then don't
      // announce a token the user just revoked (the next foreground would
      // only clear it again).
      try {
        const now = await Notifications.getPermissionsAsync();
        if (now?.status !== "granted") return null;
      } catch { /* can't tell — keep the token */ }
      emitToken(token);
      return token;
    } catch (error) {
      if (API_CONFIG.DEBUG) console.error(`❌ Failed to get push token on ${Platform.OS}:`, error);
      return null;
    } finally {
      fetchInFlight = null;
    }
  })();
  return fetchInFlight;
}

let setupDone = false;

export const notificationPermissionService = {
  isAvailable(): boolean {
    return isNotificationsAvailable && !!Device?.isDevice;
  },

  getCurrentToken(): string | null {
    return currentToken;
  },

  onTokenChange(listener: TokenListener): () => void {
    tokenListeners.add(listener);
    return () => { tokenListeners.delete(listener); };
  },

  /** Channel / category setup. Safe to call repeatedly; does the work once. */
  async setup(): Promise<void> {
    if (setupDone || !isNotificationsAvailable) return;
    setupDone = true;
    if (Platform.OS === "android") await setupAndroidChannel();
    else if (Platform.OS === "ios") await setupiOSNotificationCategories();
  },

  /** Read-only. Never shows anything. */
  async getState(): Promise<NotificationPermissionState> {
    if (!isNotificationsAvailable) return { status: "denied", canAskAgain: false };
    try {
      const res = await Notifications.getPermissionsAsync();
      return {
        status: (res.status as NotificationPermissionStatus) ?? "undetermined",
        canAskAgain: res.canAskAgain !== false,
      };
    } catch {
      return { status: "undetermined", canAskAgain: true };
    }
  },

  /**
   * SILENT: registers the push token only if permission is already granted.
   * This is what runs on launch and on every return to the foreground — so a
   * user who switches notifications on in the phone's Settings is picked up
   * without restarting the app (previously nothing happened until a restart).
   */
  async registerIfGranted(): Promise<string | null> {
    if (!this.isAvailable()) return null;
    await this.setup();
    const { status } = await this.getState();
    // No syncPermissionProperties() here — AppNavigator already runs it on
    // launch and on every foreground; this path is reached from both.
    if (status !== "granted") {
      if (currentToken) emitToken(null); // revoked in Settings
      return null;
    }
    // Already registered this session — don't hit Expo on every foreground.
    if (currentToken) return currentToken;
    return fetchAndRegisterToken();
  },

  /**
   * Shows the OS prompt (if the OS still allows it) and registers on success.
   * Call ONLY after our own explanation — never cold.
   */
  async request(): Promise<NotificationPermissionState> {
    if (!this.isAvailable()) return { status: "denied", canAskAgain: false };
    await this.setup();
    let state = await this.getState();
    if (state.status !== "granted" && state.canAskAgain) {
      try {
        const res = await Notifications.requestPermissionsAsync();
        state = {
          status: (res.status as NotificationPermissionStatus) ?? "denied",
          canAskAgain: res.canAskAgain !== false,
        };
        if (API_CONFIG.DEBUG) console.log(`📱 ${Platform.OS} notification permission: ${res.status}`);
      } catch { /* keep the pre-request state */ }
    }
    // The prompt has just resolved — refresh the analytics permission
    // properties now, denied path included (the more interesting datapoint).
    void analyticsService.syncPermissionProperties();
    if (state.status === "granted") await fetchAndRegisterToken();
    return state;
  },

  /** The only route back once the OS has stopped asking. */
  async openSettings(): Promise<void> {
    try { await Linking.openSettings(); } catch { /* silent */ }
  },
};

// Pick up a grant made in the phone's Settings when the user comes back.
AppState.addEventListener("change", (next) => {
  if (next === "active") void notificationPermissionService.registerIfGranted();
});
