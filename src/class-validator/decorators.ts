import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';
import {
  documentAbbreviations,
  validateDocument,
  type DocumentOptions,
  type DocumentValidationResult,
} from '../core/documents.js';
import { documentErrorMessage, phoneErrorMessage } from '../core/messages.js';
import { validatePhone, type PhoneOptions, type PhoneValidationResult } from '../core/phones.js';

/** A fixed country code, or a function reading it from the object being validated. */
export type CountrySource = string | ((object: any) => string | undefined | null);

export interface IsDocumentOptions extends Omit<DocumentOptions, 'country'> {
  country: CountrySource;
}

export interface IsPhoneOptions extends Omit<PhoneOptions, 'country'> {
  country?: CountrySource;
}

export function resolveCountry(source: CountrySource | undefined, object: object): string | undefined {
  const value = typeof source === 'function' ? source(object) : source;
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

export function runDocumentValidation(
  value: unknown,
  options: IsDocumentOptions,
  object: object,
): DocumentValidationResult {
  return validateDocument(value, { ...options, country: resolveCountry(options.country, object) ?? '' });
}

export function runPhoneValidation(value: unknown, options: IsPhoneOptions, object: object): PhoneValidationResult {
  return validatePhone(value, { ...options, country: resolveCountry(options.country, object) });
}

/**
 * Validates a tax or national identifier for a country.
 *
 * ```ts
 * @IsDocument({ country: 'BR', kind: ['cpf', 'cnpj'] })
 * taxId: string;
 *
 * @IsDocument({ country: (dto: CustomerDto) => dto.country, holder: 'company' })
 * taxId: string;
 * ```
 */
export function IsDocument(options: IsDocumentOptions, validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isDocument',
      target: target.constructor,
      propertyName: propertyName as string,
      constraints: [options],
      options: validationOptions,
      validator: {
        validate: (value: unknown, args: ValidationArguments) =>
          runDocumentValidation(value, options, args.object).valid,
        defaultMessage: (args: ValidationArguments) => {
          const result = runDocumentValidation(args.value, options, args.object);
          const country = result.country;
          return documentErrorMessage(result.valid ? 'invalid_format' : result.error, {
            property: args.property,
            country,
            documents: result.valid ? [result.abbreviation] : documentAbbreviations(country, result.kinds),
          });
        },
      },
    });
  };
}

/**
 * Validates a phone number and, optionally, its country and line type.
 *
 * ```ts
 * @IsPhone({ country: 'MX', types: ['MOBILE'] })
 * phone: string;
 * ```
 */
export function IsPhone(options: IsPhoneOptions = {}, validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isPhone',
      target: target.constructor,
      propertyName: propertyName as string,
      constraints: [options],
      options: validationOptions,
      validator: {
        validate: (value: unknown, args: ValidationArguments) => runPhoneValidation(value, options, args.object).valid,
        defaultMessage: (args: ValidationArguments) => {
          const result = runPhoneValidation(args.value, options, args.object);
          return phoneErrorMessage(result.valid ? 'invalid_number' : result.error, { property: args.property });
        },
      },
    });
  };
}

type Shortcut = (
  options?: Omit<IsDocumentOptions, 'country' | 'kind'>,
  validationOptions?: ValidationOptions,
) => PropertyDecorator;

const shortcut =
  (country: string, kind: string): Shortcut =>
  (options, validationOptions) =>
    IsDocument({ ...options, country, kind }, validationOptions);

/** 🇧🇷 Cadastro de Pessoas Físicas. */
export const IsCpf = shortcut('BR', 'cpf');
/** 🇧🇷 Cadastro Nacional da Pessoa Jurídica, numeric and alphanumeric (2026). */
export const IsCnpj = shortcut('BR', 'cnpj');
/** 🇨🇴 Número de Identificación Tributaria (with check digit). */
export const IsNit = shortcut('CO', 'nit');
/** 🇨🇴 Cédula de ciudadanía (format only: no check digit exists). */
export const IsCc = shortcut('CO', 'cc');
/** 🇨🇱 Rol Único Tributario. */
export const IsRut = shortcut('CL', 'rut');
/** 🇲🇽 Registro Federal de Contribuyentes. */
export const IsRfc = shortcut('MX', 'rfc');
/** 🇲🇽 Clave Única de Registro de Población. */
export const IsCurp = shortcut('MX', 'curp');
/** 🇲🇽 CLABE interbank account number. */
export const IsClabe = shortcut('MX', 'clabe');
/** 🇦🇷 Clave Única de Identificación Tributaria (CUIT/CUIL). */
export const IsCuit = shortcut('AR', 'cuit');
/** 🇦🇷 Clave Bancaria Uniforme. */
export const IsCbu = shortcut('AR', 'cbu');
/** 🇵🇪 Registro Único de Contribuyentes. */
export const IsRuc = shortcut('PE', 'ruc');
/** 🇺🇸 Social Security Number. */
export const IsSsn = shortcut('US', 'ssn');
/** 🇺🇸 Employer Identification Number. */
export const IsEin = shortcut('US', 'ein');
/** 🇪🇸 Número de Identificación Fiscal. */
export const IsNif = shortcut('ES', 'nif');
