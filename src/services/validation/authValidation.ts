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
  parentConsent: boolean;
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

// ✅ AGE RULES — mirror api/register_api.php. Under 13 cannot hold an account at
// all; 13 to 17 can, but only with a parent/guardian's consent, because an app
// sign-up has no order to record that consent on the way a website registration
// does. Keep these two numbers in step with the backend.
const MIN_AGE = 13;
const ADULT_AGE = 18;

/**
 * ✅ Age in whole years, or null when it genuinely cannot be told.
 *
 * null for an absent date — which is allowed and common, see the DOB note in
 * validateRegisterForm — and also for a date in the FUTURE, which is bad data
 * rather than an age. The backend takes the same position in all four places it
 * reads a date of birth: one it cannot make sense of means "unknown age", never
 * "assume adult".
 */
export const ageFromDob = (dob: string): number | null => {
  if (!dob || !dob.trim()) return null;

  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;

  const now = new Date();
  if (born > now) return null;

  let age = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) {
    age -= 1;
  }
  return age;
};

/**
 * ✅ Is this date of birth in the 13-to-17 band, where a parent's consent is
 * required before the account can be created?
 *
 * false for an absent date. No date means no age check at all — that is the
 * deliberate rule, and it is why the consent box must stay hidden until a date
 * has actually been picked.
 */
export const needsParentConsent = (dob: string): boolean => {
  const age = ageFromDob(dob);
  return age !== null && age >= MIN_AGE && age < ADULT_AGE;
};

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

  // DOB is optional (Apple guideline — don't require more personal data than
  // necessary). No client-side requirement; when a date IS picked the date
  // picker already guarantees a valid format.
  
  // if (!data.dob) {
  //   errors.dob = t('register:errors.dobRequired');
  // }

  // ✅ 13 to 17 needs a parent's consent. Checked here as well as on the server
  // so the person is told before they submit — the backend answers
  // parent_consent_required, and finding out only after a round trip on a form
  // you have already filled in is a poor way to learn it.
  //
  // Under 13 is deliberately NOT handled here: the backend owns that refusal
  // (dob_underage) and already has a mapped message, so duplicating the cut-off
  // in two places only creates somewhere for them to drift apart.
  if (needsParentConsent(data.dob) && !data.parentConsent) {
    errors.parentConsent = t('register:errors.parentConsentRequired');
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