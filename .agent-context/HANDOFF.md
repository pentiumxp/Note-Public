# Handoff

## Current Goal

Build a notes product that basically recreates China edition Yinxiang Biji/Evernote-style workflows and can integrate as an independent Hermes Mobile Note plugin with workspace isolation, SQLite persistence, provisioning/launch contracts, same-origin embedding, and workspace-bound MCP tools.

## Git Status

- Local Git repository initialized with `git init`.
- No commit, push, or deploy has been performed.

## Completed

- Created required docs-first project structure.
- Added durable `.agent-context` files.
- Added README, `.gitignore`, `.env.example`, package scripts, service/store/provider skeletons, tests, and privacy scan.
- Added requirements, architecture, implementation plan, test matrix, security/privacy, deployment, API contract, data model, first runbook, and Hermes plugin docs.
- Installed China edition Yinxiang Biji Android package `com.yinxiang`, version `10.8.38`, from the official download endpoint.
- Captured privacy-safe reference UI structure for home and create-menu surfaces. Raw UI dumps were removed; only redacted safe dumps remain under ignored `tmp/`.
- Implemented local web prototype with mobile-style home/search/create/templates/me structure, note browsing, editor, attachment metadata, photo/file attachment flow, and session-only image previews.
- Added Hermes plugin contract implementation:
  - `GET /api/v1/hermes/plugin/manifest`
  - `POST /api/v1/hermes/plugin/workspaces`
  - `POST /api/v1/hermes/plugin/launch`
  - bounded notes API for MCP access under `/api/v1/notes`
- Added Note-owned SQLite persistence in `src/stores/sqlite-note-store.js`, including `plugin_workspaces`, `launch_tokens`, `notebooks`, `notes`, and `attachments` with `workspace_id` isolation and workspace indexes.
- Added Yinxiang `.notes` importer at `scripts/import-yinxiang-notes.js`. It maps each exported file to a Note notebook, imports ENML-like note bodies into SQLite, materializes resource payloads under ignored `data/attachments/`, stores bounded attachment metadata with internal `storageKey`, and keeps raw exports under ignored `imports/`.
- Imported the current desktop-exported `.notes` files into local `data/note.sqlite3` under unbound workspace `note:yinxiang_import` / `yinxiang_import` with status `imported_unbound`.
  - Total: 15 notebooks, 559 notes, 1042 attachment records, 1042 materialized attachment files.
  - Notebook counts are visible through the local app workspace API and the web UI.
- Added same-origin app workspace API for the browser surface:
  - `GET /api/v1/app/workspace`
  - `GET /api/v1/app/notes/:id`
  These routes render the server-selected `NOTE_APP_WORKSPACE_ID` without putting a raw workspace key in frontend state.
- Added `scripts/note_mcp_stdio.py` as a workspace-bound stdio MCP wrapper. It reads only `<workspace>/.hermes-note/config.json` and `access-key.txt`, fails closed, rejects workspace/key/token overrides, and exposes local tool names.
- Added `scripts/check-architecture.js` guardrails for service-first boundaries, SQLite workspace filtering, MCP tool names, and required plugin docs.
- Added product/design docs for the next Note direction:
  - `docs/NOTE_AS_AI_MEMORY_REQUIREMENTS.md`
  - `docs/CROSS_PLUGIN_REFERENCES_DESIGN.md`
  These define Note as Hermes Mobile's non-structured memory plugin and cross-plugin reference index, not a replacement AI center.

## Not Completed

- Hermes Mobile side still needs manifest registration, plugin manager provisioning, workspace-local file writing, same-origin iframe proxying, Gateway profile MCP registration, and plugin topic/delivery binding.
- Cross-plugin references are documented but not implemented yet. Planned work includes `note_links`, link/backlink MCP tools, workspace-isolated reference queries, UI association panel, and harness coverage.
- The imported Yinxiang workspace is not yet bound to a Hermes workspace. Later binding should either map `note:yinxiang_import` to the chosen Hermes workspace or migrate the imported rows to the final `note:<hermes_workspace_id>` identity in one controlled SQLite migration.
- No Git remote, commit, push, or deployment target has been configured.
- Deeper reference exploration is still pending for search tab, templates tab, account/settings, note editor screen, and permission prompts for camera/audio/files.

