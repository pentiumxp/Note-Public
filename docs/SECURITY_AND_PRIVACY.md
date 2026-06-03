# Security and Privacy

## Prohibited Content

Do not write these into repository files, docs, tests, logs, screenshots, handoffs, fixtures, or generated artifacts:

- raw access keys;
- OAuth tokens;
- cookies;
- session ids;
- private keys;
- passwords;
- push endpoints;
- production database connection strings;
- complete private note bodies;
- raw prompts or raw model responses;
- long logs.

## Allowed Metadata

Allowed records are bounded metadata such as file paths, environment variable names, counts, route names, status codes, short error codes, module names, and validation command summaries.

## Local Secrets

Use ignored local `.env` files or OS-level secret storage. `.env.example` may list variable names but must not include secret values.

## Test Fixtures

Fixtures must use synthetic content only. If tests need realistic private-note shapes, use short fake examples that cannot be confused with real user data.

