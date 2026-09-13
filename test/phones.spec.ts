import { describe, expect, it } from 'vitest';
import { isValidPhone, validatePhone } from '../src/core/index.js';

describe('validatePhone', () => {
  it('normalizes national numbers with a default country', () => {
    expect(validatePhone('300 123 4567', { country: 'co' })).toEqual({
      valid: true,
      e164: '+573001234567',
      international: '+57 300 1234567',
      national: '300 1234567',
      uri: 'tel:+573001234567',
      country: 'CO',
      callingCode: '57',
      type: 'MOBILE',
    });
  });

  it('parses international numbers without a country', () => {
    expect(validatePhone('+55 11 91234-5678')).toMatchObject({ valid: true, country: 'BR', type: 'MOBILE' });
  });

  it('maps parse errors', () => {
    expect(validatePhone('')).toEqual({ valid: false, error: 'required' });
    expect(validatePhone(3001234567)).toEqual({ valid: false, error: 'not_a_number' });
    expect(validatePhone('hello')).toEqual({ valid: false, error: 'not_a_number' });
    expect(validatePhone('3001234567')).toEqual({ valid: false, error: 'invalid_country' });
    expect(validatePhone('300', { country: 'ZZ' })).toEqual({ valid: false, error: 'invalid_country' });
    expect(validatePhone('+57 3')).toMatchObject({ valid: false, error: 'too_short' });
    expect(validatePhone('+57 300 123 4567 8901 2345 678')).toMatchObject({ valid: false, error: 'too_long' });
    expect(validatePhone('+57 100 000 0000')).toMatchObject({ valid: false, error: 'invalid_number' });
  });

  it('restricts countries', () => {
    expect(isValidPhone('+525512345678', { allowedCountries: ['mx', 'CO'] })).toBe(true);
    expect(validatePhone('+12125550123', { allowedCountries: ['MX'] })).toEqual({
      valid: false,
      error: 'country_not_allowed',
    });
  });

  it('restricts line types, treating FIXED_LINE_OR_MOBILE as both', () => {
    expect(validatePhone('601 3456789', { country: 'CO', types: ['MOBILE'] })).toEqual({
      valid: false,
      error: 'type_not_allowed',
    });
    expect(isValidPhone('601 3456789', { country: 'CO', types: ['FIXED_LINE'] })).toBe(true);
    expect(isValidPhone('+12125550123', { types: ['MOBILE'] })).toBe(true);
    expect(isValidPhone('+12125550123', { types: ['TOLL_FREE'] })).toBe(false);
  });
});
