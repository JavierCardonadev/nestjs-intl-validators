// Framework-agnostic entry point: no NestJS or class-validator imports. Safe for browsers.
export {
  documentAbbreviations,
  isValidDocument,
  listDocuments,
  registerDocument,
  supportedCountries,
  validateDocument,
  type CustomDocument,
  type DocumentCheckError,
  type DocumentErrorCode,
  type DocumentHolder,
  type DocumentInfo,
  type DocumentOptions,
  type DocumentValidationResult,
  type InvalidDocument,
  type ValidDocument,
} from './documents.js';
export {
  isValidPhone,
  validatePhone,
  type InvalidPhone,
  type PhoneErrorCode,
  type PhoneOptions,
  type PhoneType,
  type PhoneValidationResult,
  type ValidPhone,
} from './phones.js';
export {
  documentErrorMessage,
  getValidationLocale,
  phoneErrorMessage,
  setValidationLocale,
  type ValidationLocale,
} from './messages.js';
