import { entityValidators, personValidators, stdnum, type Validator } from 'stdnum';

/** Who the document identifies. `any` accepts both. */
export type DocumentHolder = 'person' | 'company' | 'any';

export type DocumentErrorCode =
  | 'required'
  | 'unsupported_country'
  | 'unsupported_document'
  | 'invalid_format'
  | 'invalid_length'
  | 'invalid_component'
  | 'invalid_checksum'
  | 'invalid_holder';

export interface DocumentOptions {
  /** ISO 3166-1 alpha-2 code, case-insensitive: `BR`, `co`, `US`. */
  country: string;
  /**
   * Restrict to specific documents, e.g. `'cpf'` or `['cpf', 'cnpj']`. See `listDocuments(country)`.
   * When omitted, every personal and company identifier of the country is accepted (bank accounts are not).
   */
  kind?: string | string[];
  /** Only accept documents that identify a person or a company. Default `any`. */
  holder?: DocumentHolder;
}

export interface DocumentInfo {
  country: string;
  /** Key to use in `kind`, e.g. `cnpj`. */
  kind: string;
  abbreviation: string;
  name: string;
  localName: string;
  /** Listed as a personal identifier. */
  person: boolean;
  /** Listed as a company identifier. */
  company: boolean;
  /** Only checked when requested with `kind` (format-only documents). */
  requireKind: boolean;
}

export interface ValidDocument {
  valid: true;
  country: string;
  /** First matching document. */
  kind: string;
  /**
   * Every document the value is valid for. Some share an algorithm and can't be told apart,
   * e.g. Chilean RUN/RUT or a 9-digit US SSN/EIN — pass `kind` or `holder` to disambiguate.
   */
  matches: string[];
  abbreviation: string;
  /** Separators removed, e.g. `52998224725`. Store this. */
  compact: string;
  /** Standard presentation, e.g. `529.982.247-25`. */
  formatted: string;
  /** At least one match identifies a person. */
  isPerson: boolean;
  /** At least one match identifies a company. */
  isCompany: boolean;
}

export interface InvalidDocument {
  valid: false;
  country: string;
  error: DocumentErrorCode;
  /** The documents that were checked. */
  kinds: string[];
}

export type DocumentValidationResult = ValidDocument | InvalidDocument;

const ERROR_BY_NAME: Record<string, DocumentErrorCode> = {
  InvalidFormat: 'invalid_format',
  InvalidLength: 'invalid_length',
  InvalidComponent: 'invalid_component',
  InvalidChecksum: 'invalid_checksum',
};

// When several documents fail, report the one that got furthest.
const ERROR_RANK: DocumentErrorCode[] = ['invalid_format', 'invalid_length', 'invalid_component', 'invalid_checksum'];

/** Documents whose repeated-digit sequences satisfy the checksum but are not valid identifiers. */
const REJECT_REPEATED = new Set(['BR:cpf', 'BR:cnpj']);

export type DocumentCheckError = 'invalid_format' | 'invalid_length' | 'invalid_component' | 'invalid_checksum';

/** A document added with `registerDocument`. */
export interface CustomDocument {
  /** English name, e.g. "Colombian citizenship card". */
  name: string;
  /** Name in the country's language, e.g. "Cédula de ciudadanía". */
  localName?: string;
  abbreviation?: string;
  /** Who it identifies. `none` for things like bank accounts, only accepted when requested by `kind`. */
  holder: 'person' | 'company' | 'both' | 'none';
  /** Removes separators. Default: strips spaces, dots, dashes and slashes and upper-cases. */
  compact?: (value: string) => string;
  /** Presentation format for a valid compact value. Default: the compact value. */
  format?: (compact: string) => string;
  /** Receives the compact value. Return `true` or the reason it is invalid. */
  validate: (compact: string) => true | DocumentCheckError;
  /**
   * Only check it when requested with `kind`. Use it for format-only documents without a check digit,
   * which would otherwise accept mistyped identifiers of other kinds.
   */
  requireKind?: boolean;
}

type Check = { valid: true; compact: string } | { valid: false; error: DocumentErrorCode };

