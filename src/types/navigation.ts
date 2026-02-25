import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Home: undefined;
  Route: {
    eventId: string;
    eventName: string;
    participantId?: string;
  };

  ParticipantEvent:undefined

  PersonalEvent : undefined
                             
  EventDetails: { product_app_id: string | number
     event_name: string;
   };
   Register:undefined;
   LoginScreen:undefined;
   OTPVerificationScreen: {           // ← add this
    email: string;
    verification_token: string;
  };


};

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type RouteScreenProps = NativeStackScreenProps<RootStackParamList, 'Route'>; 
export type EventDetailsProps = NativeStackScreenProps<RootStackParamList, 'EventDetails'>;
export type ParticipantEventProps = NativeStackScreenProps<RootStackParamList, 'ParticipantEvent'>;
export type PersonalEventProps = NativeStackScreenProps<RootStackParamList, 'PersonalEvent'>;
export type RegisterProps = NativeStackScreenProps<RootStackParamList, 'Register'>; 
export type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'LoginScreen'>; 
export type OTPVerificationScreenProps = NativeStackScreenProps<RootStackParamList, 'OTPVerificationScreen'>; 
