import { plainToInstance } from 'class-transformer';
import { IsIn, IsOptional, validate } from 'class-validator';
import { afterEach, describe, expect, it } from 'vitest';
import {
  IsCbu,
  IsCc,
  IsClabe,
  IsCnpj,
  IsCpf,
  IsCuit,
  IsCurp,
  IsDocument,
  IsEin,
  IsNif,
  IsNit,
  IsPhone,
  IsRfc,
  IsRuc,
  IsRut,
  IsSsn,
  NormalizeDocument,
  NormalizePhone,
  setValidationLocale,
} from '../src/index.js';

class CustomerDto {
  @IsIn(['BR', 'CO', 'MX'])
  country!: string;

  @NormalizeDocument({ country: (dto: CustomerDto) => dto.country })
  @IsDocument({ country: (dto: CustomerDto) => dto.country })
  taxId!: string;

  @IsOptional()
  @NormalizePhone({ country: (dto: CustomerDto) => dto.country })
  @IsPhone({ country: (dto: CustomerDto) => dto.country, types: ['MOBILE'] })
  phone?: string;
}

async function check<T extends object>(cls: new () => T, plain: object) {
  const instance = plainToInstance(cls, plain);
  const errors = await validate(instance);
  return { instance, errors: Object.fromEntries(errors.map((e) => [e.property, Object.values(e.constraints ?? {})])) };
}

describe('class-validator integration', () => {
  afterEach(() => setValidationLocale('en'));

  it('validates and normalizes with a country read from the DTO', async () => {
    const { instance, errors } = await check(CustomerDto, {
      country: 'BR',
      taxId: '12.ABC.345/01DE-35',
      phone: '(11) 91234-5678',
    });
    expect(errors).toEqual({});
    expect(instance).toMatchObject({ taxId: '12ABC34501DE35', phone: '+5511912345678' });
  });

  it('reports localized, specific messages and leaves invalid values untouched', async () => {
    setValidationLocale('es');
    const { instance, errors } = await check(CustomerDto, {
      country: 'CO',
      taxId: '900.373.115-4',
      phone: '601 3456789',
    });
    expect(instance.taxId).toBe('900.373.115-4');
    expect(instance.phone).toBe('+576013456789');
    expect(errors).toEqual({
      taxId: ['taxId debe ser un NIT válido (CO): dígito de verificación incorrecto'],
      phone: ['phone debe ser un teléfono de un tipo permitido'],
    });
  });

  it('fails clearly when the country is missing', async () => {
    const { errors } = await check(CustomerDto, { taxId: '123' });
    expect(errors.taxId).toEqual(['taxId: documents from "" are not supported']);
  });

  it('supports custom messages and each validation options', async () => {
    class Dto {
      @IsCpf({}, { message: 'CPF inválido' })
      cpf!: string;

      @IsNit({}, { each: true })
      nits!: string[];
    }
    const { errors } = await check(Dto, { cpf: '111.111.111-11', nits: ['900.373.115-3', '1'] });
    expect(errors.cpf).toEqual(['CPF inválido']);
    expect(errors.nits).toHaveLength(1);
  });

  it('exposes country shortcuts', async () => {
    class Shortcuts {
      @IsCpf() cpf = '529.982.247-25';
      @IsCnpj() cnpj = '11.222.333/0001-81';
      @IsNit() nit = '900.373.115-3';
      @IsCc() cc = '1020304050';
      @IsRut() rut = '76.086.428-5';
      @IsRfc() rfc = 'GODE561231GR8';
      @IsCurp() curp = 'HEGG560427MVZRRL04';
      @IsClabe() clabe = '032180000118359719';
      @IsCuit() cuit = '20-12345678-6';
      @IsCbu() cbu = '2850590940090418135201';
      @IsRuc() ruc = '20131312955';
      @IsEin() ein = '04-2103594';
      @IsSsn() ssn = '536-90-4399';
      @IsNif() nif = '12345678Z';
    }
    expect(await validate(new Shortcuts())).toEqual([]);

    const wrong = new Shortcuts();
    wrong.cpf = '11.222.333/0001-81';
    const errors = await validate(wrong);
    expect(errors.map((e) => e.property)).toEqual(['cpf']);
    expect(Object.values(errors[0].constraints!)).toEqual(['cpf must be a valid CPF (BR): invalid length']);
  });

  it('formats documents and phones on request', async () => {
    class Dto {
      @NormalizeDocument({ country: 'CO', output: 'formatted' })
      nit!: string;

      @NormalizePhone({ country: 'MX', output: 'international' })
      intl!: string;

      @NormalizePhone({ country: 'MX', output: 'national' })
      national!: string;

      @NormalizePhone()
      invalid!: string;
    }
    const instance = plainToInstance(Dto, {
      nit: '9003731153',
      intl: '55 1234 5678',
      national: '+525512345678',
      invalid: '123',
    });
    expect(instance).toEqual({
      nit: '900.373.115-3',
      intl: '+52 55 1234 5678',
      national: '55 1234 5678',
      invalid: '123',
    });
  });
});
