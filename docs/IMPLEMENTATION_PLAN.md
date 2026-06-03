# Implementation Plan

## Phase 0: Initialization

Files:

- `.agent-context/PROJECT_CONTEXT.md`
- `.agent-context/HANDOFF.md`
- `README.md`
- `.gitignore`
- `.env.example`
- `docs/*.md`
- `src/services/note-service.js`
- `src/stores/memory-note-store.js`
- `src/providers/file-note-provider.js`
- `tests/note-service.test.js`
- `scripts/privacy-scan.js`

Checks:

```powershell
npm test
npm run check
npm run privacy
git diff --check
```

Rollback:

- Remove the scaffold files before any user data is created.

## Phase 1: Confirm MVP

Target confirmed as an Evernote/Yinxiang-style notes product. First implementation is a local web prototype with no proprietary branding or real cloud sync.

Checks:

- Documentation review against `docs/REQUIREMENTS.md`.
- Update H1/H2/H3 classifications in `docs/TEST_MATRIX.md`.

## Phase 1A: Local Workspace Prototype

Files:

- `public/index.html`
- `public/styles.css`
- `public/app.js`
- `src/view-models/workspace-view-model.js`
- `tests/workspace-view-model.test.js`

Checks:

```powershell
npm test
npm run check
npm run privacy
```

Reference gaps to close:

- add mobile bottom navigation parity for 首页/搜索/新建/模板/我的;
- add create bottom-sheet menu for text, super note, photo metadata, recording metadata, and attachment metadata;
- add dedicated template placeholder surface;
- add account/status surface with privacy-safe local sync information only.

## Phase 2: Storage

Implement a real store behind the current store contract.

Files:

- `src/stores/<selected-store>.js`
- `tests/<selected-store>.test.js`
- `docs/DATA_MODEL.md`

Checks:

- Store contract tests.
- Migration dry run if existing notes are imported.

## Phase 3: Interface

Add CLI, API, or UI only after ownership and contracts are documented.

Files depend on selected interface:

- CLI: `src/cli/*`
- API: `src/routes/*`
- UI: `src/features/notes/*`

Checks:

- Contract/projection tests for H2.
- Workflow harness for H1 flows.

## Phase 4: Import/Export Harness

Import/export is H1 once it writes external state, processes private content in batches, or must be recoverable.

Checks:

- success;
- validation failure;
- duplicate submission;
- retry;
- recovery;
- privacy boundary;
- idempotency.

## Phase 5: Deployment

Production deployment remains blocked until a deployment target is selected and `docs/DEPLOYMENT.md` is expanded.