interface Entry {
  kind: string;
  abbreviation: string;
  name: string;
  localName: string;
  person: boolean;
  company: boolean;
  requireKind: boolean;
  check(input: string): Check;
  format(compact: string): string;
}

/** country → kind → entry, in the order documents are tried. */
const registry = new Map<string, Map<string, Entry>>();

function fromStdnum(kind: string, validator: Validator, person: boolean, company: boolean): Entry {
  return {
    kind,
    abbreviation: validator.abbreviation ?? kind.toUpperCase(),
    name: validator.name,
    localName: validator.localName,
    person,
    company,
    requireKind: false,
    check(input) {
      const result = validator.validate(input);
      return result.isValid
        ? { valid: true, compact: result.compact }
        : { valid: false, error: ERROR_BY_NAME[result.error?.name ?? ''] ?? 'invalid_format' };
    },
    format: (compact) => validator.format(compact),
  };
}

for (const [country, validators] of Object.entries(stdnum as Record<string, Record<string, Validator>>)) {
  const people = personValidators[country] ?? [];
  const companies = entityValidators[country] ?? [];
  const kinds = new Map<string, Entry>();
  const byValidator = new Map(Object.entries(validators).map(([kind, validator]) => [validator, kind]));
  // Identity documents first (people, then companies), then everything else.
  for (const validator of [...people, ...companies, ...Object.values(validators)]) {
    const kind = byValidator.get(validator);
    if (kind && !kinds.has(kind)) {
      kinds.set(kind, fromStdnum(kind, validator, people.includes(validator), companies.includes(validator)));
    }
  }
  registry.set(country, kinds);
}

const defaultCompact = (value: string) => value.replace(/[\s./-]/g, '').toUpperCase();

/**
 * Adds or replaces a document for a country — for identifiers `stdnum` doesn't cover,
 * or to work around an upstream bug while it gets fixed.
 *
 * ```ts
 * registerDocument('CO', 'nuip', {
 *   name: 'Colombian personal identification number',
 *   holder: 'person',
 *   validate: (value) => (/^\d{10}$/.test(value) ? true : 'invalid_format'),
 * });
 * ```
 */
export function registerDocument(country: string, kind: string, document: CustomDocument): void {
  const code = normalizeCountry(country);
  const key = kind.trim().toLowerCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error(`registerDocument: invalid country code "${country}"`);
  if (!/^[a-z0-9_]+$/.test(key)) throw new Error(`registerDocument: invalid kind "${kind}"`);

  const compact = document.compact ?? defaultCompact;
  const entry: Entry = {
    kind: key,
    abbreviation: document.abbreviation ?? key.toUpperCase(),
    name: document.name,
    localName: document.localName ?? document.name,
    person: document.holder === 'person' || document.holder === 'both',
    company: document.holder === 'company' || document.holder === 'both',
    requireKind: document.requireKind ?? false,
    check(input) {
      const value = compact(input);
      const result = document.validate(value);
      return result === true ? { valid: true, compact: value } : { valid: false, error: result };
    },
    format: document.format ?? ((value) => value),
  };

  if (!registry.has(code)) registry.set(code, new Map());
  registry.get(code)!.set(key, entry);
}

// Colombia's citizenship card has no check digit (3 to 10 digits, no leading zero), so it is only
// checked when requested with `kind: 'cc'`.
registerDocument('CO', 'cc', {
  name: 'Colombian citizenship card',
  localName: 'Cédula de ciudadanía',
  abbreviation: 'CC',
  holder: 'person',
  requireKind: true,
  validate: (value) =>
    !/^\d+$/.test(value) ? 'invalid_format' : !/^[1-9]\d{2,9}$/.test(value) ? 'invalid_length' : true,
  format: (value) => value.replace(/\B(?=(\d{3})+$)/g, '.'),
});

function normalizeCountry(country: string): string {
  return typeof country === 'string' ? country.trim().toUpperCase() : '';
}

/** Countries with at least one supported document. */
export function supportedCountries(): string[] {
  return [...registry.keys()].sort();
}

