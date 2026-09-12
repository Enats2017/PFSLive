import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Profile } from '../services/profileServices'
import {
    editProfileApi,
    EditProfilePayload,
    FieldError,
    ValidationError,
} from '../services/Editprofileservice'
import { getCurrentLanguageId } from '../i18n'
import { Country } from '../components/CountrySelector'

export interface EditProfileForm {
    firstname: string
    lastname: string
    email: string
    city: string
    dob: string
    gender: string
    countryName: string
    country_id: string
    country_iso: string
    password: string
    confirmPassword: string
    language_id: number  // ✅ 1=English, 2=Dutch, 3=French
}

export type FormErrors = Partial<Record<keyof EditProfileForm, string>>

// ✅ Exported so EditProfileScreen can decide whether to open the email-change
// confirm modal without duplicating the pattern. validate() below is still the
// authority — this is only used to avoid prompting on an obviously bad address.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const fieldErrorMap: Partial<Record<FieldError, keyof EditProfileForm>> = {
    firstname_invalid: 'firstname',
    lastname_invalid: 'lastname',
    city_invalid: 'city',
    dob_required: 'dob',
    dob_invalid_format: 'dob',
    dob_underage: 'dob',
    dob_invalid: 'dob',
    email_already_taken: 'email',
    gender_invalid: 'gender',
    country_invalid: 'countryName',
    country_not_found: 'countryName',
    password_too_short: 'password',
    password_too_long: 'password',
}

const initialFormState: EditProfileForm = {
    firstname: '',
    lastname: '',
    email: '',
    city: '',
    dob: '',
    gender: '',
    countryName: '',
    country_id: '',
    country_iso: '',
    password: '',
    confirmPassword: '',
    language_id: getCurrentLanguageId() ?? 1,  // ✅ Default from current app language
}

