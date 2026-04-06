import React, { useState, useEffect, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform, View, ActivityIndicator } from 'react-native';
import { RootStackParamList } from '../types/navigation';

// ✅ APP SCREENS
import HomeScreen from '../screens/HomeScreen';
import LiveTrackingScreen from '../screens/LiveTrackingScreen';
import ParticipantEvent from '../screens/ParticipantEvent/ParticipantEvent';
import PersonalEvent from '../screens/PersonalEventScreen/CreatePersonalEvent';
import EventDetails from '../screens/EventDetails/EventDetails';
import ParticipantResult from '../screens/EventDetails/ParticipantResult';
import RaceResultScreen from '../screens/ParticipantEvent/RaceResultScreen';
import ResultList from '../screens/ResultList/ResultList';
import ResultDetails from '../screens/ResultDetailsScreen/ResultDetails';
import FollowerEvent from '../screens/FollowerEventList/FollowerEvent';
import FollowDetails from '../screens/FollowerDetailsList/FollowerDetails';
import FavouriteList from '../screens/FavouriteScreen/FavouriteList';
import AllParticipant from '../screens/FavouriteScreen/AllParticipant';

// ✅ AUTH SCREENS
import RegisterScreen from '../screens/AuthScreens/RegisterScreen';
import LoginScreen from '../screens/AuthScreens/LoginScreen';
import OTPVerificationScreen from '../screens/AuthScreens/OTPVerificationScreen';
import ForgotPassword from '../screens/AuthScreens/ForgotPasswordScreen/ForgotPassword';

// ✅ LOGIN-REQUIRED SCREENS
import ProfileScreen from '../screens/ProfileScreen/ProfileScreen';
import EditProfileScreen from '../screens/AuthScreens/EditProfileScreen';
import EditPersonalEvent from '../screens/PersonalEventScreen/EditPersonalEvent';
import LiveTrackingSettings from '../screens/SettingScreen/LiveTrackingSettingsScreen';
import SearchParticipant from '../screens/ResultList/SearchParticipant';

// ✅ SERVICES & CONTEXT
import { tokenService } from '../services/tokenService';
import { colors } from '../styles/common.styles';
import { AuthContext } from '../context/AuthContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

const noGesture = { gestureEnabled: false } as const;

export const AppNavigator: React.FC = () => {
  // null = checking token (splash), true = logged in, false = logged out
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    tokenService.getToken().then(token => setIsLoggedIn(!!token));
  }, []);

  const login  = useCallback(() => setIsLoggedIn(true),  []);
  const logout = useCallback(() => setIsLoggedIn(false), []);

  // ✅ Show spinner while checking stored token on app launch
  if (isLoggedIn === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
      <NavigationContainer>
        <Stack.Navigator
          // ✅ Always start at HomeScreen regardless of login state
          initialRouteName="HomeScreen"
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            fullScreenGestureEnabled: true,
            customAnimationOnGesture: true,
            animationTypeForReplace: 'push',
          }}
        >
          {/* ── Public screens — always accessible, always first ─────── */}
          <Stack.Screen name="HomeScreen"        component={HomeScreen}        options={noGesture} />
          <Stack.Screen name="ParticipantEvent"  component={ParticipantEvent}  options={noGesture} />
          <Stack.Screen name="PersonalEvent"     component={PersonalEvent}     options={noGesture} />
          <Stack.Screen name="EventDetails"      component={EventDetails}      options={noGesture} />
          <Stack.Screen name="ParticipantResult" component={ParticipantResult} options={noGesture} />
          <Stack.Screen name="RaceResultScreen"  component={RaceResultScreen}  options={noGesture} />
          <Stack.Screen name="ResultList"        component={ResultList}        options={noGesture} />
          <Stack.Screen name="ResultDetails"     component={ResultDetails}     options={noGesture} />
          <Stack.Screen name="FollowerEvent"     component={FollowerEvent}     options={noGesture} />
          <Stack.Screen name="FollowDetails"     component={FollowDetails}     options={noGesture} />
          <Stack.Screen name="FavouriteList"     component={FavouriteList}     options={noGesture} />
          <Stack.Screen name="AllParticipant"    component={AllParticipant}    options={noGesture} />
          <Stack.Screen name="SearchParticipant" component={SearchParticipant}    options={noGesture} />

          <Stack.Screen
            name="LiveTracking"
            component={LiveTrackingScreen}
            options={{
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              gestureResponseDistance: Platform.OS === 'android' ? 150 : 50,
            }}
          />

          {/* ── Auth screens — only exist when NOT logged in ──────────────
              Once login() is called these screens are unmounted.
              The user can never press back to reach them after login. */}
          {!isLoggedIn && (
            <>
              <Stack.Screen name="LoginScreen"           component={LoginScreen}           options={noGesture} />
              <Stack.Screen name="RegisterScreen"        component={RegisterScreen}        options={noGesture} />
              <Stack.Screen name="OTPVerificationScreen" component={OTPVerificationScreen} options={noGesture} />
              <Stack.Screen name="ForgotPassword"        component={ForgotPassword}        options={noGesture} />
            </>
          )}

          {/* ── Login-required screens — only exist when logged in ────────
              If not logged in these are unmounted — React Navigation
              automatically falls back to HomeScreen. No token check
              needed inside each screen. */}
          {isLoggedIn && (
            <>
              <Stack.Screen name="ProfileScreen"         component={ProfileScreen}         options={noGesture} />
              <Stack.Screen name="EditProfileScreen"     component={EditProfileScreen}     options={noGesture} />
              <Stack.Screen name="EditPersonalEvent"     component={EditPersonalEvent}     options={noGesture} />
              <Stack.Screen name="LiveTrackingSettings"  component={LiveTrackingSettings}  options={noGesture} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
};