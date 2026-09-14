# nestjs-intl-validators

[![CI](https://github.com/JavierCardonadev/nestjs-intl-validators/actions/workflows/ci.yml/badge.svg)](https://github.com/JavierCardonadev/nestjs-intl-validators/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/nestjs-intl-validators.svg)](https://www.npmjs.com/package/nestjs-intl-validators)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Country-aware validation for NestJS and class-validator.** Tax IDs, national IDs, bank account numbers and phone numbers for 90+ countries — with normalization, person/company detection and messages in English, Spanish and Portuguese.

> 🇪🇸 [Leer en español](README.es.md)

```ts
class CreateCustomerDto {
  @IsISO31661Alpha2()
  country: string;

  @NormalizeDocument({ country: (dto) => dto.country }) // '529.982.247-25' → '52998224725'
  @IsDocument({ country: (dto) => dto.country })
  taxId: string;

  @NormalizePhone({ country: (dto) => dto.country }) // '(11) 91234-5678' → '+5511912345678'
  @IsPhone({ country: (dto) => dto.country, types: ['MOBILE'] })
  phone: string;
}
```

## Why

Regex checks accept `111.111.111-11` as a CPF and `12345` as a NIT. Real validation needs each country's check-digit algorithm, and real apps need more than `true/false`: the canonical value to store, the formatted value to show, whether it belongs to a person or a company, and an error message the user understands.

This package wraps two battle-tested, dependency-free libraries and adds what NestJS apps need on top:

- [`stdnum`](https://github.com/koblas/stdnum-js) — check-digit algorithms for 90+ countries (a port of python-stdnum), including Brazil's **alphanumeric CNPJ** introduced in July 2026.
- [`libphonenumber-js`](https://gitlab.com/catamphetamine/libphonenumber-js) — Google's phone metadata.

What you get:

- `@IsDocument`, `@IsPhone` and shortcuts (`@IsCpf`, `@IsCnpj`, `@IsNit`, `@IsCc`, `@IsRut`, `@IsRfc`, `@IsCurp`, `@IsCuit`, `@IsRuc`, `@IsSsn`, `@IsEin`, `@IsNif`, `@IsClabe`, `@IsCbu`).
- **Dynamic country**: read it from another field of the DTO.
- `@NormalizeDocument` / `@NormalizePhone` transformers, so you always store the same format.
- `ParseDocumentPipe` / `ParsePhonePipe` for params and query strings.
- Specific errors (`invalid_checksum`, `invalid_length`, `type_not_allowed`…) with messages in 🇺🇸 🇪🇸 🇧🇷.
- A framework-agnostic core (`nestjs-intl-validators/core`) that also runs in the browser, so frontend and backend share the same rules.

## Install

```bash
npm install nestjs-intl-validators class-validator class-transformer
```

Node.js ≥ 20.19. NestJS 11 or 12. For the core only (React, Vue, Express, workers), `class-validator`, `class-transformer` and `@nestjs/common` are not needed.

## Usage

### DTO validation

Enable `transform: true` so normalizers run:

```ts
app.useGlobalPipes(new ValidationPipe({ transform: true }));
```

```ts
import { IsDocument, IsPhone, NormalizeDocument, NormalizePhone, IsNit } from 'nestjs-intl-validators';

export class CompanyDto {
  @IsIn(['CO', 'MX', 'BR'])
  country: string;

  // Only company identifiers of the selected country (NIT, RFC, CNPJ…).
  @NormalizeDocument({ country: (dto: CompanyDto) => dto.country, holder: 'company' })
  @IsDocument({ country: (dto: CompanyDto) => dto.country, holder: 'company' })
  taxId: string;

  // Fixed country and document.
  @IsNit()
  supplierNit: string;

  // Only Mexican or Colombian mobiles, stored as E.164.
  @NormalizePhone({ country: 'MX' })
  @IsPhone({ country: 'MX', allowedCountries: ['MX', 'CO'], types: ['MOBILE'] })
  whatsapp: string;
}
```

Response for an invalid body:

```json
{ "message": ["taxId must be a valid NIT (CO): check digit mismatch"], "error": "Bad Request", "statusCode": 400 }
```

`@IsDocument` options:

| Option    | Description                                                          |
| --------- | -------------------------------------------------------------------- |
| `country` | ISO 3166-1 alpha-2 code or `(dto) => code`                           |
| `kind`    | Restrict to `'cpf'`, `['cpf', 'cnpj']`… See `listDocuments(country)` |
| `holder`  | `'person'`, `'company'` or `'any'` (default)                         |

Without `kind`, every personal and company identifier of the country is accepted. Bank account numbers (CLABE, CBU…) are only accepted when requested with `kind`.

### Pipes

```ts
@Get('companies/:nit')
findCompany(@Param('nit', new ParseDocumentPipe({ country: 'CO', kind: 'nit' })) nit: string) {
  // '900.373.115-3' arrives as '9003731153'
}

@Get('contacts')
findContact(@Query('phone', new ParsePhonePipe({ country: 'BR', optional: true })) phone?: string) {}
```

Options: `output` (`compact` | `formatted` | `result`, or `e164` | `international` | `national` | `result` for phones), `optional`, `exceptionFactory(message, code)`.

### Core (any framework, browser included)

```ts
import { validateDocument, validatePhone, listDocuments } from 'nestjs-intl-validators/core';

validateDocument('12.ABC.345/01DE-35', { country: 'BR' });
// {
//   valid: true, country: 'BR', kind: 'cnpj', matches: ['cnpj'], abbreviation: 'CNPJ',
//   compact: '12ABC34501DE35', formatted: '12.ABC.345/01DE-35', isPerson: false, isCompany: true
// }

validateDocument('900.373.115-4', { country: 'CO' });
// { valid: false, country: 'CO', error: 'invalid_checksum', kinds: ['nit'] }

validatePhone('300 123 4567', { country: 'CO', types: ['MOBILE'] });
// { valid: true, e164: '+573001234567', international: '+57 300 1234567', national: '300 1234567',
//   uri: 'tel:+573001234567', country: 'CO', callingCode: '57', type: 'MOBILE' }

listDocuments('MX');
// [{ kind: 'clabe', abbreviation: 'CLABE', person: false, company: false, ... },
//  { kind: 'curp', person: true, ... }, { kind: 'rfc', company: true, ... }]
```

**Ambiguous documents.** Some identifiers share an algorithm and can't be told apart by the number alone — Chilean RUN/RUT, or a 9-digit US SSN/EIN. `matches` lists every document the value is valid for; pass `kind` or `holder` when you need one in particular.

### Custom documents

Add identifiers that aren't covered, or override one while an upstream fix lands:

```ts
import { registerDocument } from 'nestjs-intl-validators';

registerDocument('CO', 'nuip', {
  name: 'Colombian personal identification number',
  localName: 'Número único de identificación personal',
  holder: 'person',
  requireKind: true, // no check digit: only validate when asked for explicitly
  validate: (value) => (/^\d{10}$/.test(value) ? true : 'invalid_length'),
});
```

Colombia's `cc` (cédula de ciudadanía) ships this way: it has no check digit, so it is only checked with `kind: 'cc'` or `@IsCc()` — otherwise a mistyped NIT would pass as a cédula.

### Messages

```ts
import { setValidationLocale } from 'nestjs-intl-validators';

setValidationLocale('es'); // 'en' (default) | 'es' | 'pt'
// "taxId debe ser un NIT válido (CO): dígito de verificación incorrecto"
```

The standard `message` validation option overrides it per field. For per-request translations, use the error codes (`validateDocument(...).error`) with your i18n library.

## Error codes

| Documents                                                                                                                                                | Phones                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `required`, `unsupported_country`, `unsupported_document`, `invalid_format`, `invalid_length`, `invalid_component`, `invalid_checksum`, `invalid_holder` | `required`, `invalid_country`, `not_a_number`, `too_short`, `too_long`, `invalid_number`, `country_not_allowed`, `type_not_allowed` |

## Coverage

Documents from 90+ countries, including all of Latin America's major economies:

| Country                                | Documents (`kind`)                                    |
| -------------------------------------- | ----------------------------------------------------- |
| 🇦🇷 Argentina                           | `cuit` (CUIT/CUIL), `dni`, `cbu`                      |
| 🇧🇴 Bolivia                             | `ci`                                                  |
| 🇧🇷 Brazil                              | `cpf`, `cnpj` (numeric and alphanumeric)              |
| 🇨🇱 Chile                               | `run`, `rut`                                          |
| 🇨🇴 Colombia                            | `nit`, `cc` (explicit `kind` only)                    |
| 🇨🇷 Costa Rica                          | `cpf`, `cpj`, `cr`                                    |
| 🇩🇴 Dominican Republic                  | `cedula`, `rnc`, `ncf`                                |
| 🇪🇨 Ecuador                             | `ci`, `ruc`                                           |
| 🇬🇹 Guatemala                           | `cui`, `nit`                                          |
| 🇲🇽 Mexico                              | `rfc`, `curp`, `clabe`                                |
| 🇵🇪 Peru                                | `ruc`, `cui` (DNI), `ce`                              |
| 🇵🇾 Paraguay                            | `ruc`, `cedula`                                       |
| 🇸🇻 El Salvador                         | `nit`                                                 |
| 🇺🇾 Uruguay                             | `rut`, `cedula`, `nie`                                |
| 🇻🇪 Venezuela                           | `rif`                                                 |
| 🇺🇸 United States                       | `ssn`, `ein`                                          |
| 🇪🇸 Spain                               | `nif`, `dni`, `nie`, `cif`, `nss`                     |
| 🇪🇺 Europe, 🌏 Asia, 🌍 Africa, 🇨🇦 🇦🇺 … | VAT and national identifiers — call `listDocuments()` |

Phone numbers: every country in Google's libphonenumber metadata.

> Validation proves a number is well-formed, not that it exists or is active. Use the tax authority's API for that.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Algorithm bugs for a specific country are best fixed upstream in [stdnum-js](https://github.com/koblas/stdnum-js); open an issue here too so the fix gets picked up.

## Need help with a LATAM product?

I'm Javier Cardona, a full-stack developer in Colombia. I build backends for companies selling in Latin America: payments, e-invoicing, onboarding/KYC flows and integrations. See also [nestjs-latam-payments](https://github.com/JavierCardonadev/nestjs-latam-payments), [nestjs-einvoicing](https://github.com/JavierCardonadev/nestjs-einvoicing), [nestjs-whatsapp](https://github.com/JavierCardonadev/nestjs-whatsapp) and [nestjs-shipping](https://github.com/JavierCardonadev/nestjs-shipping).

👉 **[javiercardona.dev](https://javiercardona.dev)**

## License

[MIT](LICENSE) © Javier Cardona. Includes no copy of the underlying libraries; `stdnum` and `libphonenumber-js` are MIT-licensed dependencies.
