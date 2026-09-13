# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting:
[Report a vulnerability](https://github.com/JavierCardonadev/nestjs-intl-validators/security/advisories/new).

Include the version and a proof of concept if possible. You will get an answer within 5 business days.

## Supported versions

The latest minor release receives security fixes.

## Notes for integrators

- Validation checks the structure of a number, not that it exists or belongs to the person submitting it. Don't use it as proof of identity.
- National IDs and tax IDs are personal data in most jurisdictions (LGPD, GDPR, Ley 1581…). Store the `compact` value, restrict access and avoid logging it.
