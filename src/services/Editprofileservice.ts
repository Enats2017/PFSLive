import { apiClient } from './api';
import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { Profile } from './profileServices';

/* ============================
   TYPES
============================ */

export interface EditProfilePayload {
    firstname?: string;
    lastname?: string;
    city?: string;
    country_id?: number;
    dob?: string;
    gender?: string;
    language_id?: number;
    password?: string;
    remove_profile_picture?: '1' | '';
    // Parent/guardian consent, required by the API when the dob being saved puts
    // the person at 13 to 17. Sent as '1'/'0' because this payload goes out as
    // multipart, where everything is a string anyway.
    parent_consent?: '1' | '0';
    // profile_picture is handled as FormData (multipart)
}

export interface EditProfileResponse {
    message: 'profile_updated' | 'profile_updated_verify_email';
    profile: Profile;
    verification_token?: string;
}

export type FieldError =
    | 'firstname_invalid'
    | 'lastname_invalid'
    | 'email_invalid'
    | 'email_too_long'
    | 'email_already_taken'
    | 'city_invalid'
    | 'country_invalid'
    | 'country_not_found'
    | 'dob_required'
    | 'dob_invalid_format'
    | 'dob_underage'
    | 'dob_invalid'
    // Saving a dob that puts the person at 13 to 17 without a parent's consent.
    // This is the route round the sign-up rule — register as an adult, where
    // nothing is asked, then edit the date down afterwards — so the API asks for
    // the same consent here unless the account already carries it.
    | 'parent_consent_required'
    | 'gender_invalid'
    | 'password_too_short'
    | 'password_too_long'
    | 'profile_picture_too_large'
    | 'profile_picture_invalid_type'
    | 'profile_picture_invalid'
    | 'profile_picture_save_failed'
    | 'profile_picture_partial'
    | 'profile_picture_server_error'
    | 'profile_picture_failed';

export class ValidationError extends Error {
    fields: FieldError[];
    constructor(fields: FieldError[]) {
        super('validation_failed');
        this.fields = fields;
    }
}

/* ============================
   API CALL
============================ */



export const editProfileApi = async (
    payload: EditProfilePayload,
    profilePicture?: { uri: string; name: string; type: string }
): Promise<EditProfileResponse> => {
    const headers = await API_CONFIG.getHeaders();

    // Use FormData to support optional file upload
    const formData = new FormData();

    // Fields where an EMPTY value is meaningful ("clear this") and must be sent,
    // not skipped. dob is optional + clearable: '' tells the API to blank it in
    // both tables. Everything else keeps the "skip empty" behaviour so untouched
    // fields aren't needlessly sent.
    const ALWAYS_SEND = new Set<keyof EditProfilePayload>(['dob']);

    (Object.keys(payload) as (keyof EditProfilePayload)[]).forEach((key) => {
        const val = payload[key];
        if (val === undefined) return;                       // truly not provided → skip
        if (val === '' && !ALWAYS_SEND.has(key)) return;     // empty + not clearable → skip
        formData.append(key, String(val));                   // send (incl. dob='')
    });

    if (profilePicture) {
        formData.append('profile_picture', {
            uri: profilePicture.uri,
            name: profilePicture.name,
            type: profilePicture.type,
        } as any);
    }

    // Override Content-Type so axios sets multipart boundary correctly
    const multipartHeaders = {
        ...headers,
        'Content-Type': 'multipart/form-data',
    };

    const response = await apiClient.post<EditProfileResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.upadte_profile),
        formData,
        { headers: multipartHeaders }
    );

    if (!response.success) {
        // Validation errors with field list
        if (response.error === 'validation_failed' && (response as any).fields) {
            throw new ValidationError((response as any).fields);
        }
        throw new Error(response.error || 'edit_profile_failed');
    }

    return response.data;
};