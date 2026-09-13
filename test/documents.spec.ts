import { describe, expect, it } from 'vitest';
import {
  documentAbbreviations,
  isValidDocument,
  listDocuments,
  registerDocument,
  supportedCountries,
  validateDocument,
} from '../src/core/index.js';

describe('validateDocument', () => {
  it.each([
    // Receita Federal examples, including the alphanumeric CNPJ format valid from July 2026.
    ['BR', '529.982.247-25', 'cpf', '52998224725', '529.982.247-25'],
    ['BR', '11.222.333/0001-81', 'cnpj', '11222333000181', '11.222.333/0001-81'],
    ['BR', '12.abc.345/01de-35', 'cnpj', '12ABC34501DE35', '12.ABC.345/01DE-35'],
    ['CO', '900.373.115-3', 'nit', '9003731153', '900.373.115-3'],
    ['CL', '76.086.428-5', 'run', '760864285', '76.086.428-5'],
    ['MX', 'GODE561231GR8', 'rfc', 'GODE561231GR8', 'GODE 561231 GR8'],
    ['MX', 'HEGG560427MVZRRL04', 'curp', 'HEGG560427MVZRRL04', 'HEGG560427MVZRRL04'],
    ['AR', '20-12345678-6', 'cuit', '20123456786', '20-12345678-6'],
    ['PE', '20131312955', 'ruc', '20131312955', '20131312955'],
    ['US', '536-90-4399', 'ssn', '536904399', '536-90-4399'],
  ])('%s %s is a valid document', (country, input, kind, compact, formatted) => {
    const result = validateDocument(input, { country });
    expect(result).toMatchObject({ valid: true, country, kind, compact, formatted });
  });

  it('reports every match when documents share an algorithm', () => {
    expect(validateDocument('76.086.428-5', { country: 'CL' })).toMatchObject({
      kind: 'run',
      matches: ['run', 'rut'],
      isPerson: true,
      isCompany: true,
    });
    expect(validateDocument('04-2103594', { country: 'US', holder: 'company' })).toMatchObject({
      kind: 'ein',
      matches: ['ein'],
      formatted: '04-2103594',
      isPerson: false,
    });
  });

  it('accepts lowercase country codes and reports holder type', () => {
    expect(validateDocument('529.982.247-25', { country: 'br' })).toMatchObject({
      valid: true,
      abbreviation: 'CPF',
      isPerson: true,
      isCompany: false,
    });
    expect(validateDocument('11.222.333/0001-81', { country: 'BR' })).toMatchObject({
      isPerson: false,
      isCompany: true,
    });
  });

  it('reports the most specific failure', () => {
    expect(validateDocument('529.982.247-26', { country: 'BR' })).toMatchObject({
      valid: false,
      error: 'invalid_checksum',
      kinds: ['cpf', 'cnpj'],
    });
    expect(validateDocument('123', { country: 'BR', kind: 'cpf' })).toMatchObject({ error: 'invalid_length' });
    expect(validateDocument('ABC.DEF.GHI-JK', { country: 'BR', kind: 'cpf' })).toMatchObject({ valid: false });
  });

  it('rejects repeated-digit CPF and CNPJ that pass the checksum', () => {
    expect(validateDocument('111.111.111-11', { country: 'BR' })).toMatchObject({
      valid: false,
      error: 'invalid_component',
    });
    expect(validateDocument('00000000000000', { country: 'BR', kind: 'cnpj' })).toMatchObject({ valid: false });
  });

  it('restricts by kind', () => {
    expect(isValidDocument('529.982.247-25', { country: 'BR', kind: 'cnpj' })).toBe(false);
    expect(isValidDocument('529.982.247-25', { country: 'BR', kind: ['CNPJ', 'CPF'] })).toBe(true);
    expect(validateDocument('x', { country: 'BR', kind: 'passport' })).toMatchObject({
      error: 'unsupported_document',
      kinds: ['passport'],
    });
  });

  it('restricts by holder', () => {
    expect(validateDocument('529.982.247-25', { country: 'BR', holder: 'company' })).toMatchObject({
      valid: false,
      kinds: ['cnpj'],
    });
    expect(validateDocument('529.982.247-25', { country: 'BR', kind: 'cpf', holder: 'company' })).toMatchObject({
      valid: false,
      error: 'invalid_holder',
    });
    expect(isValidDocument('11.222.333/0001-81', { country: 'BR', holder: 'company' })).toBe(true);
  });

  it('does not accept bank accounts unless requested by kind', () => {
    expect(isValidDocument('032180000118359719', { country: 'MX' })).toBe(false);
    expect(validateDocument('032180000118359719', { country: 'MX', kind: 'clabe' })).toMatchObject({ valid: true });
    expect(isValidDocument('2850590940090418135201', { country: 'AR', kind: 'cbu' })).toBe(true);
  });

  it('handles empty, non-string and numeric input', () => {
    expect(validateDocument('', { country: 'CO' })).toMatchObject({ error: 'required' });
    expect(validateDocument(undefined, { country: 'CO' })).toMatchObject({ error: 'required' });
    expect(validateDocument({}, { country: 'CO' })).toMatchObject({ error: 'invalid_format' });
    expect(validateDocument(-5, { country: 'CO' })).toMatchObject({ error: 'invalid_format' });
    expect(validateDocument(20131312955, { country: 'PE' })).toMatchObject({ valid: true, compact: '20131312955' });
  });

  it('rejects unknown countries', () => {
    expect(validateDocument('123', { country: 'XX' })).toEqual({
      valid: false,
      country: 'XX',
      error: 'unsupported_country',
      kinds: [],
    });
    expect(validateDocument('123', { country: undefined as unknown as string })).toMatchObject({
      error: 'unsupported_country',
    });
  });
});