/** Documents available for a country (or every country), useful to build selects in forms. */
export function listDocuments(country?: string): DocumentInfo[] {
  const countries = country === undefined ? supportedCountries() : [normalizeCountry(country)];
  return countries.flatMap((code) =>
    [...(registry.get(code)?.values() ?? [])].map((entry) => ({
      country: code,
      kind: entry.kind,
      abbreviation: entry.abbreviation,
      name: entry.name,
      localName: entry.localName,
      person: entry.person,
      company: entry.company,
      requireKind: entry.requireKind,
    })),
  );
}

function candidates(country: string, kinds: string[] | undefined, holder: DocumentHolder): Entry[] | null {
  const available = registry.get(country)!;
  if (kinds) {
    const picked = kinds.map((kind) => available.get(kind.toLowerCase()));
    return picked.every(Boolean) ? (picked as Entry[]) : null;
  }
  return [...available.values()].filter(
    (entry) => !entry.requireKind && ((holder !== 'company' && entry.person) || (holder !== 'person' && entry.company)),
  );
}

function toInput(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  return undefined;
}

function worse(current: DocumentErrorCode, next: DocumentErrorCode): DocumentErrorCode {
  return ERROR_RANK.indexOf(next) > ERROR_RANK.indexOf(current) ? next : current;
}

/**
 * Validates a tax or national identifier.
 *
 * ```ts
 * validateDocument('529.982.247-25', { country: 'BR' });
 * // { valid: true, kind: 'cpf', compact: '52998224725', formatted: '529.982.247-25', isPerson: true, ... }
 * ```
 */
export function validateDocument(value: unknown, options: DocumentOptions): DocumentValidationResult {
  const country = normalizeCountry(options.country);
  const holder = options.holder ?? 'any';
  const requestedKinds = options.kind === undefined ? undefined : [options.kind].flat();

  if (!registry.has(country)) return { valid: false, country, error: 'unsupported_country', kinds: [] };

  const entries = candidates(country, requestedKinds, holder);
  if (!entries || entries.length === 0) {
    return { valid: false, country, error: 'unsupported_document', kinds: requestedKinds ?? [] };
  }
  const kinds = entries.map((entry) => entry.kind);

  const input = toInput(value);
  if (input === undefined) {
    return {
      valid: false,
      country,
      error: typeof value === 'string' || value == null ? 'required' : 'invalid_format',
      kinds,
    };
  }

  let error: DocumentErrorCode = 'invalid_format';
  let holderMismatch = false;
  const matches: Array<{ entry: Entry; compact: string }> = [];

  for (const entry of entries) {
    let result: Check;
    try {
      result = entry.check(input);
    } catch {
      continue;
    }

    if (!result.valid) {
      error = worse(error, result.error);
      continue;
    }
    if (REJECT_REPEATED.has(`${country}:${entry.kind}`) && /^(.)\1+$/.test(result.compact)) {
      // e.g. 111.111.111-11 passes the CPF checksum but is never issued by Receita Federal.
      error = worse(error, 'invalid_component');
      continue;
    }
    if ((holder === 'person' && !entry.person) || (holder === 'company' && !entry.company)) {
      holderMismatch = true;
      continue;
    }
    matches.push({ entry, compact: result.compact });
  }

  if (matches.length === 0) {
    return { valid: false, country, error: holderMismatch ? 'invalid_holder' : error, kinds };
  }

  const [{ entry, compact }] = matches;
  return {
    valid: true,
    country,
    kind: entry.kind,
    matches: matches.map((match) => match.entry.kind),
    abbreviation: entry.abbreviation,
    compact,
    formatted: safeFormat(entry, compact),
    isPerson: matches.some((match) => match.entry.person),
    isCompany: matches.some((match) => match.entry.company),
  };
}

/** Abbreviations for document kinds of a country, e.g. `['CPF', 'CNPJ']`. Unknown kinds are upper-cased. */
export function documentAbbreviations(country: string, kinds: string[]): string[] {
  const available = registry.get(normalizeCountry(country));
  return kinds.map((kind) => available?.get(kind.toLowerCase())?.abbreviation ?? kind.toUpperCase());
}

export function isValidDocument(value: unknown, options: DocumentOptions): boolean {
  return validateDocument(value, options).valid;
}

function safeFormat(entry: Entry, compact: string): string {
  try {
    return entry.format(compact);
  } catch {
    return compact;
  }
}
