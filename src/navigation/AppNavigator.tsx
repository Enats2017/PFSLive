import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getAnalytics, logScreenView } from '@react-native-firebase/analytics';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, AppState } from 'react-native';
import { RootStackParamList } from '../types/navigation';
import { analyticsService } from '../services/analyticsService';

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
import ParticipantScreen from '../screens/ParticipantScreen/ParticipantScreen';
import FollowerSrceen from '../screens/FollowerScreen/FollowerScreen';
import AthleteSearchScreen from '../screens/FollowerScreen/AthleteSearchScreen';
import OwnProfile from '../screens/ProfileScreen/OwnProfile';
import UserFavouriteList from '../screens/FollowerScreen/UserFavouriteList';
import FollowersList from '../screens/ProfileScreen/FollowersList';
import FanScreen from '../screens/FollowerScreen/FanScreen';
import MembershipPlansScreen from '../screens/ProfileScreen/MembershipPlansScreen';


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
import ContactFeedbackScreen from '../screens/ProfileScreen/ContactFeedbackScreen';

// ✅ SERVICES & CONTEXT
import { tokenService } from '../services/tokenService';
import { palette } from '../styles/common.styles';
import { AuthContext } from '../context/AuthContext';
import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator<RootStackParamList>();

const noGesture = { gestureEnabled: false } as const;

export const AppNavigator: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const routeNameRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    tokenService.getToken().then(async (token) => {
      setIsLoggedIn(!!token);
      await analyticsService.initRole();
      // Read-only — never prompts, so it's safe on every start.
      await analyticsService.syncPermissionProperties();
      if (token) {
        const customerId = await tokenService.getCustomerId();
        if (customerId) {
          await analyticsService.setUserIdentity(String(customerId));
        }
      }
    });
  }, []);

  // Re-read permissions on every foreground: a change made in iOS/Android
  // Settings never notifies the app, so without this the stored value goes
  // stale until the next cold start.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void analyticsService.syncPermissionProperties();
    });
    return () => sub.remove();
  }, []);

  const login = useCallback(async (userId: string) => {
    setIsLoggedIn(true);
    await analyticsService.setUserIdentity(userId);
  }, []);
  const logout = useCallback(async () => {
    setIsLoggedIn(false);
    // Detach the Firebase user ID. Without this, everything the next
    // person does on this device is still attributed to the account that
    // just logged out.
    await analyticsService.clearUserIdentity();
  }, []);

  if (isLoggedIn === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={palette.navy} />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
        }}
        onStateChange={async () => {
          const previous = routeNameRef.current;
          const current = navigationRef.current?.getCurrentRoute()?.name;
          if (current && previous !== current) {
            await logScreenView(getAnalytics(), {
              screen_name: current,
              screen_class: current,
            });
          }
          routeNameRef.current = current;
        }}
      >
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
          <Stack.Screen name="ParticipantScreen" component={ParticipantScreen} options={noGesture} />
          <Stack.Screen name="FollowerSrceen" component={FollowerSrceen} options={noGesture} />
          <Stack.Screen name="AthleteSearchScreen" component={AthleteSearchScreen} options={noGesture} />
          <Stack.Screen name="UserFavouriteList" component={UserFavouriteList} options={noGesture} />
          <Stack.Screen name="FollowersList" component={FollowersList} options={noGesture} />
          <Stack.Screen name="FanScreen" component={FanScreen} options={noGesture} />
          <Stack.Screen name="MembershipPlansScreen" component={MembershipPlansScreen} options={noGesture} />
          <Stack.Screen name="LiveTrackingSettings" component={LiveTrackingSettings} options={noGesture} />

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
              <Stack.Screen name="LoginScreen"           component={LoginScreen}           options={noGesture} />
              <Stack.Screen name="RegisterScreen"        component={RegisterScreen}        options={noGesture} />
              <Stack.Screen name="OTPVerificationScreen" component={OTPVerificationScreen} options={noGesture} />
              <Stack.Screen name="EditProfileScreen"    component={EditProfileScreen}    options={noGesture} />
              <Stack.Screen name="EditPersonalEvent"    component={EditPersonalEvent}    options={noGesture} /> 
              <Stack.Screen name="OwnProfile" component={OwnProfile} options={noGesture} />
              <Stack.Screen name="ContactFeedbackScreen" component={ContactFeedbackScreen} options={noGesture} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
};