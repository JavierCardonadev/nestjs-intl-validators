import type { DocumentErrorCode } from './documents.js';
import type { PhoneErrorCode } from './phones.js';

export type ValidationLocale = 'en' | 'es' | 'pt';

type Templates = {
  document: Record<DocumentErrorCode, string>;
  phone: Record<PhoneErrorCode, string>;
};

// Tokens: {property}, {document} (e.g. "CPF or CNPJ"), {country}.
const MESSAGES: Record<ValidationLocale, Templates> = {
  en: {
    document: {
      required: '{property} is required',
      unsupported_country: '{property}: documents from "{country}" are not supported',
      unsupported_document: '{property}: unsupported document type for {country}',
      invalid_format: '{property} must be a valid {document} ({country}): invalid format',
      invalid_length: '{property} must be a valid {document} ({country}): invalid length',
      invalid_component: '{property} must be a valid {document} ({country}): invalid number',
      invalid_checksum: '{property} must be a valid {document} ({country}): check digit mismatch',
      invalid_holder: '{property} must be a {document} of the expected holder type ({country})',
    },
    phone: {
      required: '{property} is required',
      invalid_country: '{property}: unsupported phone country',
      not_a_number: '{property} must be a phone number',
      too_short: '{property} must be a valid phone number: too short',
      too_long: '{property} must be a valid phone number: too long',
      invalid_number: '{property} must be a valid phone number',
      country_not_allowed: '{property} must be a phone number from an allowed country',
      type_not_allowed: '{property} must be a phone number of an allowed type',
    },
  },
  es: {
    document: {
      required: '{property} es obligatorio',
      unsupported_country: '{property}: no se admiten documentos de "{country}"',
      unsupported_document: '{property}: tipo de documento no admitido para {country}',
      invalid_format: '{property} debe ser un {document} válido ({country}): formato inválido',
      invalid_length: '{property} debe ser un {document} válido ({country}): longitud inválida',
      invalid_component: '{property} debe ser un {document} válido ({country}): número inválido',
      invalid_checksum: '{property} debe ser un {document} válido ({country}): dígito de verificación incorrecto',
      invalid_holder: '{property} debe ser un {document} del tipo de titular esperado ({country})',
    },
    phone: {
      required: '{property} es obligatorio',
      invalid_country: '{property}: país de teléfono no admitido',
      not_a_number: '{property} debe ser un número de teléfono',
      too_short: '{property} debe ser un teléfono válido: demasiado corto',
      too_long: '{property} debe ser un teléfono válido: demasiado largo',
      invalid_number: '{property} debe ser un teléfono válido',
      country_not_allowed: '{property} debe ser un teléfono de un país permitido',
      type_not_allowed: '{property} debe ser un teléfono de un tipo permitido',
    },
  },
  pt: {
    document: {
      required: '{property} é obrigatório',
      unsupported_country: '{property}: documentos de "{country}" não são suportados',
      unsupported_document: '{property}: tipo de documento não suportado para {country}',
      invalid_format: '{property} deve ser um {document} válido ({country}): formato inválido',
      invalid_length: '{property} deve ser um {document} válido ({country}): tamanho inválido',
      invalid_component: '{property} deve ser um {document} válido ({country}): número inválido',
      invalid_checksum: '{property} deve ser um {document} válido ({country}): dígito verificador incorreto',
      invalid_holder: '{property} deve ser um {document} do tipo de titular esperado ({country})',
    },
    phone: {
      required: '{property} é obrigatório',
      invalid_country: '{property}: país de telefone não suportado',
      not_a_number: '{property} deve ser um número de telefone',
      too_short: '{property} deve ser um telefone válido: muito curto',
      too_long: '{property} deve ser um telefone válido: muito longo',
      invalid_number: '{property} deve ser um telefone válido',
      country_not_allowed: '{property} deve ser um telefone de um país permitido',
      type_not_allowed: '{property} deve ser um telefone de um tipo permitido',
    },
  },
};

const CONNECTOR: Record<ValidationLocale, string> = { en: 'or', es: 'o', pt: 'ou' };

let currentLocale: ValidationLocale = 'en';

/** Language of the default error messages. Per-field `message` options always win. */
export function setValidationLocale(locale: ValidationLocale): void {
  if (!(locale in MESSAGES)) throw new Error(`Unsupported validation locale "${locale}"`);
  currentLocale = locale;
}

export function getValidationLocale(): ValidationLocale {
  return currentLocale;
}

interface MessageContext {
  property?: string;
  country?: string;
  /** Abbreviations, e.g. `['CPF', 'CNPJ']`. */
  documents?: string[];
  locale?: ValidationLocale;
}

export function documentErrorMessage(code: DocumentErrorCode, context: MessageContext = {}): string {
  const locale = context.locale ?? currentLocale;
  return render(MESSAGES[locale].document[code], context, locale);
}

export function phoneErrorMessage(code: PhoneErrorCode, context: MessageContext = {}): string {
  const locale = context.locale ?? currentLocale;
  return render(MESSAGES[locale].phone[code], context, locale);
}

function render(template: string, context: MessageContext, locale: ValidationLocale): string {
  const documents = context.documents?.length ? context.documents : ['document'];
  const label =
    documents.length === 1
      ? documents[0]
      : `${documents.slice(0, -1).join(', ')} ${CONNECTOR[locale]} ${documents[documents.length - 1]}`;
  return template
    .replaceAll('{property}', context.property ?? 'value')
    .replaceAll('{country}', context.country ?? '')
    .replaceAll('{document}', label);
}
