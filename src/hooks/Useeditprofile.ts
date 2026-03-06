import { useState, useCallback, useEffect } from 'react'
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
}

export const useEditProfile = (initialProfile: Profile | null) => {

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
            dob: initialProfile.dob ?? '',
            gender: initialProfile.gender ?? '',
            countryName: initialProfile.country ?? '',
            country_id: String(initialProfile.country_id ?? ''),
            country_iso:  initialProfile.iso_code_2   ?? '', 
            password: '',
            confirmPassword: '',
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
            newErrors.firstname = 'firstname_invalid'

        if (form.lastname.trim().length < 2)
            newErrors.lastname = 'lastname_invalid'

        if (form.city.trim().length < 2)
            newErrors.city = 'city_invalid'

        if (form.dob) {
            const dobDate = new Date(form.dob)

            if (isNaN(dobDate.getTime())) {
                newErrors.dob = 'dob_invalid_format'
            } else {
                const age = Math.floor(
                    (Date.now() - dobDate.getTime()) /
                    (365.25 * 24 * 60 * 60 * 1000)
                )

                if (age < 13) newErrors.dob = 'dob_underage'
                if (age > 120) newErrors.dob = 'dob_invalid'
            }
        }

        if (form.password && form.password.length < 4)
            newErrors.password = 'password_too_short'

        if (form.password && form.password !== form.confirmPassword)
            newErrors.confirmPassword = 'passwords_do_not_match'

        setErrors(newErrors)

        return Object.keys(newErrors).length === 0
    }

    /* ============================
       SUBMIT
    ============================ */

    const submit = useCallback(async (): Promise<boolean> => {

        if (!validate()) return false

        setLoading(true)
        setSuccess(false)

        const payload: EditProfilePayload = {
            firstname: form.firstname.trim(),
            lastname: form.lastname.trim(),
            city: form.city.trim(),
            dob: form.dob || undefined,
            gender: form.gender || undefined,
            country_id: form.country_id ? Number(form.country_id) : undefined,
            language_id: getCurrentLanguageId(),
            ...(form.password && { password: form.password }),
            ...(removePicture && { remove_profile_picture: '1' as '1' }),
        }

        try {

            const result = await editProfileApi(payload, picture ?? undefined)

            setSuccess(true)

            setEmailChanged(
                result.message === 'profile_updated_verify_email'
            )

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
                    if (key) newErrors[key] = fieldError
                })

                setErrors(newErrors)
            }

            return false

        } finally {
            setLoading(false)
        }

    }, [form, picture, removePicture])

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