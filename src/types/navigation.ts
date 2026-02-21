import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Home: undefined;
  Route: {
    eventId: string;
    eventName: string;
    participantId?: string;
  };
                             
  EventDetails: { product_app_id: string | number
     event_name: string;
   };
};

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type RouteScreenProps = NativeStackScreenProps<RootStackParamList, 'Route'>; 
export type EventDetailsProps = NativeStackScreenProps<RootStackParamList, 'EventDetails'>;  