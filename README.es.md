# nestjs-intl-validators

[![CI](https://github.com/JavierCardonadev/nestjs-intl-validators/actions/workflows/ci.yml/badge.svg)](https://github.com/JavierCardonadev/nestjs-intl-validators/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/nestjs-intl-validators.svg)](https://www.npmjs.com/package/nestjs-intl-validators)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-blue.svg)](LICENSE)

**Validación por país para NestJS y class-validator.** Documentos tributarios, de identidad, cuentas bancarias y teléfonos de más de 90 países, con normalización, detección persona/empresa y mensajes en español, inglés y portugués.

> 🇺🇸 [Read in English](README.md)

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

## ¿Por qué?

Una regex acepta `111.111.111-11` como CPF y `12345` como NIT. Validar de verdad exige el algoritmo de dígito de verificación de cada país, y una app real necesita más que `true/false`: el valor canónico para guardar, el formateado para mostrar, si pertenece a una persona o a una empresa, y un mensaje de error que el usuario entienda.

Este paquete se apoya en dos librerías probadas y sin dependencias, y agrega lo que una app NestJS necesita:

- [`stdnum`](https://github.com/koblas/stdnum-js): algoritmos de verificación de más de 90 países (port de python-stdnum), incluido el **CNPJ alfanumérico** de Brasil vigente desde julio de 2026.
- [`libphonenumber-js`](https://gitlab.com/catamphetamine/libphonenumber-js): la metadata de teléfonos de Google.

Qué obtienes:

- `@IsDocument`, `@IsPhone` y atajos (`@IsCpf`, `@IsCnpj`, `@IsNit`, `@IsCc`, `@IsRut`, `@IsRfc`, `@IsCurp`, `@IsCuit`, `@IsRuc`, `@IsSsn`, `@IsEin`, `@IsNif`, `@IsClabe`, `@IsCbu`).
- **País dinámico**: se lee de otro campo del DTO.
- Transformadores `@NormalizeDocument` / `@NormalizePhone` para guardar siempre el mismo formato.
- `ParseDocumentPipe` / `ParsePhonePipe` para params y query strings.
- Errores específicos (`invalid_checksum`, `invalid_length`, `type_not_allowed`…) con mensajes en 🇪🇸 🇺🇸 🇧🇷.
- Un núcleo independiente del framework (`nestjs-intl-validators/core`) que también corre en el navegador: frontend y backend comparten las mismas reglas.

## Instalación

```bash
npm install nestjs-intl-validators class-validator class-transformer
```

Node.js ≥ 20.19. NestJS 11 o 12. Si solo usas el núcleo (React, Vue, Express, workers) no necesitas `class-validator`, `class-transformer` ni `@nestjs/common`.

## Uso

### Validación de DTOs

Activa `transform: true` para que corran los normalizadores:

```ts
app.useGlobalPipes(new ValidationPipe({ transform: true }));
```

```ts
import { IsDocument, IsPhone, NormalizeDocument, NormalizePhone, IsNit } from 'nestjs-intl-validators';

export class CompanyDto {
  @IsIn(['CO', 'MX', 'BR'])
  country: string;

  // Solo documentos de empresa del país elegido (NIT, RFC, CNPJ…).
  @NormalizeDocument({ country: (dto: CompanyDto) => dto.country, holder: 'company' })
  @IsDocument({ country: (dto: CompanyDto) => dto.country, holder: 'company' })
  taxId: string;

  // País y documento fijos.
  @IsNit()
  supplierNit: string;

  // Solo celulares de México o Colombia, guardados en E.164.
  @NormalizePhone({ country: 'MX' })
  @IsPhone({ country: 'MX', allowedCountries: ['MX', 'CO'], types: ['MOBILE'] })
  whatsapp: string;
}
```

Opciones de `@IsDocument`:

| Opción    | Descripción                                                          |
| --------- | -------------------------------------------------------------------- |
| `country` | Código ISO 3166-1 alfa-2 o `(dto) => código`                         |
| `kind`    | Restringe a `'cpf'`, `['cpf', 'cnpj']`… Ver `listDocuments(country)` |
| `holder`  | `'person'`, `'company'` o `'any'` (por defecto)                      |

Sin `kind` se acepta cualquier documento de persona o empresa del país. Las cuentas bancarias (CLABE, CBU…) solo se aceptan si las pides con `kind`.

### Pipes

```ts
@Get('companies/:nit')
findCompany(@Param('nit', new ParseDocumentPipe({ country: 'CO', kind: 'nit' })) nit: string) {
  // '900.373.115-3' llega como '9003731153'
}

@Get('contacts')
findContact(@Query('phone', new ParsePhonePipe({ country: 'BR', optional: true })) phone?: string) {}
```

Opciones: `output` (`compact` | `formatted` | `result`, o `e164` | `international` | `national` | `result` en teléfonos), `optional`, `exceptionFactory(message, code)`.

### Núcleo (cualquier framework, incluso el navegador)

```ts
import { validateDocument, validatePhone, listDocuments } from 'nestjs-intl-validators/core';

validateDocument('12.ABC.345/01DE-35', { country: 'BR' });
// { valid: true, kind: 'cnpj', compact: '12ABC34501DE35', formatted: '12.ABC.345/01DE-35', isCompany: true, ... }

validateDocument('900.373.115-4', { country: 'CO' });
// { valid: false, country: 'CO', error: 'invalid_checksum', kinds: ['nit'] }

validatePhone('300 123 4567', { country: 'CO', types: ['MOBILE'] });
// { valid: true, e164: '+573001234567', national: '300 1234567', type: 'MOBILE', ... }

listDocuments('MX'); // para armar selects: clabe, curp, rfc con nombre local y tipo de titular
```

**Documentos ambiguos.** Algunos comparten algoritmo y no se distinguen solo por el número: RUN/RUT en Chile, o SSN/EIN de 9 dígitos en EE. UU. `matches` lista todos los documentos para los que el valor es válido; usa `kind` o `holder` cuando necesites uno en particular.

### Documentos personalizados

Agrega identificadores que no están cubiertos, o reemplaza uno mientras llega un arreglo upstream:

```ts
import { registerDocument } from 'nestjs-intl-validators';

registerDocument('CO', 'nuip', {
  name: 'Colombian personal identification number',
  localName: 'Número único de identificación personal',
  holder: 'person',
  requireKind: true, // sin dígito de verificación: solo se valida si se pide explícitamente
  validate: (value) => (/^\d{10}$/.test(value) ? true : 'invalid_length'),
});
```

La `cc` (cédula de ciudadanía) de Colombia viene incluida así: no tiene dígito de verificación, por eso solo se valida con `kind: 'cc'` o `@IsCc()`; si no, un NIT mal digitado pasaría como cédula.

### Mensajes

```ts
import { setValidationLocale } from 'nestjs-intl-validators';

setValidationLocale('es'); // 'en' (por defecto) | 'es' | 'pt'
// "taxId debe ser un NIT válido (CO): dígito de verificación incorrecto"
```

La opción estándar `message` lo sobrescribe por campo. Para traducir por petición, usa los códigos de error con tu librería de i18n.

## Códigos de error

| Documentos                                                                                                                                               | Teléfonos                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `required`, `unsupported_country`, `unsupported_document`, `invalid_format`, `invalid_length`, `invalid_component`, `invalid_checksum`, `invalid_holder` | `required`, `invalid_country`, `not_a_number`, `too_short`, `too_long`, `invalid_number`, `country_not_allowed`, `type_not_allowed` |

## Cobertura

La tabla completa por país está en el [README en inglés](README.md#coverage): toda Latinoamérica (CUIT, CPF/CNPJ, RUT, NIT, RFC/CURP, RUC, RIF…), Estados Unidos, España, Europa y más. `listDocuments()` devuelve la lista exacta.

> Validar comprueba que el número está bien formado, no que exista o esté activo. Para eso usa la API de la autoridad tributaria.

## Contribuir

Issues y PRs bienvenidos: ver [CONTRIBUTING.md](CONTRIBUTING.md). Los errores de algoritmo de un país se corrigen mejor en [stdnum-js](https://github.com/koblas/stdnum-js); abre también un issue aquí para incorporarlo.

## ¿Necesitas ayuda con un producto para LATAM?

Soy Javier Cardona, desarrollador full-stack en Colombia. Construyo backends para empresas que venden en Latinoamérica: pagos, facturación electrónica, onboarding/KYC e integraciones. Mira también [nestjs-latam-payments](https://github.com/JavierCardonadev/nestjs-latam-payments).

👉 **[javiercardona.dev](https://javiercardona.dev)**

## Licencia

[MIT](LICENSE) © Javier Cardona.
