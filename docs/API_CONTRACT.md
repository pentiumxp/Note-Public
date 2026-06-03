# API Contract

No HTTP API exists in the initialization scaffold.

Future API routes must call the note service and return bounded DTOs. They must not contain note lifecycle business rules.

## Draft Error Codes

- `NOTE_VALIDATION_FAILED`
- `NOTE_NOT_FOUND`
- `NOTE_PERMISSION_DENIED`
- `NOTE_PROVIDER_FAILED`