## Current Risks

- Full feature parity requires more logged-in reference exploration.
- `node:sqlite` is used to avoid external dependencies in this scaffold. Node currently marks it experimental, so production deployment should pin/verify Node runtime behavior or replace it with an approved SQLite package.

## Latest Verification

- `npm test`: passed, 26 tests.
- `npm run check`: passed.
- `npm run check:architecture`: passed.
- `npm run privacy`: passed.
- `python -m py_compile scripts/note_mcp_stdio.py`: passed.
- `git diff --check`: passed.
- UTF-8 BOM check: passed.
- Local prototype server previously returned 200 at `http://localhost:4173/` and LAN `http://192.168.10.108:4173/`.
- ADB browser verification previously rendered the Note prototype at `http://127.0.0.1:4173/` after `adb reverse tcp:4173 tcp:4173`; latest phone screenshot is under ignored `tmp/note-current.png`.
- Playwright mobile verification after UI refinement rendered home, bottom tabs, create drawer, and full-screen photo-note editor; screenshots are under ignored `tmp/note-mobile-*-final.png`.
- Hermes plugin HTTP smoke on temporary port `4181`: manifest/provisioning/launch passed with a temporary SQLite database under ignored `tmp/`.
- Yinxiang `.notes` dry run against ignored `imports/yinxiang`: 15 files, 559 notes, 1042 attachment records.
- Yinxiang `.notes` real import into ignored `data/note.sqlite3` and `data/attachments/`: 15 files, 559 notes, 1042 attachment records, 1042 materialized files; counted by notebook from SQLite without reading note bodies.
- Local app HTTP smoke: `GET /api/v1/app/workspace` returned workspace `note:yinxiang_import`, 15 notebooks, 559 notes, 1042 attachments.
- Playwright browser smoke using existing Agent workspace Playwright package:
  - Mobile viewport rendered 559 `.note-row` entries and 15 notebook rows; screenshot under ignored `tmp/imported-notes-mobile.png`.
  - Desktop viewport opened a note detail and loaded body text; screenshot under ignored `tmp/imported-notes-desktop-detail.png`.
- Cross-thread return card was created through Codex Mobile Web `/api/thread-task-cards`: card id `ttc_5d81b7b57071807d08`, target thread `019e7c19-c797-7ed0-bd7d-494b5efea678`, status `pending`. Current task-card safety rules still require the target side to approve the first card before injection.

## Latest Hermes Mobile Provisioning Repair - 2026-06-03

- User reported Hermes Mobile Note plugin provisioning failed after opening the plugin.
- Production authorization state showed Note Owner with `provisioningStatus=provisioning_failed` and `provisioningError=note_owner_key_missing`.
- Root cause: Hermes Mobile attempted Note provisioning before the server-side Note registration credential file existed/read as available.
- Confirmed server-only Note registration key file exists at `C:\ProgramData\HermesMobile\data\plugin-secrets\note-owner-key.txt` without printing contents.
- Started Note service on `0.0.0.0:4181` with the same registration key path and `NOTE_APP_WORKSPACE_ID=note:yinxiang_import`.
- Direct Note smoke on port `4181` passed for manifest/provisioning/launch.
- Re-triggered Hermes Mobile Owner grant through `POST /api/hermes-plugins/note/workspaces` using the Owner Web Key only as an HTTP header, without printing it.
- Hermes Mobile state now has Note Owner `provisioningStatus=active`, empty `provisioningError`, and `noteWorkspaceId=note:owner`.
- Hermes wrote workspace-local files:
  - `C:\ProgramData\HermesMobile\data\drive\users\owner\.hermes-note\config.json`
  - `C:\ProgramData\HermesMobile\data\drive\users\owner\.hermes-note\access-key.txt`
