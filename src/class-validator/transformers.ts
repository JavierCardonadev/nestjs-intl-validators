import { Transform } from 'class-transformer';
import {
  runDocumentValidation,
  runPhoneValidation,
  type IsDocumentOptions,
  type IsPhoneOptions,
} from './decorators.js';

export interface NormalizeDocumentOptions extends IsDocumentOptions {
  /** `compact` (default) strips separators; `formatted` applies the standard presentation. */
  output?: 'compact' | 'formatted';
}

export interface NormalizePhoneOptions extends IsPhoneOptions {
  /** Default `e164`. */
  output?: 'e164' | 'international' | 'national';
}

/**
 * Rewrites valid documents to a canonical form during `plainToInstance` (ValidationPipe `transform: true`).
 * Invalid values are left untouched so the validation decorators can report them.
 */
export function NormalizeDocument(options: NormalizeDocumentOptions): PropertyDecorator {
  return Transform(({ value, obj }) => {
    const result = runDocumentValidation(value, options, obj);
    if (!result.valid) return value;
    return options.output === 'formatted' ? result.formatted : result.compact;
  });
}

/** Rewrites valid phone numbers to E.164 (or another format) during `plainToInstance`. */
export function NormalizePhone(options: NormalizePhoneOptions = {}): PropertyDecorator {
  return Transform(({ value, obj }) => {
    const result = runPhoneValidation(value, options, obj);
    if (!result.valid) return value;
    return options.output === 'international'
      ? result.international
      : options.output === 'national'
        ? result.national
        : result.e164;
  });
}