describe('registerDocument', () => {
  it('ships the Colombian cédula as an explicit, format-only document', () => {
    expect(validateDocument('1.020.304.050', { country: 'CO', kind: 'cc' })).toMatchObject({
      valid: true,
      kind: 'cc',
      compact: '1020304050',
      formatted: '1.020.304.050',
      isPerson: true,
    });
    expect(validateDocument('0123', { country: 'CO', kind: 'cc' })).toMatchObject({ error: 'invalid_length' });
    expect(validateDocument('12AB', { country: 'CO', kind: 'cc' })).toMatchObject({ error: 'invalid_format' });
    // A mistyped NIT must not slip through as a cédula.
    expect(validateDocument('900.373.115-4', { country: 'CO' })).toMatchObject({ valid: false, kinds: ['nit'] });
    expect(listDocuments('CO').find((doc) => doc.kind === 'cc')).toMatchObject({ person: true, requireKind: true });
  });

  it('adds documents and countries', () => {
    registerDocument('zz', 'Member_ID', {
      name: 'Test member id',
      holder: 'both',
      compact: (value) => value.replace(/\s/g, ''),
      validate: (value) => (value.length !== 4 ? 'invalid_length' : value === '0000' ? 'invalid_checksum' : true),
      format: (value) => `${value.slice(0, 2)} ${value.slice(2)}`,
    });
    expect(supportedCountries()).toContain('ZZ');
    expect(validateDocument('12 34', { country: 'ZZ' })).toMatchObject({
      valid: true,
      kind: 'member_id',
      abbreviation: 'MEMBER_ID',
      formatted: '12 34',
      isPerson: true,
      isCompany: true,
    });
    expect(validateDocument('0000', { country: 'ZZ' })).toMatchObject({ error: 'invalid_checksum' });
    expect(validateDocument('1', { country: 'ZZ' })).toMatchObject({ error: 'invalid_length' });
  });

  it('survives throwing custom validators and formatters', () => {
    registerDocument('ZY', 'broken', {
      name: 'Broken',
      holder: 'none',
      validate: (value) => {
        if (value === 'X') throw new Error('boom');
        return true;
      },
      format: () => {
        throw new Error('boom');
      },
    });
    expect(validateDocument('ok', { country: 'ZY', kind: 'broken' })).toMatchObject({ valid: true, formatted: 'OK' });
    expect(validateDocument('x', { country: 'ZY', kind: 'broken' })).toMatchObject({ valid: false });
    expect(validateDocument('ok', { country: 'ZY' })).toMatchObject({ error: 'unsupported_document' });
  });

  it('rejects invalid registrations', () => {
    const doc = { name: 'x', holder: 'person' as const, validate: () => true as const };
    expect(() => registerDocument('COL', 'x', doc)).toThrow('invalid country code');
    expect(() => registerDocument('CO', 'a b', doc)).toThrow('invalid kind');
  });
});

describe('document catalog', () => {
  it('lists supported countries', () => {
    const countries = supportedCountries();
    expect(countries.length).toBeGreaterThan(80);
    expect(countries).toEqual(expect.arrayContaining(['AR', 'BR', 'CL', 'CO', 'MX', 'PE', 'US', 'ES']));
    expect([...countries].sort()).toEqual(countries);
  });

  it('describes documents per country', () => {
    expect(listDocuments('br')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ country: 'BR', kind: 'cpf', abbreviation: 'CPF', person: true, company: false }),
        expect.objectContaining({ country: 'BR', kind: 'cnpj', abbreviation: 'CNPJ', person: false, company: true }),
      ]),
    );
    expect(listDocuments('MX').find((doc) => doc.kind === 'clabe')).toMatchObject({ person: false, company: false });
    expect(listDocuments('XX')).toEqual([]);
    expect(listDocuments().length).toBeGreaterThan(150);
  });

  it('maps kinds to abbreviations', () => {
    expect(documentAbbreviations('BR', ['cpf', 'cnpj'])).toEqual(['CPF', 'CNPJ']);
    expect(documentAbbreviations('XX', ['foo'])).toEqual(['FOO']);
  });
});
