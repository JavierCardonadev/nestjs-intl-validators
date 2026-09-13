# Contributing

Thanks for helping! Issues and PRs are welcome in English, Spanish or Portuguese.

## Setup

```bash
git clone https://github.com/JavierCardonadev/nestjs-intl-validators.git
cd nestjs-intl-validators
npm install
npm test
```

Node.js ≥ 20.19 is required.

## Before opening a PR

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

- Keep `nestjs-intl-validators/core` free of NestJS, class-validator and class-transformer imports — it must run in browsers.
- New or changed behavior needs tests. Use real, publicly documented example numbers (tax authority examples, Wikipedia) and never real personal data.
- Wrong check-digit results for a country usually belong upstream in [stdnum-js](https://github.com/koblas/stdnum-js). Link the upstream issue or PR.
- Update `CHANGELOG.md` under **Unreleased** and both READMEs when the public API changes.
- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat(phones): …`, `fix(documents): …`).

## Releases

Maintainers tag `vX.Y.Z`; the release workflow publishes to npm with provenance.
