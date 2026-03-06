import { apiClient } from './api';
import { API_CONFIG, getApiEndpoint } from '../constants/config';

/* ============================
   PROFILE TYPE
============================ */

export interface Profile {
    firstname: string;
    lastname: string;
    email: string;
    city: string;
    country_id: number;
    country: string;
     iso_code_2:      string;   // ← add this
    iso_code_3:      string; 
    dob: string;
    gender: string;
    profile_picture: string;
    language_id: number;
    email_verified: number;
}

interface ProfileResponseData {
    profile: Profile;
}

/* ============================
   FETCH PROFILE
============================ */

export const fetchProfileApi = async (): Promise<Profile> => {
    const headers = await API_CONFIG.getHeaders();
    console.log('🔵 [fetchProfileApi] Calling endpoint:', API_CONFIG.ENDPOINTS.Edit_profile)

    const response = await apiClient.post<ProfileResponseData>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.Edit_profile),
        {},
        { headers }
    );
    if (!response.success) {
        console.log('🔴 [fetchProfileApi] success=false, error:', response.error)
        throw new Error(response.error || 'Failed to load profile.');
    }

    const profile = response.data.profile
    console.log('🟢 [fetchProfileApi] Returning profile:', JSON.stringify(profile, null, 2))
    return profile;
};