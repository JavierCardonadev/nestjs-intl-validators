import {
  isSupportedCountry,
  parsePhoneNumberWithError,
  ParseError,
  type CountryCode,
  type NumberType,
} from 'libphonenumber-js/max';

/** Line types reported by libphonenumber, e.g. `MOBILE`, `FIXED_LINE`, `TOLL_FREE`. */
export type PhoneType = NonNullable<NumberType>;

export type PhoneErrorCode =
  | 'required'
  | 'invalid_country'
  | 'not_a_number'
  | 'too_short'
  | 'too_long'
  | 'invalid_number'
  | 'country_not_allowed'
  | 'type_not_allowed';

export interface PhoneOptions {
  /** Country used to read numbers written without `+` (national format), e.g. `CO`. */
  country?: string;
  /** Only accept numbers from these countries. */
  allowedCountries?: string[];
  /**
   * Only accept these line types, e.g. `['MOBILE']`. Numbers that can't be told apart
   * (`FIXED_LINE_OR_MOBILE`, common in the US) are accepted for `MOBILE` and `FIXED_LINE`.
   */
  types?: PhoneType[];
}

export interface ValidPhone {
  valid: true;
  /** `+573001234567`. Store this. */
  e164: string;
  /** `+57 300 1234567` */
  international: string;
  /** `300 1234567` */
  national: string;
  /** `tel:+573001234567` */
  uri: string;
  country?: string;
  callingCode: string;
  type?: PhoneType;
}

export interface InvalidPhone {
  valid: false;
  error: PhoneErrorCode;
}

export type PhoneValidationResult = ValidPhone | InvalidPhone;

const PARSE_ERRORS: Record<string, PhoneErrorCode> = {
  INVALID_COUNTRY: 'invalid_country',
  NOT_A_NUMBER: 'not_a_number',
  TOO_SHORT: 'too_short',
  TOO_LONG: 'too_long',
  INVALID_LENGTH: 'invalid_number',
};

/**
 * Validates and normalizes a phone number with Google's libphonenumber metadata.
 *
 * ```ts
 * validatePhone('300 123 4567', { country: 'CO', types: ['MOBILE'] });
 * // { valid: true, e164: '+573001234567', type: 'MOBILE', country: 'CO', ... }
 * ```
 */
export function validatePhone(value: unknown, options: PhoneOptions = {}): PhoneValidationResult {
  if (typeof value !== 'string' || value.trim() === '') {
    return { valid: false, error: typeof value === 'string' || value == null ? 'required' : 'not_a_number' };
  }

  const defaultCountry = options.country?.toUpperCase();
  if (defaultCountry !== undefined && !isSupportedCountry(defaultCountry)) {
    return { valid: false, error: 'invalid_country' };
  }

  let phone: ReturnType<typeof parsePhoneNumberWithError>;
  try {
    phone = parsePhoneNumberWithError(value, defaultCountry as CountryCode | undefined);
  } catch (error) {
    if (error instanceof ParseError) return { valid: false, error: PARSE_ERRORS[error.message] ?? 'invalid_number' };
    throw error;
  }

  if (!phone.isValid()) return { valid: false, error: 'invalid_number' };

  const allowed = options.allowedCountries?.map((code) => code.toUpperCase());
  if (allowed && (!phone.country || !allowed.includes(phone.country))) {
    return { valid: false, error: 'country_not_allowed' };
  }

  const type = phone.getType();
  if (options.types && !typeMatches(type, options.types)) {
    return { valid: false, error: 'type_not_allowed' };
  }

  return {
    valid: true,
    e164: phone.number,
    international: phone.formatInternational(),
    national: phone.formatNational(),
    uri: phone.getURI(),
    country: phone.country,
    callingCode: phone.countryCallingCode,
    type,
  };
}

export function isValidPhone(value: unknown, options?: PhoneOptions): boolean {
  return validatePhone(value, options).valid;
}

function typeMatches(type: PhoneType | undefined, allowed: PhoneType[]): boolean {
  if (!type) return false;
  if (allowed.includes(type)) return true;
  return type === 'FIXED_LINE_OR_MOBILE' && (allowed.includes('MOBILE') || allowed.includes('FIXED_LINE'));
}
