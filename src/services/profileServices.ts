import { apiClient, AppError } from './api';
import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { isDeletedAccountCode } from './profileLoadError';

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
    pending_email?: string;  // NEW: optional field for pending email change
    parent_consent?: number;
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

    // ✅ account_not_found → session_expired. get_profile_api answers it (HTTP 400)
    //    when the token still verifies but the account row is gone or disabled.
    //    api.ts would turn that into AppError("empty", "account_not_found"), and
    //    EditProfileScreen showed the raw code with no way out. The only fix is
    //    to log in again, so it gets the same code as a rejected token and the
    //    screen offers the Log In action. See profileLoadError.ts.
    let response;
    try {
        response = await apiClient.post<ProfileResponseData>(
            getApiEndpoint(API_CONFIG.ENDPOINTS.Edit_profile),
            {},
            { headers }
        );
    } catch (err) {
        if (err instanceof AppError && isDeletedAccountCode(err.code)) {
            throw new AppError('server', 'session_expired');
        }
        throw err;
    }
    if (!response.success) {
        console.log('🔴 [fetchProfileApi] success=false, error:', response.error)
        if (isDeletedAccountCode(response.error)) {
            throw new AppError('server', 'session_expired');
        }
        throw new Error(response.error || 'Failed to load profile.');
    }

    const profile = response.data.profile
    console.log('🟢 [fetchProfileApi] Returning profile:', JSON.stringify(profile, null, 2))
    return profile;
};