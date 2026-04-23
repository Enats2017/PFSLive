import React, { useState, useEffect, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
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
import SearchParticipant from '../screens/ResultList/SearchParticipant';

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

// ✅ SERVICES & CONTEXT
import { tokenService } from '../services/tokenService';
import { colors } from '../styles/common.styles';
import { AuthContext } from '../context/AuthContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

const noGesture = { gestureEnabled: false } as const;

export const AppNavigator: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    tokenService.getToken().then(token => setIsLoggedIn(!!token));
  }, []);

  const login  = useCallback(() => setIsLoggedIn(true),  []);
  const logout = useCallback(() => setIsLoggedIn(false), []);

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
          initialRouteName="HomeScreen"
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            fullScreenGestureEnabled: true,
            // ✅ REMOVED: customAnimationOnGesture — not a valid NativeStack option
            animationTypeForReplace: 'push',
          }}
        >
          {/* ── Public screens ───────────────────────────────────────── */}
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
          <Stack.Screen name="SearchParticipant" component={SearchParticipant} options={noGesture} />
          <Stack.Screen name="ProfileScreen" component={ProfileScreen} options={noGesture} />

          <Stack.Screen
            name="LiveTracking"
            component={LiveTrackingScreen}
            options={{
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              // ✅ FIXED: gestureResponseDistance expects an object not a number
              gestureResponseDistance: { start: 50 },
            }}
          />

          {/* ── Auth screens — only when NOT logged in ───────────────── */}
          {!isLoggedIn && (
            <>
              <Stack.Screen name="LoginScreen"           component={LoginScreen}           options={noGesture} />
              <Stack.Screen name="RegisterScreen"        component={RegisterScreen}        options={noGesture} />
              <Stack.Screen name="OTPVerificationScreen" component={OTPVerificationScreen} options={noGesture} />
              <Stack.Screen name="ForgotPassword"        component={ForgotPassword}        options={noGesture} />
            </>
          )}

          {/* ── Login-required screens — only when logged in ─────────── */}
          {isLoggedIn && (
            <>
              <Stack.Screen name="EditProfileScreen"    component={EditProfileScreen}    options={noGesture} />
              <Stack.Screen name="EditPersonalEvent"    component={EditPersonalEvent}    options={noGesture} />
              <Stack.Screen name="LiveTrackingSettings" component={LiveTrackingSettings} options={noGesture} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
};