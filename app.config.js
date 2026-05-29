export default ({ config }) => {
  const mapboxDownloadToken = process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN;

  if (!mapboxDownloadToken) {
    console.warn('⚠️ RNMAPBOX_MAPS_DOWNLOAD_TOKEN not found in .env file!');
  }

  return {
    ...config,
    name: "Livio",
    slug: "livio",
    scheme: "livio",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,

    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#D5DA28"
    },

    assetBundlePatterns: ["**/*"],

    // ✅ iOS Configuration
    ios: {
      supportsTablet: true,
      bundleIdentifier: "eu.passionforsports.livio",
      buildNumber: "1",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Livio uses your location to track your race progress in real-time.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Livio needs background location access to track your race even when the app is minimized.",
        NSLocationAlwaysUsageDescription: "Livio requires continuous location access to provide accurate race tracking.",
        UIBackgroundModes: ["remote-notification", "location", "fetch"],
        ...(process.env.EXPO_PUBLIC_ENV !== "production" && {
          NSAppTransportSecurity: {
            NSAllowsArbitraryLoads: true
          }
        }),
        // ✅ Register GPX file type handler for iOS share extension
        CFBundleDocumentTypes: [
          {
            CFBundleTypeName: "GPX File",
            CFBundleTypeRole: "Viewer",
            LSHandlerRank: "Alternate",
            LSItemContentTypes: [
              "com.topografix.gpx",
              "public.xml"
            ]
          }
        ],
        UTImportedTypeDeclarations: [
          {
            UTTypeIdentifier: "com.topografix.gpx",
            UTTypeDescription: "GPX File",
            UTTypeConformsTo: ["public.xml", "public.text"],
            UTTypeTagSpecification: {
              "public.filename-extension": ["gpx"],
              "public.mime-type": "application/gpx+xml"
            }
          }
        ]
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
        backgroundColor: "#D5DA28"
      },
      package: "eu.passionforsports.livio",
      versionCode: 1,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
      allowBackup: true,
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "POST_NOTIFICATIONS",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION",
        "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"
      ],
      // ✅ GPX intent filters — withGpxShareIntent plugin handles native wiring
      intentFilters: [
        {
          action: "VIEW",
          category: ["BROWSABLE", "DEFAULT"],
          data: [
            { mimeType: "application/gpx+xml" },
            { mimeType: "text/xml" },
            { mimeType: "application/xml" },
          ]
        },
        {
          action: "SEND",
          category: ["DEFAULT"],
          data: [
            { mimeType: "application/gpx+xml" },
            { mimeType: "text/xml" },
            { mimeType: "application/xml" },
          ]
        }
      ],
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      jsEngine: "hermes"
    },

    // ✅ Web Configuration
    web: {
      favicon: "./assets/favicon.png"
    },

    // ✅ Plugins
    plugins: [
      // ✅ Custom plugin — handles GPX share/view intent wiring for Android
      "./plugins/withGpxShareIntent",
      [
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic: process.env.EXPO_PUBLIC_ENV !== "production",  // ⚠️ Remove before production
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            enableSeparateBuildPerCPUArchitecture: true,
            useLegacyPackaging: true,
          }
        }
      ],
      [
        "@rnmapbox/maps",
        {
          RNMAPBOX_MAPS_DOWNLOAD_TOKEN: mapboxDownloadToken
        }
      ],
      "expo-asset",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow Livio to use your location to track your race progress.",
          locationAlwaysPermission: "Allow Livio to use your location even when the app is in the background.",
          locationWhenInUsePermission: "Allow Livio to use your location to track your race progress.",
          // ✅ These generate the correct AndroidManifest.xml entries for background
          // location and foreground service. Raw permissions array alone is not enough —
          // expo-location plugin wires additional service declarations in the manifest.
          isHighAccuracyEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
          // ✅ iOS: enables location in UIBackgroundModes via plugin (supplements
          // the manual UIBackgroundModes entry in infoPlist above).
          isIosBackgroundLocationEnabled: true,
        }
      ],
      "expo-background-task",
      [
        "react-native-background-geolocation",
        {
          license: ""  // ← empty for DEBUG/development, add key for preview/production
        }
      ],
      "expo-localization",
      "expo-secure-store",
      "@react-native-community/datetimepicker",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#D5DA28",
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
    owner: "livio_app",

    // ✅ Updates Configuration
    updates: {
      url: "https://u.expo.dev/e72144dd-72cd-47f1-8409-125734130233"
    },
    runtimeVersion: {
      policy: "appVersion"
    }
  };
};