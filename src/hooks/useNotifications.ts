// src/hooks/useNotifications.ts

import { useEffect, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";
import { API_CONFIG } from "../constants/config";
import { analyticsService } from "../services/analyticsService";
import { notificationPermissionService } from "../services/notificationPermissionService";

let Notifications: any = null;
let isNotificationsAvailable = false;

try {
  Notifications = require("expo-notifications");
  isNotificationsAvailable = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (error) {
  if (API_CONFIG.DEBUG) {
    console.warn("⚠️ Expo Notifications not available");
  }
}

// Channel setup, permission and token registration live in
// notificationPermissionService. This hook NO LONGER PROMPTS: it registers
// silently when permission is already granted, and listens for a grant made
// anywhere else (follow sheet, Get race-ready, Notifications screen).

// ✅ Parsed notification data shape matching the PHP payload
export interface NotificationData {
  type: 'checkpoint' | 'finish';
  participant_app_id: string | number;
  race_id: string | number;
  product_option_value_app_id: string | number;
  event_name: string;
  event_image?:string;
  checkpoint_key: string;
  bib: string | number;
  race_status: string;
  event_source?: string;      // 'custom' | 'partner'
  tracking_source?: string;   // 'rr' | 'gps'
}

// ✅ Taps already routed, by notification id — module-level so a remount of the
// hook (or the cold-start read below racing the listener) never routes the
// same tap twice.
const handledResponseIds = new Set<string>();
const responseIdOf = (response: any): string | null => {
  const id = response?.notification?.request?.identifier;
  return typeof id === "string" && id !== "" ? id : null;
};

// The tap has been routed: forget it natively too, so a later read (remount,
// JS reload after an OTA update) does not hand it back.
const clearLastResponse = () => {
  try {
    if (typeof Notifications?.clearLastNotificationResponse === "function") {
      void Promise.resolve(Notifications.clearLastNotificationResponse()).catch(() => { /* older native: no-op */ });
    } else if (typeof Notifications?.clearLastNotificationResponseAsync === "function") {
      void Promise.resolve(Notifications.clearLastNotificationResponseAsync()).catch(() => { /* older native: no-op */ });
    }
  } catch { /* best effort */ }
};

// ✅ Hook interface
interface UseNotificationsReturn {
  expoPushToken: string | null;
  lastNotification: any | null;
  clearLastNotification: () => void;
  isRegistering: boolean;
  isAvailable: boolean;
  // Register a handler for background/killed-state notification taps
  setOnNotificationTap: (handler: ((data: NotificationData) => void) | null) => void;
}

// ✅ Main hook
export function useNotifications(): UseNotificationsReturn {
  const [expoPushToken, setExpoPushToken]       = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<any | null>(null);
  // Starts true when available: HomeScreen's follow restore waits on this, and
  // must not run its token-less path before the silent registration has run.
  const [isRegistering, setIsRegistering]       = useState(isNotificationsAvailable);

  const notificationListener  = useRef<any>(null);
  const responseListener      = useRef<any>(null);

  // ✅ Use a ref to store the tap handler — useState cannot store functions
  // directly because React treats a function argument as an initializer.
  const onNotificationTapRef = useRef<((data: NotificationData) => void) | null>(null);
  // A tap that arrived before a handler was registered (cold start: this hook's
  // effect reads the launch tap BEFORE HomeScreen's own effect registers its
  // handler). Delivered the moment one is.
  const pendingTapRef = useRef<NotificationData | null>(null);

  const setOnNotificationTap = useCallback((
    handler: ((data: NotificationData) => void) | null
  ) => {
    onNotificationTapRef.current = handler;
    if (handler && pendingTapRef.current) {
      const data = pendingTapRef.current;
      pendingTapRef.current = null;
      try { handler(data); } finally { clearLastResponse(); }
    }
  }, []);

  // Foreground — store notification so the screen can show a popup
  const handleNotificationReceived = useCallback((notification: any) => {
    if (!isNotificationsAvailable) return;

    if (API_CONFIG.DEBUG) {
      const { title, body } = notification.request.content;
      console.log(`📬 ${Platform.OS} notification received (foreground):`, { title, body });
    }

    setLastNotification(notification);
  }, []);

  // Background/killed tap — fire the registered handler immediately
  const handleNotificationResponse = useCallback((response: any) => {
    if (!isNotificationsAvailable) return;
    if (!response?.notification?.request?.content) return;

    // Once per tap: the listener and the cold-start read can both deliver it.
    const responseId = responseIdOf(response);
    if (responseId !== null) {
      if (handledResponseIds.has(responseId)) return;
      handledResponseIds.add(responseId);
    }

    const { data, title } = response.notification.request.content;

    if (API_CONFIG.DEBUG) {
      console.log(`👆 ${Platform.OS} notification tapped:`, { title, data });
    }

    // Logged BEFORE the handler guard below: the user tapped regardless of
    // whether a tap handler happens to be registered, and taps that arrive with
    // no handler (or an incomplete payload) are exactly the ones worth seeing in
    // the data — they're the ones that silently go nowhere.
    //
    // Only fires from the RESPONSE listener, so this genuinely means "opened the
    // app from a notification", not "received one". `type` is 'checkpoint' or
    // 'finish' per NotificationData, both low-cardinality and safe as a
    // registered dimension.
    void analyticsService.logNotificationOpened(data?.type ?? "unknown", data?.race_id);

    if (data?.race_id && data?.event_name && onNotificationTapRef.current) {
      try { onNotificationTapRef.current(data as NotificationData); } finally { clearLastResponse(); }
    } else if (data?.race_id && data?.event_name) {
      pendingTapRef.current = data as NotificationData;   // see pendingTapRef
    }
  }, []);

  const clearLastNotification = useCallback(() => {
    setLastNotification(null);
  }, []);

  useEffect(() => {
    if (!isNotificationsAvailable) {
      if (API_CONFIG.DEBUG) {
        console.log(`ℹ️ Notifications not available on ${Platform.OS} - hook inactive`);
      }
      return;
    }

    let isMounted = true;

    // A grant made elsewhere (follow sheet, Get race-ready, Settings) reaches
    // HomeScreen through here, so its follow-restore effect still runs.
    const unsubscribeToken = notificationPermissionService.onTokenChange((token) => {
      if (isMounted) setExpoPushToken(token);
    });

    const initialize = async () => {
      if (!isMounted) return;
      setIsRegistering(true);

      try {
        // SILENT — never prompts. See notificationPermissionService header.
        const token = await notificationPermissionService.registerIfGranted();
        if (isMounted && token) setExpoPushToken(token);
      } catch (error) {
        if (API_CONFIG.DEBUG) {
          console.error(`❌ ${Platform.OS} notification initialization failed:`, error);
        }
      } finally {
        if (isMounted) setIsRegistering(false);
      }
    };

    initialize();

    if (Notifications) {
      notificationListener.current = Notifications.addNotificationReceivedListener(
        handleNotificationReceived
      );
      responseListener.current = Notifications.addNotificationResponseReceivedListener(
        handleNotificationResponse
      );

      // ✅ Cold start (audit 2026-11-26 #2): a tap that LAUNCHED the app is
      // emitted natively when the module is created — long before this
      // listener exists — and was dropped, so the fan landed on Home instead of
      // the result / live map. expo-notifications keeps it as the "last
      // response": read it now that the listener is attached (deduped by id).
      try {
        const read = typeof Notifications.getLastNotificationResponse === "function"
          ? Notifications.getLastNotificationResponse()
          : typeof Notifications.getLastNotificationResponseAsync === "function"
            ? Notifications.getLastNotificationResponseAsync()
            : null;
        void Promise.resolve(read).then((last: any) => {
          if (isMounted && last) handleNotificationResponse(last);
        }).catch(() => { /* no launch tap */ });
      } catch { /* older native: listener only */ }
    }

    return () => {
      isMounted = false;
      unsubscribeToken();
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [handleNotificationReceived, handleNotificationResponse]);

  return {
    expoPushToken,
    lastNotification,
    clearLastNotification,
    isRegistering,
    isAvailable: isNotificationsAvailable,
    setOnNotificationTap,
  };
}