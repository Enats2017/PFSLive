import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Home: undefined;
  Route: {
    eventId: string;
    eventName: string;
    participantId?: string;
  };
};

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type RouteScreenProps = NativeStackScreenProps<RootStackParamList, 'Route'>;