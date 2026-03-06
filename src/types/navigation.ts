import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Distance } from '../services/eventDetailService';

export type RootStackParamList = {
  Home: undefined;
  Route: {
      product_app_id: string | number;
  product_option_value_app_id: string | number;
  event_name: string;
  };

  ParticipantEvent:undefined
  PersonalEvent : undefined
  EventDetails: {
      product_app_id: string | number;
      event_name: string;
      auto_register_id: number | null;
  };
   ParticipantResult: { 
    product_app_id: string | number;
    item: Distance;
  };
  Register:undefined;
  LoginScreen:undefined;
  OTPVerificationScreen: {           
    email: string;
    verification_token: string;
  };

  RaseResultScreen:{
      product_app_id: number;
  product_option_value_app_id: number;
  };
  ResultList: {
  product_app_id: number;
  product_option_value_app_id: number;
};

  ProfileScreen:undefined;

  EditProfileScreen:undefined;

  EditPersonalEvent:{
    eventId:number;

  }
 
};

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type RouteScreenProps = NativeStackScreenProps<RootStackParamList, 'Route'>; 
export type EventDetailsProps = NativeStackScreenProps<RootStackParamList, 'EventDetails'>;
export type ParticipantEventProps = NativeStackScreenProps<RootStackParamList, 'ParticipantEvent'>;
export type PersonalEventProps = NativeStackScreenProps<RootStackParamList, 'PersonalEvent'>;
export type RegisterProps = NativeStackScreenProps<RootStackParamList, 'Register'>; 
export type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'LoginScreen'>; 
export type OTPVerificationScreenProps = NativeStackScreenProps<RootStackParamList, 'OTPVerificationScreen'>; 
export type ParticipantResultPopes = NativeStackScreenProps<RootStackParamList, 'ParticipantResult'>;
export type RaseResultScreenprops = NativeStackScreenProps<RootStackParamList, 'RaseResultScreen'>;
export type ResultListprops = NativeStackScreenProps<RootStackParamList, 'ResultList'>;
export type ProfileScreenprops = NativeStackScreenProps<RootStackParamList, 'ProfileScreen'>;
export type EditProfileScreenprops = NativeStackScreenProps<RootStackParamList, 'EditProfileScreen'>;
export type EditPersonalEventpops = NativeStackScreenProps<RootStackParamList,'EditPersonalEvent'>;

