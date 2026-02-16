export default ({ config }) => {
  const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    console.warn('⚠️ EXPO_PUBLIC_MAPBOX_TOKEN not found in .env file!');
  }

  return {
    ...config,
    name: "PFSLive",
    slug: "pfslive",
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
      bundleIdentifier: "com.yourcompany.pfslive",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "PFSLive needs your location to track your race progress and share it with followers.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "PFSLive needs your location to track your race progress even when the app is in the background.",
        NSLocationAlwaysUsageDescription: "PFSLive needs background location access to continuously track your race progress."
      }
    },
    android: {
      // adaptiveIcon: {
      //   foregroundImage: "./assets/adaptive-icon.png",
      //   backgroundColor: "#ffffff"
      // },
      package: "com.yourcompany.pfslive",
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
          locationAlwaysAndWhenInUsePermission: "Allow PFSLive to use your location to track your race progress.",
          locationAlwaysPermission: "Allow PFSLive to use your location even when the app is in the background.",
          locationWhenInUsePermission: "Allow PFSLive to use your location to track your race progress."
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "your-project-id"
      }
    }
  };
};