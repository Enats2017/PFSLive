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

  const setOnNotificationTap = useCallback((
    handler: ((data: NotificationData) => void) | null
  ) => {
    onNotificationTapRef.current = handler;
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
      onNotificationTapRef.current(data as NotificationData);
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