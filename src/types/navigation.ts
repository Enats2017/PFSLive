import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Home: undefined;
  Route: {
    eventId: string;
    eventName: string;
    participantId?: string;
  };
   ParticipantEvent: undefined;                              // ✅ add
  EventDetails: { product_app_id: string | number
     event_name: string;
   };
};

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type RouteScreenProps = NativeStackScreenProps<RootStackParamList, 'Route'>;
export type ParticipantEventProps = NativeStackScreenProps<RootStackParamList, 'ParticipantEvent'>; // ✅ add
export type EventDetailsProps = NativeStackScreenProps<RootStackParamList, 'EventDetails'>;  