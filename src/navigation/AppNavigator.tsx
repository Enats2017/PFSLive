import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import { RootStackParamList } from '../types/navigation';

import HomeScreen from '../screens/HomeScreen';
import RouteScreen from '../screens/RouteScreen';
import ParticipantEvent from '../screens/ParticipantEvent/ParticipantEvent';
import PersonalEvent from '../screens/ParticipantEvent/CreatePersonalEvent';
import EventDetails from '../screens/EventDetails/EventDetails';
import Register from '../screens/Register';
import LoginScreen from '../screens/LoginScreen';
import OTPVerificationScreen from '../screens/OTPVerificationScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          // Enable swipe back gesture
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          fullScreenGestureEnabled: true,
          // Custom gesture config for better sensitivity
          customAnimationOnGesture: true,
          animationTypeForReplace: 'push',
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen}
          options={{
            gestureEnabled: false, // No swipe on home screen
          }}
        />
        <Stack.Screen 
          name="ParticipantEvent" 
          component={ParticipantEvent}
          options={{
            gestureEnabled: false,
          }}
        />
         <Stack.Screen 
          name="PersonalEvent" 
          component={PersonalEvent}
          options={{
            gestureEnabled: false,
          }}
        />       
         <Stack.Screen 
          name="EventDetails" 
          component={EventDetails}
          options={{
            gestureEnabled: false,
          }}
        />
          <Stack.Screen 
          name="Register" 
          component={Register}
          options={{
            gestureEnabled: false,
          }}
        />
         <Stack.Screen 
          name="OTPVerificationScreen" 
          component={OTPVerificationScreen}
          options={{
            gestureEnabled: false,
          }}
        />
         <Stack.Screen 
          name="LoginScreen" 
          component={LoginScreen}
          options={{
            gestureEnabled: false,
          }}
        />
        <Stack.Screen 
          name="Route" 
          component={RouteScreen}
          options={{
            gestureEnabled: true, // Enable swipe to go back
            fullScreenGestureEnabled: true,
            // Increase gesture response distance
            gestureResponseDistance: Platform.OS === 'android' ? 150 : 50,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};