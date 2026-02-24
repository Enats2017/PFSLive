// registerValidation.ts

export interface RegisterFormData {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
    countryId: string;
    city: string;
    dob: string;
    gender: string;
    acceptedTerms: boolean;
}

export interface RegisterErrors {
    firstname?: string;
    lastname?: string;
    email?: string;
    password?: string;
    country?: string;
    city?: string;
    dob?: string;
    gender?: string;
    terms?: string;
}

// ─── Client side validation ──────────────────────────────────────
export const validateRegisterForm = (data: RegisterFormData,  t: (key: string) => string ): Record<string, string | undefined> => {
    const errors:  Record<string, string | undefined> = {};
    if (!data.firstname.trim() || data.firstname.trim().length < 2)
       errors.firstname = t('register:errors.firstnameRequired');

    if (!data.lastname.trim() || data.lastname.trim().length < 2)
        errors.lastname = t('register:errors.lastnameRequired');

    if (!data.email.trim() || !/\S+@\S+\.\S+/.test(data.email))
       errors.email = t('register:errors.emailInvalid');

    if (!data.password || data.password.length < 4)
       errors.password = t('register:errors.passwordShort');

    if (data.password.length > 20)
        errors.password = t('register:errors.passwordLong');

    if (!data.countryId)
        errors.country = t('register:errors.countryRequired');

    if (!data.city.trim() || data.city.trim().length < 2)
         errors.city = t('register:errors.cityRequired');

    if (!data.dob)
         errors.dob = t('register:errors.dobRequired');

    if (!data.gender)
         errors.gender = t('register:errors.genderRequired');
    if (!data.acceptedTerms)
        errors.terms = t('register:errors.termsRequired');

    return errors;
};

// ─── Map backend field errors to form errors ─────────────────────
// export const mapBackendErrors = (fields: string[]): RegisterErrors => {
//     const errors: RegisterErrors = {};

//     fields.forEach((field) => {
//         if (field.includes('firstname'))    errors.firstname = 'First name is required';
//         if (field.includes('lastname'))     errors.lastname  = 'Last name is required';
//         if (field.includes('email_exists')) errors.email     = 'This email is already registered';
//         if (field.includes('email'))        errors.email     = errors.email ?? 'Invalid email address';
//         if (field.includes('password'))     errors.password  = 'Password is too short';
//         if (field.includes('country'))      errors.country   = 'Please select a valid country';
//         if (field.includes('city'))         errors.city      = 'City is required';
//         if (field.includes('dob'))          errors.dob       = 'Invalid date of birth';
//         if (field.includes('gender'))       errors.gender    = 'Please select your gender';
//         if (field.includes('agree'))        errors.terms     = 'You must accept the terms';
//     });

//     return errors;
// };