- `config.json` points to `api_base_url=http://127.0.0.1:4181`, `workspace_id=note:owner`, and scopes `notes:read`, `notes:write`, `notes:search`.
- Note SQLite `plugin_workspaces` contains active `note:owner` with a 64-character key hash only.
- Hermes Mobile manifest for Owner now returns `available=true`, and the same-origin proxy route returns the Note HTML shell.
- Current caveat: imported Yinxiang notes are still in unbound workspace `note:yinxiang_import`; Hermes Owner is now bound to a separate empty workspace `note:owner`. A controlled migration/copy is needed if Owner should see the imported notes inside Hermes.

## Latest UI Update - Swipe Delete - 2026-06-03

- Added left-swipe delete behavior to the note list.
- Short left swipe reveals a red `删除` action. Tapping it shows a browser confirm dialog; cancel keeps the note, confirm deletes it.
- Long left swipe past the commit threshold deletes immediately without a confirm dialog.
- Added same-origin `DELETE /api/v1/app/notes/:id` for the browser app surface. It deletes only from the server-selected app workspace and soft-deletes by setting `deleted_at`, `status='trash'`, and `updated_at`.
- Restarted Note services on `0.0.0.0:4173` and `0.0.0.0:4181` so the new route and frontend are live.
- Updated static asset version in `public/index.html` to `20260603-swipe-delete`.
- Playwright smoke used temporary notes only:
  - Long swipe returned DELETE 200 and removed the row.
  - Short swipe opened the action without commit, dismissing confirm kept the row, accepting confirm deleted the row.
  - Both temporary notes are soft-deleted and no longer visible.

## Latest UI Update - Embedded Layout And Swipe Visual Harness - 2026-06-03

- Fixed Note's `embed=hermes` bottom blank band by making embedded layout iframe-relative instead of standalone viewport-relative.
- `public/index.html` now marks `document.documentElement.dataset.embed='hermes'` before CSS loads and gives the app shell `id="app"`.
- `public/styles.css` now has `html[data-embed="hermes"]` rules:
  - `html`, `body`, and `#app` use `height: 100%` and `min-height: 0`.
  - Mobile `.app-shell` uses `grid-template-rows: minmax(0, 1fr) auto` and `padding-bottom: 0`.
  - `.workspace` / `.home-surface` use iframe-relative height with internal scrolling.
  - `.mobile-tabs` is the Note-owned sticky footer inside the iframe.
- Added `tests/embedded-layout.test.js` for the embedded layout contract.
- Fixed the swipe-delete visual regression where the red delete action was visible before swiping:
  - `.note-swipe-actions` now stays behind the note content by default.
  - It is raised only while `.note-swipe-row.is-open` or `.is-commit` is active.
- Added `scripts/visual-swipe-delete-harness.js` and `npm run visual:swipe-delete`.
  - It verifies the closed row does not visually hit the delete action.
  - It verifies a short swipe reveals a reachable delete action and requires confirmation.
  - It does not save screenshots or print note bodies.
- Playwright embedded geometry smoke at mobile viewport 390x740 with `?embed=hermes`:
  - viewport bottom: `740`
  - Note bottom nav bottom: `740`
  - gap: `0px`
  - app shell padding-bottom: `0px`
  - note list overflow: `auto`
- Static asset version is now `20260603-embed-layout`.

## Latest Import Repair - Yinxiang Desktop EXB - 2026-06-03

- User reported imported notes had attachments/images but no note body.
- Root cause:
  - The desktop-exported `.notes` files store note body as `<content encoding="base64:aes">`.
  - All visible `.notes`-imported rows in `note:yinxiang_import` had `RU5D...` encrypted body payloads and no readable `<en-note>` content.
  - The `.notes` path cannot restore full bodies by itself.
- Found the logged-in desktop client local SQLite database:
  - `C:\Users\xuxin\Yinxiang Biji\Databases\xuxinxp#app.yinxiang.com.exb`
  - This database contains readable ENML in `attrs` rows with `aid=40`.
