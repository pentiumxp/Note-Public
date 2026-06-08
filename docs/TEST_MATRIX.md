# Test Matrix

## Full Gates

```powershell
npm test
npm run check
npm run check:architecture
npm run privacy
python -m py_compile scripts/note_mcp_stdio.py
git diff --check
```

## Architecture Boundary

- Service tests verify business behavior without route/UI code.
- Future route/UI entrypoints must call services and avoid owning note lifecycle rules.
- Hermes plugin routes must delegate registration, launch, hashing, and workspace validation to `src/services/hermes-plugin-service.js`.
- SQLite persistence must keep every query scoped by `workspace_id`.
- MCP wrapper must expose local tool names only; Hermes Agent owns the `mcp_note_` callable prefix.
- MCP attachment saves must accept only bounded base64 payloads, reject model-provided paths/URLs/keys, and preserve only sanitized metadata.
- Reference Graph writes must use service/store boundaries, stable object refs, allowed relation values, `workspace_id` filtering, and idempotency keys.
- Main Hermes plugin route must stay a compositor; app, notes, and reference behavior belongs in route groups and services.

## Module Tests

| Module | Test | Level |
| --- | --- | --- |
| Note service | `tests/note-service.test.js` | H2 |
| Workspace projection | `tests/workspace-view-model.test.js` | H2 |
| Hermes plugin service | `tests/hermes-plugin-service.test.js` | H2 |
| Embedded app workspace isolation | `tests/app-launch-workspace-routes.test.js` | H2 |
| SQLite isolation | `tests/sqlite-note-store.test.js` | H2 |
| MCP wrapper contract | `tests/mcp-wrapper.test.js` | H2 |
| MCP attachment materialization | `tests/mcp-attachment-service.test.js` | H2 |
| MCP note attachment routes | `tests/mcp-notes-attachment-routes.test.js` | H2 |
| Reference graph store | `tests/reference-graph-store.test.js` | H2 |
| Note reference service | `tests/note-reference-service.test.js` | H2 |
| Reference API routes | `tests/reference-api-routes.test.js` | H2 |
| App attachment file preview routes | `tests/attachment-file-preview-routes.test.js` | H2 |
| Imported body and notebook display | `tests/body-rendering-and-notebooks.test.js` | H2 |
| Embedded iframe contract | `tests/embedded-contract.test.js` | H2 |
| Embedded create sheet right-swipe dismiss | `scripts/create-sheet-gesture-harness.js` | H2 |
| Yinxiang `.notes` import parser | `tests/yinxiang-import.test.js` | H2 |
| Architecture guardrail | `scripts/check-architecture.js` | H2 |
| Mobile navigation/create menu DOM | future DOM test | H2 |
| Note store | future store contract test | H2 |
| File provider | future provider contract test | H2 |
| Import/export workflow | `scripts/import-yinxiang-notes.js --dry-run`, then counted SQLite verification | H1 when writing real exports |

## Harness Classification

H1:

- import/export that writes external state;
- sync or backfill;
- model-generated content entering saved notes;
- cross-plugin Reference / Memory Graph orchestration;
- production graph migrations or repairs;
- new reference tools exposed through selected Gateway profiles;
- multi-user permission or sharing;
- production migration/deployment.

H2:

- note service CRUD contract;
- search projection;
- route/API DTOs;
- UI state and navigation.
- localStorage persistence and desktop/mobile projection.
- create menu surface parity.
- plugin manifest/provisioning/launch contracts.
- workspace-local MCP access.
- MCP attachment save contract.
- Note-local Reference Graph store/service/API wrappers.
- app attachment preview contract for MD, DOCX, and Hermes viewer shell routing.
- imported note body rendering and notebook display repair.
- same-origin iframe message contract.
- embedded create sheet gesture dismissal.

H3:

- static docs;
- small copy/style changes;
- stateless helper changes with focused tests.

## Deployment Checks

- syntax checks for touched JavaScript files;
- startup check for future services;
- migration dry run before persistent schema changes;
- importer dry run before writing real `.notes` exports;
- version/cache smoke for future web UI.
