// src/hooks/useNotifications.ts

import { useEffect, useRef, useState, useCallback } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { followerApi } from "../services/registerFollowerServices";
import AsyncStorage from "@react-native-async-storage/async-storage";

const EXPO_TOKEN_STORAGE_KEY = "expo_push_token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,       // ✅ Fixed: was false — alerts were silenced
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});



async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF231F7C",
  });
}

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    if (__DEV__) console.warn("⚠️ Push notifications require a real device.");
    return null;
  }

  await setupAndroidChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  const finalStatus =
    existingStatus !== "granted"
      ? (await Notifications.requestPermissionsAsync()).status
      : existingStatus;

  if (finalStatus !== "granted") {
    if (__DEV__) console.warn("⚠️ Push notification permission denied.");
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: "8d5b3a21-b354-4647-9840-ad0ed16eb2d8",
    });

    if (__DEV__) console.log("✅ Expo push token:", token);

    await sendTokenToBackend(token);
    return token;
  } catch (error) {
    console.error("❌ Failed to get push token:", error);
    return null;
  }
}

// ─── Send Token to Backend ────────────────────────────────────────────────────

async function sendTokenToBackend(token: string): Promise<void> {
  try {
     const savedToken = await AsyncStorage.getItem(EXPO_TOKEN_STORAGE_KEY);

     if (savedToken === token) {
      if (__DEV__) console.log("ℹ️ Expo token unchanged — skipping backend call.");
      return;
    }

    const result = await followerApi.registerFollower(token);
 
    if (__DEV__) {
      console.log("📤 Follower registered, follower_id:", result.follower_id);
    }
     await AsyncStorage.setItem(EXPO_TOKEN_STORAGE_KEY, token);
  } catch (error) {

    console.error("❌ Failed to register follower:", error);
  }
}
// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseNotificationsReturn {
  expoPushToken: string | null;
  lastNotification: Notifications.Notification | null;
  clearLastNotification: () => void;
}

export function useNotifications(): UseNotificationsReturn {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [lastNotification, setLastNotification] =
    useState<Notifications.Notification | null>(null);

  const notificationListener = useRef<ReturnType<
    typeof Notifications.addNotificationReceivedListener
  > | null>(null);

  const responseListener = useRef<ReturnType<
    typeof Notifications.addNotificationResponseReceivedListener
  > | null>(null);

  const handleNotificationReceived = useCallback(
    (notification: Notifications.Notification) => {
      if (__DEV__) {
        console.log("📬 Notification received:", notification.request.content.title);
      }
      setLastNotification(notification);
    },
    [],
  );

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      if (__DEV__) console.log("👆 Notification tapped, data:", data);
      // 👉 Add your navigation or deep-link logic here
    },
    [],
  );

  useEffect(() => {
    registerForPushNotifications().then((token) => {
      if (token) setExpoPushToken(token);
    });

    notificationListener.current =
      Notifications.addNotificationReceivedListener(handleNotificationReceived);

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(
        handleNotificationResponse,
      );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [handleNotificationReceived, handleNotificationResponse]);

  const clearLastNotification = useCallback(() => {
    setLastNotification(null);
  }, []);

  return { expoPushToken, lastNotification, clearLastNotification };
}