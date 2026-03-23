import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Distance } from "../services/eventDetailService";

export type RootStackParamList = {
  HomeScreen: undefined;
  LiveTracking: {
    product_app_id: number;
    product_option_value_app_id: number;
    event_name: string;
    sourceScreen?: string;
    sectionType?: string;
    sourceTab?: "past" | "live" | "upcoming";
  };
  ParticipantEvent: undefined;
  PersonalEvent: undefined;
  EventDetails: {
    product_app_id: string | number;
    event_name: string;
    auto_register_id: number | null;
  };
  ParticipantResult: {
    product_app_id: string | number;
    item: Distance;
  };
  RegisterScreen: undefined;
  LoginScreen: undefined;
  OTPVerificationScreen: {
    email: string;
    verification_token: string;
    purpose:'registration' | 'forgot_password';
  };
  RaceResultScreen: {
    product_app_id: number;
    product_option_value_app_id: number;
    event_name: string;
  };
  ResultList: {
    product_app_id: number;
    product_option_value_app_id: number;
    event_name?: string;
    sourceScreen?: string;
    sectionType: string;
    sourceTab?: "past" | "live" | "upcoming";
  };
  ProfileScreen: { customer_app_id?: number; fromEdit?: boolean };
  EditProfileScreen: undefined;
  EditPersonalEvent: {
    eventId: number;
  };
  ResultDetails: {
    product_app_id:number,
    product_option_value_app_id:number,
    bib:string,
    from_live : 0 | 1,
     raceStatus?: 'finished' | 'in_progress' | 'not_started';
  };
  FollowerEvent: undefined;
  FollowDetails: {
    product_app_id: number;
    event_name: string;
    sourceTab?: "past" | "live" | "upcoming";
  };

  ForgotPassword:undefined;
  FavouriteList:{
    product_app_id:number;
    product_option_value_app_id?: number;
    event_name?: string;
    sourceScreen?: string;
    sectionType: string;
    sourceTab?: "past" | "live" | "upcoming";
  };
  AllParticipant:{
    product_app_id:number 
  }

};


export type HomeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "HomeScreen"
>;
export type LiveTrackingScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "LiveTracking"
>;
export type EventDetailsProps = NativeStackScreenProps<
  RootStackParamList,
  "EventDetails"
>;
export type ParticipantEventProps = NativeStackScreenProps<
  RootStackParamList,
  "ParticipantEvent"
>;
export type PersonalEventProps = NativeStackScreenProps<
  RootStackParamList,
  "PersonalEvent"
>;
export type RegisterProps = NativeStackScreenProps<
  RootStackParamList,
  "RegisterScreen"
>;
export type LoginScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "LoginScreen"
>;
export type OTPVerificationScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "OTPVerificationScreen"
>;
export type ParticipantResultPopes = NativeStackScreenProps<
  RootStackParamList,
  "ParticipantResult"
>;
export type RaceResultScreenprops = NativeStackScreenProps<
  RootStackParamList,
  "RaceResultScreen"
>;
export type ResultListprops = NativeStackScreenProps<
  RootStackParamList,
  "ResultList"
>;
export type ProfileScreenprops = NativeStackScreenProps<
  RootStackParamList,
  "ProfileScreen"
>;
export type EditProfileScreenprops = NativeStackScreenProps<
  RootStackParamList,
  "EditProfileScreen"
>;
export type EditPersonalEventpops = NativeStackScreenProps<
  RootStackParamList,
  "EditPersonalEvent"
>;
export type ResultDetailspops = NativeStackScreenProps<
  RootStackParamList,
  "ResultDetails"
>;
export type FollowerEventpops = NativeStackScreenProps<
  RootStackParamList,
  "FollowerEvent"
>;
export type followerDetailspops = NativeStackScreenProps<
  RootStackParamList,
  "FollowDetails"
>;

export type ForgotPasswordScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "ForgotPassword"
>;

export type FavouriteListpops = NativeStackScreenProps<
  RootStackParamList,
  "FavouriteList"
>;

export type AllParticipantpops = NativeStackScreenProps<
  RootStackParamList,
  "AllParticipant"
>;
