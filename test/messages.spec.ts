import { afterEach, describe, expect, it } from 'vitest';
import {
  documentErrorMessage,
  getValidationLocale,
  phoneErrorMessage,
  setValidationLocale,
} from '../src/core/index.js';

describe('messages', () => {
  afterEach(() => setValidationLocale('en'));

  it('renders English by default', () => {
    expect(getValidationLocale()).toBe('en');
    expect(
      documentErrorMessage('invalid_checksum', { property: 'taxId', country: 'BR', documents: ['CPF', 'CNPJ'] }),
    ).toBe('taxId must be a valid CPF or CNPJ (BR): check digit mismatch');
    expect(phoneErrorMessage('invalid_number')).toBe('value must be a valid phone number');
  });

  it('switches locale globally or per call', () => {
    setValidationLocale('es');
    expect(documentErrorMessage('invalid_length', { property: 'nit', country: 'CO', documents: ['NIT'] })).toBe(
      'nit debe ser un NIT válido (CO): longitud inválida',
    );
    expect(
      documentErrorMessage('invalid_checksum', {
        property: 'doc',
        country: 'BR',
        documents: ['A', 'B', 'C'],
        locale: 'pt',
      }),
    ).toBe('doc deve ser um A, B ou C válido (BR): dígito verificador incorreto');
    expect(phoneErrorMessage('too_short', { property: 'tel', locale: 'pt' })).toBe(
      'tel deve ser um telefone válido: muito curto',
    );
  });

  it('rejects unknown locales', () => {
    expect(() => setValidationLocale('fr' as 'en')).toThrow('Unsupported validation locale "fr"');
  });
});
