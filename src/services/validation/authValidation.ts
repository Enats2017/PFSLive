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

export interface LoginFormData {
  email: string;
  password: string;
}

type ValidationErrors = Record<string, string | undefined>;

// ✅ CONSTANTS
const MIN_NAME_LENGTH = 2;
const MIN_PASSWORD_LENGTH = 4;
const MAX_PASSWORD_LENGTH = 20;
const EMAIL_REGEX = /\S+@\S+\.\S+/;

// ✅ VALIDATION FUNCTIONS
export const validateRegisterForm = (
  data: RegisterFormData,
  t: (key: string) => string
): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!data.firstname.trim() || data.firstname.trim().length < MIN_NAME_LENGTH) {
    errors.firstname = t('register:errors.firstnameRequired');
  }

  if (!data.lastname.trim() || data.lastname.trim().length < MIN_NAME_LENGTH) {
    errors.lastname = t('register:errors.lastnameRequired');
  }

  if (!data.email.trim() || !EMAIL_REGEX.test(data.email)) {
    errors.email = t('register:errors.emailInvalid');
  }

  if (!data.password || data.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = t('register:errors.passwordShort');
  } else if (data.password.length > MAX_PASSWORD_LENGTH) {
    errors.password = t('register:errors.passwordLong');
  }

  if (!data.countryId) {
    errors.country = t('register:errors.countryRequired');
  }

  if (!data.city.trim() || data.city.trim().length < MIN_NAME_LENGTH) {
    errors.city = t('register:errors.cityRequired');
  }

  if (!data.dob) {
    errors.dob = t('register:errors.dobRequired');
  }

  if (!data.gender) {
    errors.gender = t('register:errors.genderRequired');
  }

  if (!data.acceptedTerms) {
    errors.terms = t('register:errors.termsRequired');
  }

  return errors;
};

export const validateLoginForm = (
  data: LoginFormData,
  t: (key: string) => string
): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!data.email.trim() || !EMAIL_REGEX.test(data.email)) {
    errors.email = t('login:errors.emailInvalid');
  }

  if (!data.password || data.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = t('login:errors.passwordShort');
  }

  return errors;
};