- Added `scripts/import-yinxiang-exb.js`.
  - Reads desktop EXB `note_attr`, `notebook_attr`, `attrs`, `resource_attr`, and `resources`.
  - Extracts readable ENML bodies without printing private body text.
  - Imports notebook metadata, note metadata, ENML body, and attachment metadata/files where available.
  - Supports `--dry-run` and `--replace-workspace`.
- Backed up the previous Note database before replacement:
  - `data\note-before-exb-import-20260603-124735.sqlite3`
- Replaced `note:yinxiang_import` from EXB:
  - 833 notes imported.
  - 833 readable bodies.
  - 0 encrypted-body rows.
  - 17 notebooks.
  - 1754 attachments.
  - 1729 attachment files found.
  - 25 attachment files missing from the local attachment cache.
- API smoke after import:
  - `GET /api/v1/app/workspace` returned 833 notes, 17 notebooks, 1754 attachments.
  - First 30 snippets had no `RU5D` or `base64:aes` markers.
  - Detail API returned non-encrypted body content.
- Note services were restarted on `0.0.0.0:4173` and `0.0.0.0:4181`.

## Latest UI Repair - Dense List And Swipe Delete - 2026-06-03

- Updated embedded Note list to behave more like Yinxiang mobile:
  - The home surface scrolls as a whole in `embed=hermes`; top search/cards can scroll away instead of permanently consuming list height.
  - Note rows are compact, around 79-83 px in the Playwright mobile viewport.
  - The visual harness measured 9 visible rows after scrolling.
- Adjusted left-swipe delete:
  - Reveal width is now 104 px.
  - Delete action is a full-height red trailing action panel.
  - The red delete area remains unreachable before swipe and becomes reachable only after short swipe.
- `npm run visual:swipe-delete` now defaults to `?embed=hermes` and verifies both swipe visibility and list density.

## Latest UI Repair - Embedded Back And List Performance - 2026-06-03

- Fixed Hermes embedded back handling:
  - Note now emits bounded `note.plugin.navigation` messages with `canGoBack` and a small `route.surface`.
  - Note now listens for `hermes.plugin.back` and handles internal UI first: image preview, create sheet, then editor/detail panel.
  - After handling host back, Note emits `note.plugin.back_result` and updated navigation state.
  - Legacy `plugin:navigationChanged` is still emitted for compatibility.
- Reduced mobile list/open slowness:
  - Initial note list render is windowed to 120 rows instead of rendering all 833 imported notes.
  - Scrolling near the bottom appends the next 80 rows.
  - Opening a note updates the active row and editor only; it no longer calls full `render()` before loading detail.
  - Imported workspace no longer auto-loads the first note body on initial list entry.
- Added harnesses:
  - `scripts/embedded-back-harness.js` / `npm run visual:embedded-back`
  - `scripts/perf-note-ui-harness.js` / `npm run perf:ui`
- Latest Playwright evidence at mobile viewport 390x740:
  - Back harness: `handled=true`, `surfaceAfterBack=home`, `canGoBackAfterBack=false`.
  - Performance harness: `firstRowsMs=120`, `openMs=75`, `initialRows=120`, `rowsAfterScroll=200`.
- Static asset version is now `20260603-back-perf`.

## Read First Next Time

1. `.agent-context/PROJECT_CONTEXT.md`
2. `.agent-context/HANDOFF.md`
3. `docs/DOCS_INDEX.md`
4. `docs/ARCHITECTURE.md`
5. `docs/NOTE_AS_AI_MEMORY_REQUIREMENTS.md`
6. `docs/CROSS_PLUGIN_REFERENCES_DESIGN.md`
7. `docs/HERMES_PLUGIN_MANIFEST.md`
8. `docs/HERMES_PLUGIN_PROVISIONING.md`
9. `docs/HERMES_PLUGIN_LAUNCH.md`
10. `docs/HERMES_PLUGIN_MCP.md`
11. `docs/HERMES_PLUGIN_HARNESS.md`
12. `docs/TEST_MATRIX.md`
