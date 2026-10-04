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
import { ageFromDob, needsParentConsent } from '../services/validation/authValidation'

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
    // ✅ Only ever shown and sent when the dob being saved lands at 13 to 17
    parentConsent: boolean
}

export type FormErrors = Partial<Record<keyof EditProfileForm, string>>

const fieldErrorMap: Partial<Record<FieldError, keyof EditProfileForm>> = {
    firstname_invalid: 'firstname',
    lastname_invalid: 'lastname',
    city_invalid: 'city',
    dob_required: 'dob',
    dob_invalid_format: 'dob',
    dob_underage: 'dob',
    dob_invalid: 'dob',
    // ✅ Lands on the checkbox, not on the date field — the date is fine, it is
    // the consent that is missing, and the message belongs next to the thing
    // they have to tick.
    parent_consent_required: 'parentConsent',
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
    parentConsent: false,
}

const toBool = (v: unknown) => v === true || Number(v) === 1

export const useEditProfile = (initialProfile: Profile | null) => {
    const { t } = useTranslation(['profile'])

    const [form, setForm] = useState<EditProfileForm>(initialFormState)
    const [errors, setErrors] = useState<FormErrors>({})
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [emailChanged, setEmailChanged] = useState(false)

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
            // ✅ Seeded from the profile, because get_profile_api DOES return
            // parent_consent and EditProfileScreen locks the box read-only when it
            // is already 1 - a tick that cannot be pre-set cannot be locked. An
            // earlier note here said it always starts unticked; that stopped being
            // true when the lock was added. The rule below still only REQUIRES a
            // tick when the date is actually changed into the 13-to-17 band, so a
            // member already in it is not blocked from editing anything else.
            parentConsent: toBool(initialProfile.parent_consent),
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

    const validate = (): boolean => {
        const newErrors: FormErrors = {}

        if (form.firstname.trim().length < 2)
            newErrors.firstname = t('profile:validation.firstname_invalid')

        if (form.lastname.trim().length < 2)
            newErrors.lastname = t('profile:validation.lastname_invalid')

        if (form.city.trim().length < 2)
            newErrors.city = t('profile:validation.city_invalid')

        if (form.dob) {
            const dobDate = new Date(form.dob)

            if (isNaN(dobDate.getTime())) {
                newErrors.dob = t('profile:validation.dob_invalid_format')
            } else if (dobDate > new Date()) {
                // ✅ A date in the FUTURE is not an age. The old calculation here
                // produced a NEGATIVE one, which then tripped the age < 13 branch
                // and told them they were too young — the wrong reason entirely.
                newErrors.dob = t('profile:validation.dob_invalid')
            } else {
                // ✅ Shared with the register form so the two cannot drift. It
                // also counts real calendar years rather than dividing by 365.25,
                // which was a day or so out around a birthday.
                const age = ageFromDob(form.dob)

                if (age === null) {
                    newErrors.dob = t('profile:validation.dob_invalid')
                } else {
                    if (age < 13) newErrors.dob = t('profile:validation.dob_underage')
                    if (age > 120) newErrors.dob = t('profile:validation.dob_invalid')

                    // ✅ 13 to 17 needs a parent's consent, exactly as a sign-up
                    // does. Checked here too so they are told before the request,
                    // not by a refusal afterwards.
                    //
                    // ONLY when the date is actually being CHANGED into that band.
                    // An account already sitting on a 13-to-17 date has had its
                    // consent decided once, and the API does not hand back whether
                    // it is on file — so demanding the tick on every save would
                    // lock those members out of editing anything at all. The API
                    // is still the authority: if it has no consent recorded it
                    // answers parent_consent_required, which maps to this same
                    // field and shows the same message.
                    const savedDob = normalizeDob(initialProfile?.dob)

                    if (form.dob !== savedDob
                        && needsParentConsent(form.dob)
                        && !form.parentConsent) {
                        newErrors.parentConsent = t('profile:validation.parent_consent_required')
                    }
                }
            }
        }

        if (form.password && form.password.length < 4)
            newErrors.password = t('profile:validation.password_too_short')

        if (form.password && form.password !== form.confirmPassword)
            newErrors.confirmPassword = t('profile:validation.passwords_do_not_match')

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const submit = useCallback(async (): Promise<boolean> => {
        if (!validate()) return false

        setLoading(true)
        setSuccess(false)

        const payload: EditProfilePayload = {
            firstname: form.firstname.trim(),
            lastname: form.lastname.trim(),
            city: form.city.trim(),
            dob: form.dob.trim(),
            gender: form.gender || undefined,
            country_id: form.country_id ? Number(form.country_id) : undefined,
            // ✅ Use language selected in form instead of getCurrentLanguageId()
            language_id: form.language_id,
            ...(form.password && { password: form.password }),
            ...(removePicture && { remove_profile_picture: '1' as '1' }),
            // ✅ Only sent when the date being saved actually asks for it. Ticking
            // the box at 15 and then changing the date to an adult one would
            // otherwise record consent nobody was ever asked for.
            ...(needsParentConsent(form.dob) && form.parentConsent
                ? { parent_consent: '1' as '1' }
                : {}),
        }

        try {
            const result = await editProfileApi(payload, picture ?? undefined)

            setSuccess(true)
            setEmailChanged(result.message === 'profile_updated_verify_email')

            setForm(prev => ({
                ...prev,
                password: '',
                confirmPassword: '',
            }))

            setPicture(null)
            setRemovePicture(false)

            return true
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
            return false
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
    }
}