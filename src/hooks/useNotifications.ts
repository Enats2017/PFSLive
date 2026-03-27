// src/hooks/useNotifications.ts

import { useEffect, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { followerApi } from "../services/registerFollowerServices";
import { API_CONFIG } from "../constants/config";

const EXPO_TOKEN_STORAGE_KEY = "expo_push_token";
const FOLLOWER_ID_KEY = "FOLLOWER_ID";

let Notifications: any = null;
let Device: any = null;
let isNotificationsAvailable = false;

try {
  Notifications = require("expo-notifications");
  Device = require("expo-device");
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

// ✅ Setup notification channel (Android only)
async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android" || !Notifications) return;

  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
      enableVibrate: true,
      enableLights: true,
      showBadge: true,
    });

    if (API_CONFIG.DEBUG) {
      console.log("✅ Android notification channel configured");
    }
  } catch (error) {
    if (API_CONFIG.DEBUG) {
      console.error("❌ Failed to setup Android channel:", error);
    }
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

    if (API_CONFIG.DEBUG) {
      console.log("✅ iOS notification categories configured");
    }
  } catch (error) {
    if (API_CONFIG.DEBUG) {
      console.error("❌ Failed to setup iOS categories:", error);
    }
  }
}

// ✅ Register for push notifications (iOS + Android)
async function registerForPushNotifications(): Promise<string | null> {
  if (!isNotificationsAvailable || !Notifications || !Device) {
    if (API_CONFIG.DEBUG) {
      console.log("ℹ️ Notifications module not available - skipping registration");
    }
    return null;
  }

  if (!Device.isDevice) {
    if (API_CONFIG.DEBUG) {
      console.warn("⚠️ Push notifications require a physical device (iOS Simulator not supported)");
    }
    return null;
  }

  try {
    if (Platform.OS === "android") {
      await setupAndroidChannel();
    } else if (Platform.OS === "ios") {
      await setupiOSNotificationCategories();
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;

      if (API_CONFIG.DEBUG) {
        console.log(`📱 ${Platform.OS} notification permission: ${status}`);
      }
    }

    if (finalStatus !== "granted") {
      if (API_CONFIG.DEBUG) {
        console.warn("⚠️ Push notification permission denied");
      }
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "e72144dd-72cd-47f1-8409-125734130233",
    });

    const token = tokenData.data;

    if (API_CONFIG.DEBUG) {
      console.log(`✅ ${Platform.OS} Expo push token obtained:`, token);
    }

    await sendTokenToBackend(token);

    return token;
  } catch (error) {
    if (API_CONFIG.DEBUG) {
      console.error(`❌ Failed to register for push notifications on ${Platform.OS}:`, error);
    }
    return null;
  }
}

// ✅ Send token to backend
async function sendTokenToBackend(token: string): Promise<void> {
  try {
    const savedToken = await AsyncStorage.getItem(EXPO_TOKEN_STORAGE_KEY);

    if (savedToken === token) {
      if (API_CONFIG.DEBUG) {
        console.log("ℹ️ Expo token unchanged — skipping backend registration");
      }
      return;
    }

    const result = await followerApi.registerFollower(token);

    if (API_CONFIG.DEBUG) {
      console.log("✅ Follower registered successfully:", {
        follower_id: result.follower_id,
        platform: Platform.OS,
      });
    }

    await Promise.all([
      AsyncStorage.setItem(EXPO_TOKEN_STORAGE_KEY, token),
      AsyncStorage.setItem(FOLLOWER_ID_KEY, String(result.follower_id)),
    ]);

    if (API_CONFIG.DEBUG) {
      console.log("💾 Token and follower_id saved to storage");
    }
  } catch (error) {
    if (API_CONFIG.DEBUG) {
      console.error("❌ Failed to register token with backend:", error);
    }
  }
}

// ✅ Parsed notification data shape matching the PHP payload
export interface NotificationData {
  type: 'checkpoint' | 'finish';
  participant_app_id: string | number;
  race_id: string | number;
  product_option_value_app_id: string | number;
  event_name: string;
  checkpoint_key: string;
  bib: string | number;
  race_status: string;
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
  const [isRegistering, setIsRegistering]       = useState(false);

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

    if (data?.product_option_value_app_id && data?.bib && onNotificationTapRef.current) {
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

    const initialize = async () => {
      if (!isMounted) return;
      setIsRegistering(true);

      try {
        const token = await registerForPushNotifications();
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