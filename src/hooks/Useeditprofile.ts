import { useState, useCallback, useEffect, useRef } from 'react'
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
import {
    classifyEditProfileFailure,
    EditProfileFailure,
    tryBeginSubmit,
    endSubmit,
} from '../services/authFlowGuards'

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

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
    email_invalid: 'email',
    email_too_long: 'email',
    email_already_taken: 'email',
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
    const [emailChangeToken, setEmailChangeToken] = useState<string | null>(null)   // NEW
    const [pendingEmail, setPendingEmail] = useState<string | null>(null) 

    const [picture, setPicture] = useState<{
        uri: string
        name: string
        type: string
    } | null>(null)

    const [removePicture, setRemovePicture] = useState(false)

    // ✅ One save at a time (audit 2026-11-26, finding 9). With an email change
    // each save mints a new email_change_token + code, so a same-frame double tap
    // could route to the OTP screen with the token whose code was overwritten.
    const submittingRef = useRef(false)

    // ✅ The form as loaded from the server - what an unsaved draft is measured
    // against (re-audit A11, see EditProfileScreen).
    const [baseline, setBaseline] = useState<EditProfileForm | null>(null)

    useEffect(() => {
        if (!initialProfile) return

        const loaded: EditProfileForm = {
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
        }
        setForm(loaded)
        setBaseline(loaded)
    }, [initialProfile])

    // ✅ Put a restored draft back over the loaded profile (never passwords).
    const applyDraft = useCallback((values: Partial<EditProfileForm>) => {
        setForm(prev => ({ ...prev, ...values, password: prev.password, confirmPassword: prev.confirmPassword }))
    }, [])

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

        if (candidate.password && candidate.password.length < 4)
            newErrors.password = t('profile:validation.password_too_short')

        if (candidate.password && candidate.password !== candidate.confirmPassword)
            newErrors.confirmPassword = t('profile:validation.passwords_do_not_match')

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const submit = useCallback(async (
        overrides?: Partial<EditProfileForm>,
        // onlyEmail: send JUST the email (the pending-address "verify" button).
        // It used to submit the whole form, so a restored draft or a half-typed
        // edit was saved silently by a tap on "verify my email" (second audit,
        // AUE). edit_profile_api.php updates only the fields it receives.
        opts?: { cancelEmailChange?: boolean; onlyEmail?: boolean }
    ): Promise<{
        ok: boolean
        isEmailChange: boolean
        emailChangeToken: string | null
        pendingEmail: string | null
        // ✅ Why it failed, so the screen can SAY so. Every failure that was not a
        // mapped field error used to end silently (finding 5). Undefined when ok,
        // when a second tap was refused, or when the inline errors already explain it.
        failure?: EditProfileFailure
        // The server's field codes, so a caller can tell "address taken" apart.
        fieldErrors?: string[]
    }> => {
        const effective: EditProfileForm = { ...form, ...overrides }

        if (opts?.onlyEmail) {
            if (!EMAIL_REGEX.test(effective.email.trim())) {
                return { ok: false, isEmailChange: false, emailChangeToken: null, pendingEmail: null, fieldErrors: ['email_invalid'] }
            }
        } else if (!validate(effective)) return { ok: false, isEmailChange: false, emailChangeToken: null, pendingEmail: null }

        if (!tryBeginSubmit(submittingRef)) return { ok: false, isEmailChange: false, emailChangeToken: null, pendingEmail: null }

        setLoading(true)
        setSuccess(false)

        const payload: EditProfilePayload = opts?.onlyEmail ? { email: effective.email.trim().toLowerCase() } : {
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
            // ✅ Only sent when the date being saved actually asks for it. Ticking
            // the box at 15 and then changing the date to an adult one would
            // otherwise record consent nobody was ever asked for.
            ...(needsParentConsent(form.dob) && form.parentConsent
                ? { parent_consent: '1' as '1' }
                : {}),
        }

        try {
            const result = await editProfileApi(payload, opts?.onlyEmail ? undefined : (picture ?? undefined))

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

            if (!opts?.onlyEmail) {
                setPicture(null)
                setRemovePicture(false)
            }

            return { ok: true, isEmailChange, emailChangeToken, pendingEmail }
        } catch (err) {
            let mappedFieldError = false
            if (err instanceof ValidationError) {
                const newErrors: FormErrors = {}
                err.fields.forEach((fieldError) => {
                    const key = fieldErrorMap[fieldError]
                    if (key) {
                        newErrors[key] = t(`profile:validation.${fieldError}`)
                        mappedFieldError = true
                    }
                })
                setErrors(newErrors)
            }
            // A rejected photo arrives in `fields` but has no field to land on, and
            // the server then saves NOTHING else either - it must be said.
            const failure = classifyEditProfileFailure({
                fields: err instanceof ValidationError ? err.fields : undefined,
                code: (err as any)?.code,
                type: (err as any)?.type,
                message: (err as any)?.message,
            })
            const silentlyExplained = mappedFieldError && failure !== 'picture'
            return {
                ok: false, isEmailChange: false, emailChangeToken: null, pendingEmail: null,
                failure: silentlyExplained ? undefined : failure,
                fieldErrors: err instanceof ValidationError ? err.fields : undefined,
            }
        } finally {
            setLoading(false)
            endSubmit(submittingRef)
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
        baseline,
        applyDraft,
        emailChangeToken,   // NEW
        pendingEmail, 
    }
}