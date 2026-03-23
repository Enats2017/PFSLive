import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import { RootStackParamList } from '../types/navigation';

import HomeScreen from '../screens/HomeScreen';
import LiveTrackingScreen from '../screens/LiveTrackingScreen';
import ParticipantEvent from '../screens/ParticipantEvent/ParticipantEvent';
import PersonalEvent from '../screens/PersonalEventScreen/CreatePersonalEvent';
import EventDetails from '../screens/EventDetails/EventDetails';
import ParticipantResult from '../screens/EventDetails/ParticipantResult';
 import RaceResultScreen from '../screens/ParticipantEvent/RaceResultScreen';
import ResultList from '../screens/ResultList/ResultList';

// ✅ AUTH SCREENS - NEW IMPORTS
import RegisterScreen from '../screens/AuthScreens/RegisterScreen';
import LoginScreen from '../screens/AuthScreens/LoginScreen';
import OTPVerificationScreen from '../screens/AuthScreens/OTPVerificationScreen';
import EditProfileScreen from '../screens/AuthScreens/EditProfileScreen';

import ProfileScreen from '../screens/ProfileScreen/ProfileScreen';
import EditPersonalEvent from '../screens/PersonalEventScreen/EditPersonalEvent';

import ResultDetails from '../screens/ResultDetailsScreen/ResultDetails';
import FollowerEvent from '../screens/FollowerEventList/FollowerEvent';

 import FollowDetails from '../screens/FollowerDetailsList/FollowerDetails';
 import ForgotPassword from '../screens/AuthScreens/ForgotPasswordScreen/ForgotPassword';
 import FavouriteList from '../screens/FavouriteScreen/FavouriteList';
 import AllParticipant from '../screens/FavouriteScreen/AllParticipant';


const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
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
        <Stack.Screen 
          name="HomeScreen" 
          component={HomeScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen 
          name="ParticipantEvent" 
          component={ParticipantEvent}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen 
          name="PersonalEvent" 
          component={PersonalEvent}
          options={{ gestureEnabled: false }}
        />       
        <Stack.Screen 
          name="EventDetails" 
          component={EventDetails}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen 
          name="ParticipantResult" 
          component={ParticipantResult}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen 
          name="RaceResultScreen" 
          component={RaceResultScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen 
          name="ResultList" 
          component={ResultList}
          options={{ gestureEnabled: false }}
        />
        
        {/* ✅ AUTH SCREENS */}
        <Stack.Screen 
          name="RegisterScreen" 
          component={RegisterScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen 
          name="OTPVerificationScreen" 
          component={OTPVerificationScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen 
          name="LoginScreen" 
          component={LoginScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen 
          name="ProfileScreen" 
          component={ProfileScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen 
          name="EditProfileScreen" 
          component={EditProfileScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen 
          name="EditPersonalEvent" 
          component={EditPersonalEvent}
          options={{ gestureEnabled: false }}
        />
        
        <Stack.Screen 
          name="ResultDetails" 
          component={ResultDetails}
          options={{
            gestureEnabled: false,
          }}
        />
        <Stack.Screen 
          name="FollowerEvent" 
          component={FollowerEvent}
          options={{
            gestureEnabled: false,
          }}
        />

        <Stack.Screen 
          name="FollowDetails" 
          component={FollowDetails}
          options={{
            gestureEnabled: false,
          }}
        />
        <Stack.Screen 
          name="ForgotPassword" 
          component={ForgotPassword}
          options={{
            gestureEnabled: false,
          }}
        />
         <Stack.Screen 
          name="FavouriteList" 
          component={FavouriteList}
          options={{
            gestureEnabled: false,
          }}
        />
         <Stack.Screen 
          name="AllParticipant" 
          component={AllParticipant}
          options={{
            gestureEnabled: false,
          }}
        />

        <Stack.Screen 
          name="LiveTracking" 
          component={LiveTrackingScreen}
          options={{
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            gestureResponseDistance: Platform.OS === 'android' ? 150 : 50,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};