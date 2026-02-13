import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import { AppNavigator } from './src/navigation/AppNavigator';
import i18n, { loadLanguage } from './src/i18n';
import { useLanguageStore } from './src/store/useLanguageStore';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const { changeLanguage } = useLanguageStore();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 App initializing...');

        // Initialize Mapbox
        if (MAPBOX_TOKEN) {
          Mapbox.setAccessToken(MAPBOX_TOKEN);
          console.log('✅ Mapbox initialized');
        } else {
          console.warn('⚠️ Mapbox token missing');
        }

        // Load saved language preference
        const savedLang = await loadLanguage();
        if (savedLang !== 'en') {
          await changeLanguage(savedLang);
          console.log('✅ Language restored:', savedLang);
        }

        setIsReady(true);
        console.log('✅ App ready');
      } catch (error) {
        console.error('❌ App initialization error:', error);
        setIsReady(true); // Continue anyway
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