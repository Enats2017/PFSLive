// ✅ CRITICAL: Import gesture handler FIRST, before anything else
import 'react-native-gesture-handler';

import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import { AppNavigator } from './src/navigation/AppNavigator';
import i18n, { loadLanguage } from './src/i18n';
import { useLanguageStore } from './src/store/useLanguageStore';
import Toast from "react-native-toast-message";
import { toastConfig } from "./utils/toastConfig";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';

// ✅ SUPPRESS ERROR OVERLAY IN DEVELOPMENT (EXPO)
if (__DEV__) {
  // Disable all LogBox warnings/errors (no yellow/red boxes)
  LogBox.ignoreAllLogs(true);
  
  // Suppress global error handler (no black bottom overlay)
  const originalHandler = ErrorUtils.getGlobalHandler();
  
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    // Log to console for debugging (you can still see in terminal/Expo logs)
    console.log('🚫 Error overlay suppressed:', error.message);
    
    // Don't call original handler - this prevents the black overlay
    // originalHandler(error, isFatal);
  });
  
  // Suppress console.error to prevent triggering overlays
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    // Still log as console.log so you can debug
    console.log('[ERROR]', ...args);
    
    // Don't call originalConsoleError - prevents overlay
    // originalConsoleError(...args);
  };
}

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
        console.log('❌ App initialization error:', error); // ✅ Changed from console.error
        setIsReady(true);
      }
    };

    initializeApp();
  }, []);

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
        {/* ✅ Toast positioned at top with offset */}
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