export const useEditProfile = (initialProfile: Profile | null) => {
    const { t } = useTranslation(['profile'])

    const [form, setForm] = useState<EditProfileForm>(initialFormState)
    const [errors, setErrors] = useState<FormErrors>({})
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [emailChanged, setEmailChanged] = useState(false)
    const [emailChangeToken, setEmailChangeToken] = useState<string | null>(null)   // NEW
    const [pendingEmail, setPendingEmail] = useState<string | null>(null) 

    const [picture, setPicture] = useState<{
        uri: string
        name: string
        type: string
    } | null>(null)

    const [removePicture, setRemovePicture] = useState(false)

    useEffect(() => {
        if (!initialProfile) return

        setForm({
            firstname: initialProfile.firstname ?? '',
            lastname: initialProfile.lastname ?? '',
            email: initialProfile.email ?? '',
            city: initialProfile.city ?? '',
            dob: normalizeDob(initialProfile.dob),
            gender: initialProfile.gender ?? '',
            countryName: initialProfile.country ?? '',
            country_id: String(initialProfile.country_id ?? ''),
            country_iso: initialProfile.iso_code_2 ?? '',
            password: '',
            confirmPassword: '',
            // ✅ Use profile language_id if available, fall back to current app language
            language_id: initialProfile.language_id ?? getCurrentLanguageId() ?? 1,
        })
    }, [initialProfile])

    const setField = useCallback(
        <K extends keyof EditProfileForm>(key: K, value: EditProfileForm[K]) => {
            setForm(prev => ({ ...prev, [key]: value }))
            setErrors(prev => ({ ...prev, [key]: undefined }))
        },
        []
    )

    const handleCountrySelect = useCallback((country: Country) => {
        setForm(prev => ({
            ...prev,
            countryName: country.name,
            country_id: country.country_id,
            country_iso: country.iso_code_2,
        }))
        setErrors(prev => ({ ...prev, countryName: undefined }))
    }, [])

    const validate = (candidate: EditProfileForm): boolean => {
        const newErrors: FormErrors = {}

        if (candidate.firstname.trim().length < 2)
            newErrors.firstname = t('profile:validation.firstname_invalid')

        if (candidate.lastname.trim().length < 2)
            newErrors.lastname = t('profile:validation.lastname_invalid')

        if (candidate.city.trim().length < 2)
            newErrors.city = t('profile:validation.city_invalid')

        const trimmedEmail = candidate.email.trim()
        if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
            newErrors.email = t('profile:validation.email_invalid')
        }

        if (candidate.dob) {
            const dobDate = new Date(candidate.dob)

            if (isNaN(dobDate.getTime())) {
                newErrors.dob = t('profile:validation.dob_invalid_format')
            } else {
                const age = Math.floor(
                    (Date.now() - dobDate.getTime()) /
                    (365.25 * 24 * 60 * 60 * 1000)
                )
                if (age < 13) newErrors.dob = t('profile:validation.dob_underage')
                if (age > 120) newErrors.dob = t('profile:validation.dob_invalid')
            }
        }

        if (candidate.password && candidate.password.length < 4)
            newErrors.password = t('profile:validation.password_too_short')

        if (candidate.password && candidate.password !== candidate.confirmPassword)
            newErrors.confirmPassword = t('profile:validation.passwords_do_not_match')

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    // ✅ `overrides` exists for the pending-email banner: "Verify now" re-submits
    // the pending address to get a fresh token and "Cancel change" re-submits the
    // confirmed one to clear it. Both need a different email than the one sitting
    // in `form`, and setField-then-submit would read a stale closure.
    const submit = useCallback(async (
        overrides?: Partial<EditProfileForm>,
        opts?: { cancelEmailChange?: boolean }
    ): Promise<{
        ok: boolean
        isEmailChange: boolean
        emailChangeToken: string | null
        pendingEmail: string | null
    }> => {
        const effective: EditProfileForm = { ...form, ...overrides }

        if (!validate(effective)) return { ok: false, isEmailChange: false, emailChangeToken: null, pendingEmail: null }

        setLoading(true)
        setSuccess(false)

        const payload: EditProfilePayload = {
            firstname: effective.firstname.trim(),
            lastname: effective.lastname.trim(),
            email: effective.email.trim().toLowerCase(),
            city: effective.city.trim(),
            dob: effective.dob.trim(),
            gender: effective.gender || undefined,
            country_id: effective.country_id ? Number(effective.country_id) : undefined,
            // ✅ Use language selected in form instead of getCurrentLanguageId()
            language_id: effective.language_id,
            ...(effective.password && { password: effective.password }),
            ...(removePicture && { remove_profile_picture: '1' as '1' }),
            ...(opts?.cancelEmailChange && { cancel_email_change: '1' as '1' }),
        }

        try {
            const result = await editProfileApi(payload, picture ?? undefined)

            const isEmailChange = result.message === 'profile_updated_verify_email'
            const emailChangeToken = isEmailChange ? result.email_change_token ?? null : null
            const pendingEmail = isEmailChange ? result.profile.pending_email ?? null : null

            // ✅ The inline banner means "your edits were saved". Cancelling a
            // pending email change is its own action with its own toast, so it
            // must not raise the banner too. `success` was already reset to false
            // at the top of submit(), so this settles it without a flash.
            setSuccess(!opts?.cancelEmailChange)
            setEmailChanged(isEmailChange)
            setEmailChangeToken(emailChangeToken)
            setPendingEmail(pendingEmail)

            setForm(prev => ({
                ...prev,
                password: '',
                confirmPassword: '',
            }))

            setPicture(null)
            setRemovePicture(false)

            return { ok: true, isEmailChange, emailChangeToken, pendingEmail }
        } catch (err) {
            if (err instanceof ValidationError) {
                const newErrors: FormErrors = {}
                err.fields.forEach((fieldError) => {
                    const key = fieldErrorMap[fieldError]
                    if (key) {
                        newErrors[key] = t(`profile:validation.${fieldError}`)
                    }
                })
                setErrors(newErrors)
            }
            return { ok: false, isEmailChange: false, emailChangeToken: null, pendingEmail: null }
        } finally {
            setLoading(false)
        }
    }, [form, picture, removePicture, t])

    // MySQL returns an unset DATE as '0000-00-00' (and some drivers as '0000-00-00 00:00:00').
    // Treat those — and any all-zero variant — as empty so the DOB field renders blank.
    const normalizeDob = (dob?: string | null): string => {
        const v = (dob ?? '').trim();
        if (v === '') return '';
        // strip time part if present, then check for the zero-date sentinel
        const datePart = v.split(' ')[0];
        return /^0{4}-0{2}-0{2}$/.test(datePart) ? '' : datePart;
    };

    return {
        form,
        setField,
        handleCountrySelect,
        errors,
        loading,
        success,
        emailChanged,
        picture,
        setPicture,
        removePicture,
        setRemovePicture,
        submit,
        emailChangeToken,   // NEW
        pendingEmail, 
    }
}