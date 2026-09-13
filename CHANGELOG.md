# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-09-13

### Added

- `validateDocument`, `listDocuments`, `supportedCountries` for tax IDs, national IDs and bank account numbers of 90+ countries, with person/company detection, compact and formatted output, and all ambiguous matches.
- `registerDocument` to add or override documents, and Colombia's cédula de ciudadanía (`cc`, explicit only).
- `validatePhone` with E.164/international/national output, allowed countries and line types.
- class-validator decorators `@IsDocument`, `@IsPhone` and country shortcuts; class-transformer `@NormalizeDocument` / `@NormalizePhone`.
- NestJS `ParseDocumentPipe` and `ParsePhonePipe`.
- Error messages in English, Spanish and Portuguese.
- Framework-agnostic `nestjs-intl-validators/core` entry point.
