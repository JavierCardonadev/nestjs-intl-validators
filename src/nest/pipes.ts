import { BadRequestException, type ArgumentMetadata, type PipeTransform } from '@nestjs/common';
import {
  documentAbbreviations,
  validateDocument,
  type DocumentOptions,
  type ValidDocument,
} from '../core/documents.js';
import { documentErrorMessage, phoneErrorMessage } from '../core/messages.js';
import { validatePhone, type PhoneOptions, type ValidPhone } from '../core/phones.js';

interface PipeBaseOptions {
  /** Let `undefined`, `null` and `''` through as `undefined`. */
  optional?: boolean;
  /** Build your own exception (e.g. to use an error code instead of a message). */
  exceptionFactory?: (message: string, code: string) => unknown;
}

export interface ParseDocumentPipeOptions extends DocumentOptions, PipeBaseOptions {
  /** `compact` (default), `formatted`, or the full validation `result`. */
  output?: 'compact' | 'formatted' | 'result';
}

export interface ParsePhonePipeOptions extends PhoneOptions, PipeBaseOptions {
  /** `e164` (default), `international`, `national`, or the full validation `result`. */
  output?: 'e164' | 'international' | 'national' | 'result';
}

const isEmpty = (value: unknown) => value === undefined || value === null || value === '';

/**
 * Validates and normalizes a document in route params, query or body fields.
 *
 * ```ts
 * @Get(':taxId')
 * find(@Param('taxId', new ParseDocumentPipe({ country: 'CO', kind: 'nit' })) nit: string) {}
 * ```
 */
export class ParseDocumentPipe implements PipeTransform<unknown, string | ValidDocument | undefined> {
  constructor(private readonly options: ParseDocumentPipeOptions) {}

  transform(value: unknown, metadata: ArgumentMetadata): string | ValidDocument | undefined {
    if (this.options.optional && isEmpty(value)) return undefined;

    const result = validateDocument(value, this.options);
    if (!result.valid) {
      const message = documentErrorMessage(result.error, {
        property: metadata.data ?? 'value',
        country: result.country,
        documents: documentAbbreviations(result.country, result.kinds),
      });
      throw this.options.exceptionFactory?.(message, result.error) ?? new BadRequestException(message);
    }

    if (this.options.output === 'result') return result;
    return this.options.output === 'formatted' ? result.formatted : result.compact;
  }
}

/**
 * Validates and normalizes a phone number (E.164 by default).
 *
 * ```ts
 * @Get('by-phone/:phone')
 * find(@Param('phone', new ParsePhonePipe({ country: 'BR' })) phone: string) {}
 * ```
 */
export class ParsePhonePipe implements PipeTransform<unknown, string | ValidPhone | undefined> {
  constructor(private readonly options: ParsePhonePipeOptions = {}) {}

  transform(value: unknown, metadata: ArgumentMetadata): string | ValidPhone | undefined {
    if (this.options.optional && isEmpty(value)) return undefined;

    const result = validatePhone(value, this.options);
    if (!result.valid) {
      const message = phoneErrorMessage(result.error, { property: metadata.data ?? 'value' });
      throw this.options.exceptionFactory?.(message, result.error) ?? new BadRequestException(message);
    }

    switch (this.options.output) {
      case 'result':
        return result;
      case 'international':
        return result.international;
      case 'national':
        return result.national;
      default:
        return result.e164;
    }
  }
}
