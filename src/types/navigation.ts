import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Home: undefined;
  Route: {
    eventId: string;
    eventName: string;
    participantId?: string;
  };

  ParticipantEvent:undefined
                             
  EventDetails: { product_app_id: string | number
     event_name: string;
   };
   Register:undefined;
   LoginScreen:undefined;
};

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type RouteScreenProps = NativeStackScreenProps<RootStackParamList, 'Route'>; 
export type EventDetailsProps = NativeStackScreenProps<RootStackParamList, 'EventDetails'>;
export type ParticipantEventProps = NativeStackScreenProps<RootStackParamList, 'EventDetails'>;
export type RegisterProps = NativeStackScreenProps<RootStackParamList, 'Register'>; 
export type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'LoginScreen'>; 
