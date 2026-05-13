// ✅ CRITICAL: Import gesture handler FIRST, before anything else
import 'react-native-gesture-handler';

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, LogBox, NativeModules, AppState, Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import { AppNavigator } from './src/navigation/AppNavigator';
import { loadLanguage } from './src/i18n';
import { useLanguageStore } from './src/store/useLanguageStore';
import Toast from "react-native-toast-message";
import { toastConfig } from "./utils/toastConfig";
import './src/services/gpsService';
import { navigationRef } from './src/navigation/navigationRef';
import { API_CONFIG } from './src/constants/config';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';

// ✅ SUPPRESS ERROR OVERLAY IN DEVELOPMENT (EXPO)
if (__DEV__) {
  LogBox.ignoreAllLogs(true);

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.log('🚫 Error overlay suppressed:', error.message);
  });

  console.error = (...args: any[]) => {
    console.log('[ERROR]', ...args);
  };
}

// ✅ Navigate to PersonalEvent with GPX file pre-selected
const navigateToPersonalEvent = (uri: string, fileName: string) => {
  const navigate = () => {
    navigationRef.current?.navigate('PersonalEvent', { sharedFileUri: uri, sharedFileName: fileName });
  };

  if (navigationRef.isReady()) {
    navigate();
  } else {
    const interval = setInterval(() => {
      if (navigationRef.isReady()) {
        clearInterval(interval);
        navigate();
      }
    }, 100);
    setTimeout(() => clearInterval(interval), 5000);
  }
};

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const { changeLanguage } = useLanguageStore();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 App initializing...');

        if (MAPBOX_TOKEN) {
          Mapbox.setAccessToken(MAPBOX_TOKEN);
          console.log('✅ Mapbox initialized');
        } else {
          console.warn('⚠️ Mapbox token missing');
        }

        const savedLang = await loadLanguage();
        if (savedLang !== 'en') {
          await changeLanguage(savedLang);
          console.log('✅ Language restored:', savedLang);
        }

        setIsReady(true);
        console.log('✅ App ready');
      } catch (error) {
        console.log('❌ App initialization error:', error);
        setIsReady(true);
      }
    };

    initializeApp();
  }, []);

  // ✅ Handle deep link from email verification — livio://registration-confirmed
  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => {
      if (url?.startsWith('livio://registration-confirmed')) {
        if (API_CONFIG.DEBUG) console.log('✅ Deep link: registration confirmed', url);
          // Parse query params from deep link URL
          const queryString = url.split('?')[1] ?? '';
          const params = Object.fromEntries(
          queryString.split('&').filter(Boolean).map(p => {
            const [key, value] = p.split('=');
            return [key, decodeURIComponent(value ?? '')];
          })
        );
        const product_app_id = params.product_app_id ? Number(params.product_app_id) : null;
        const event_name = params.event_name ?? '';
        if (product_app_id && event_name) {
          navigationRef.current?.navigate('EventDetails', { product_app_id, event_name, auto_register_id: null });
        } else {
          navigationRef.current?.navigate('ParticipantEvent');
        }
      }
    };

    // App already open — handle incoming deep link
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // App was closed — check if launched via deep link
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink({ url });
    });

    return () => subscription.remove();
  }, []);

  // ✅ Handle GPX share intent — checks on startup and when app returns to foreground
  useEffect(() => {
    if (!isReady) return;

    const checkGpxIntent = async () => {
      try {
        const result = await NativeModules.GpxShare?.getIntent?.();
        if (!result) return;
        navigateToPersonalEvent(result.uri, result.fileName);
      } catch (err) {
        if (API_CONFIG.DEBUG) console.log('❌ GpxShare.getIntent error:', err);
      }
    };

    checkGpxIntent();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkGpxIntent();
    });

    return () => subscription.remove();
  }, [isReady]);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#DC143C" />
      </View>
    );
  }
  
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppNavigator />
        <Toast
          config={toastConfig}
          position="top"
          topOffset={60}
        />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
});