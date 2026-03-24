export default ({ config }) => {
  const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    console.warn('⚠️ EXPO_PUBLIC_MAPBOX_TOKEN not found in .env file!');
  }

  return {
    ...config,
    name: "Livio",
    slug: "livio",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: ["**/*"],

    // ✅ iOS Configuration
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.pfs.livio",
      buildNumber: "1",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Livio uses your location to track your race progress in real-time.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Livio needs background location access to track your race even when the app is minimized.",
        NSLocationAlwaysUsageDescription: "Livio requires continuous location access to provide accurate race tracking.",
        UIBackgroundModes: ["remote-notification", "location"]
      },
      entitlements: {
        "aps-environment": process.env.EXPO_PUBLIC_ENV === "production" 
          ? "production" 
          : "development"
      }
    },

    // ✅ Android Configuration
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.pfs.livio",
      versionCode: 1,
      googleServicesFile: "./google-services.json",
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "POST_NOTIFICATIONS",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION"
      ],
      useNextNotificationsApi: true,
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },

    // ✅ Web Configuration
    web: {
      favicon: "./assets/favicon.png"
    },

    // ✅ Plugins
    plugins: [
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsDownloadToken: mapboxToken
        }
      ],
      "expo-asset",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow Livio to use your location to track your race progress.",
          locationAlwaysPermission: "Allow Livio to use your location even when the app is in the background.",
          locationWhenInUsePermission: "Allow Livio to use your location to track your race progress."
        }
      ],
      "expo-localization",
      "@react-native-community/datetimepicker",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#3B82F6",
          defaultChannel: "default",
          sounds: [],
          mode: "production"
        }
      ]
    ],

    // ✅ Extra Configuration
    extra: {
      eas: {
        projectId: "e72144dd-72cd-47f1-8409-125734130233"
      }
    },

    // ✅ Organization Owner
    owner: "livio_app", // ✅ Your organization slug

    // ✅ Updates Configuration
    updates: {
      url: "https://u.expo.dev/e72144dd-72cd-47f1-8409-125734130233"
    },
    runtimeVersion: {
      policy: "appVersion"
    }
  };
};