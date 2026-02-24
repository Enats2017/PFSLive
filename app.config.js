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
    // icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    // splash: {
    //   image: "./assets/splash.png",
    //   resizeMode: "contain",
    //   backgroundColor: "#ffffff"
    // },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.pfs.livio",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Livio - Live tracking & Results app",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Livio - Live tracking & Results app",
        NSLocationAlwaysUsageDescription: "Livio - Live tracking & Results app"
      }
    },
    android: {
      // adaptiveIcon: {
      //   foregroundImage: "./assets/adaptive-icon.png",
      //   backgroundColor: "#ffffff"
      // },
      package: "com.pfs.Livio",
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION"
      ]
    },
    web: {
      // favicon: "./assets/favicon.png"
    },
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
      "@react-native-community/datetimepicker"  
    ],
    extra: {
      eas: {
        projectId: "your-project-id"
      }
    }
  };
};