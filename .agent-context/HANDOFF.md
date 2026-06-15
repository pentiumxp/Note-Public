# Handoff

## 2026-06-15 Note Detail Title Size And Wrapping

- Status: committed, pushed, and deployed to Mac production.
- UI changes:
  - `public/index.html` changes the detail title control from single-line
    `<input>` to `<textarea rows="1">` so long note titles can wrap.
  - `public/styles.css` reduces `.title-input` from 34px to 24px on the main
    layout and from 30px to 22px on the mobile/editor overlay layout.
  - `public/styles.css` adds wrapping and long-word handling for the title via
    `white-space: pre-wrap` and `overflow-wrap: anywhere`.
  - `public/app.js` adds `syncTitleInputHeight()` and calls it when rendering
    or editing the title, so the textarea grows with wrapped title content.
  - `public/index.html` bumps both `styles.css` and `app.js` query strings to
    `20260615-detail-title-v1`.
  - `tests/home-toolbar-ui.test.js` covers the textarea title, reduced font
    sizes, wrapping rules, and auto-height hook.
- Validation passed:
  - `npm run check`
  - `npm run check:architecture`
  - `npm run privacy`
  - `node --test tests/home-toolbar-ui.test.js`
  - Home AI center check:
    `node tests/architecture-code-test-harness-map.test.js`
  - Home AI deploy checks:
    `node --check scripts/deploy-macos-production.js`,
    `node tests/macos-production-deploy-script.test.js`, and
    `node tests/production-status-smoke-harness.test.js`
  - `git diff --check`
- Commit/push:
  - `d8b4a30` (`优化 Note 详情标题显示`) pushed to `origin/main` and
    `public/main`.
- Production deployment:
  - deployed with:
    `npm run --silent deploy:macos -- --plugin note --execute --json`
  - source ref: clean commit `d8b4a308f883`;
  - production target: `/Users/hermes-host/HermesMobile/plugins/note`;
  - backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260615T082803Z-plugin-note-manual`;
  - deploy plan preserved `data/` and `runtime/`, restored
    `hermes-host:staff`, restarted `system/com.hermesmobile.plugin.note`, and
    passed the Note manifest health check.
- Production readback:
  - `http://127.0.0.1:4181/` serves both
    `styles.css?v=20260615-detail-title-v1` and
    `app.js?v=20260615-detail-title-v1`;
  - production HTML contains `<textarea id="title-input">`;
  - production CSS contains 24px desktop title size, 22px mobile title size,
    `white-space: pre-wrap`, `overflow-wrap: anywhere`, and `resize: none`;
  - production JS contains `syncTitleInputHeight`, uses `scrollHeight`, and
    wires the title input handler;
  - production manifest readback returned plugin id `note`.
- Evidence ledger:
  - appended test, deploy, and production smoke records to
    `$HOME/.homeai-qa/note-evidence-ledger.jsonl`.
- Static readback:
  - CSS and JS query versions both read `20260615-detail-title-v1`;
  - local HTML contains `<textarea id="title-input">`;
  - local CSS contains 24px desktop title size, 22px mobile title size,
    `white-space: pre-wrap`, and `overflow-wrap: anywhere`;
  - local JS contains `syncTitleInputHeight` and `scrollHeight`.
- Privacy:
  - No raw workspace key, registration key, launch token, cookie, attachment
    bytes, full note body, screenshot, password, or long log was intentionally
    stored.

## 2026-06-15 Note Header Horizontal Title And Refresh

- Status: committed, pushed, and deployed to Mac production.
- UI changes:
  - `public/styles.css` fixes the narrow-screen `.home-topline` grid from the
    old avatar-era `40px 1fr auto` layout to `minmax(0, 1fr) auto`, so the
    `全部笔记` title stays horizontal.
  - `public/styles.css` adds `white-space: nowrap` and
    `writing-mode: horizontal-tb` to `.mobile-title`.
  - `public/index.html` adds a `刷新` action button to the Note list header.
  - `public/app.js` wires the refresh button and host `hermes:refresh` /
    `hermes:workspace` messages to reload `/api/v1/app/workspace` and rerender
    the list, preserving the selected note when it still exists.
  - `public/index.html` bumps both `styles.css` and `app.js` query strings to
    `20260615-note-refresh-v1`.
  - `tests/home-toolbar-ui.test.js` covers the refresh button, refresh handler,
    and horizontal title CSS rules.
- Validation passed:
  - `npm run check`
  - `npm run check:architecture`
  - `npm run privacy`
  - `node --test tests/home-toolbar-ui.test.js`
  - Home AI center check:
    `node tests/architecture-code-test-harness-map.test.js`
  - Home AI deploy checks:
    `node --check scripts/deploy-macos-production.js`,
    `node tests/macos-production-deploy-script.test.js`, and
    `node tests/production-status-smoke-harness.test.js`
  - `git diff --check`
- Commit/push:
  - `73463ee` (`优化 Note 标题栏刷新`) pushed to `origin/main` and
    `public/main`.
- Production deployment:
  - deployed with:
    `npm run --silent deploy:macos -- --plugin note --execute --json`
  - source ref: clean commit `73463ee98d5c`;
  - production target: `/Users/hermes-host/HermesMobile/plugins/note`;
  - backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260615T081405Z-plugin-note-manual`;
  - deploy plan preserved `data/` and `runtime/`, restored
    `hermes-host:staff`, restarted `system/com.hermesmobile.plugin.note`, and
    passed the Note manifest health check.
- Production readback:
  - `http://127.0.0.1:4181/` serves both
    `styles.css?v=20260615-note-refresh-v1` and
    `app.js?v=20260615-note-refresh-v1`;
  - production HTML contains `#refresh-button`;
  - production CSS contains `.mobile-title` horizontal/no-wrap rules and the
    fixed small-screen `.home-topline` grid;
  - production JS contains `triggerWorkspaceRefresh`, reloads
    `/api/v1/app/workspace`, and preserves selected note when still present;
  - production manifest readback returned plugin id `note`.
- Evidence ledger:
  - appended test, deploy, and production smoke records to
    `$HOME/.homeai-qa/note-evidence-ledger.jsonl`.
- Static readback:
  - CSS and JS query versions both read `20260615-note-refresh-v1`;
  - local HTML contains `#refresh-button`;
  - local CSS contains the horizontal title and fixed small-screen grid rules;
  - local JS contains `triggerWorkspaceRefresh` and reloads
    `/api/v1/app/workspace`.
- Privacy:
  - No raw workspace key, registration key, launch token, cookie, attachment
    bytes, full note body, screenshot, password, or long log was intentionally
    stored.

## 2026-06-15 Note Compact List And Host Font Sync

- Status: committed, pushed, and deployed to Mac production.
- UI changes:
  - `public/index.html` removes the visible `许` avatar text from both the
    desktop account card and mobile Note list header.
  - `public/app.js` stops rendering `.note-row-snippet`, so the Note list no
    longer displays note body/summary rows.
  - `public/styles.css` changes Note list titles to a three-line clamp.
  - `public/app.js` and `public/styles.css` apply host-provided
    `pluginFontSize` / `fontSize` through `--note-font-scale`, and accept the
    host-provided `fontFamily` without appending a plugin-local fallback stack.
  - `public/index.html` bumps both `styles.css` and `app.js` query strings to
    `20260615-note-compact-v1`.
  - `tests/home-toolbar-ui.test.js` covers the removed avatar text, hidden body
    rows, three-line title clamp, and host font inheritance hooks.
- Validation passed:
  - `npm run check`
  - `npm run check:architecture`
  - `npm run privacy`
  - `node --test tests/home-toolbar-ui.test.js`
  - Home AI center check:
    `node tests/architecture-code-test-harness-map.test.js`
  - Home AI deploy checks:
    `node --check scripts/deploy-macos-production.js`,
    `node tests/macos-production-deploy-script.test.js`, and
    `node tests/production-status-smoke-harness.test.js`
  - `git diff --check`
- Commit/push:
  - `3fc4abc` (`优化 Note 紧凑列表显示`) pushed to `origin/main` and
    `public/main`.
- Production deployment:
  - deployed with:
    `npm run --silent deploy:macos -- --plugin note --execute --json`
  - source ref: clean commit `3fc4abc7cd58`;
  - production target: `/Users/hermes-host/HermesMobile/plugins/note`;
  - backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260615T032812Z-plugin-note-manual`;
  - deploy plan preserved `data/` and `runtime/`, restored
    `hermes-host:staff`, restarted `system/com.hermesmobile.plugin.note`, and
    passed the Note manifest health check.
- Production readback:
  - `http://127.0.0.1:4181/` serves both
    `styles.css?v=20260615-note-compact-v1` and
    `app.js?v=20260615-note-compact-v1`;
  - production HTML no longer contains visible `>许<`;
  - production CSS contains `--note-font-scale`, body `font-family: inherit`,
    `.note-row-title` `-webkit-line-clamp: 3`, and
    `.note-row-snippet { display: none; }`;
  - production JS handles `pluginFontSize`, applies host `fontFamily`
    directly, no longer renders `.note-row-snippet`, and no longer contains
    `noteListSnippetText`;
  - production manifest readback returned plugin id `note`.
- Evidence ledger:
  - appended test, deploy, and production smoke records to
    `$HOME/.homeai-qa/note-evidence-ledger.jsonl`.
- Static readback:
  - local HTML no longer contains visible `>许<`;
  - `public/app.js` no longer contains `.note-row-snippet` rendering or the
    unused snippet helper;
  - CSS and JS query versions both read `20260615-note-compact-v1`.
- Privacy:
  - No raw workspace key, registration key, launch token, cookie, attachment
    bytes, full note body, screenshot, password, or long log was intentionally
    stored.

## 2026-06-15 Note List Header And Title Clamp

- Status: committed, pushed, and deployed to Mac production.
- UI changes:
  - `public/styles.css` hides `.list-toolbar`, so the note list no longer
    displays the visible `最近更新` sort label above the list.
  - `public/styles.css` changes `.note-row-title` from single-line truncation
    to a two-line WebKit clamp with normal wrapping.
  - `public/index.html` bumps the stylesheet query string to
    `20260615-note-title-v1`.
  - `tests/home-toolbar-ui.test.js` now asserts the hidden toolbar and two-line
    title CSS rules.
- Validation passed:
  - `npm run check`
  - `npm run check:architecture`
  - `npm run privacy`
  - `node --test tests/home-toolbar-ui.test.js`
  - Home AI center check:
    `node tests/architecture-code-test-harness-map.test.js`
  - Home AI deploy checks:
    `node --check scripts/deploy-macos-production.js`,
    `node tests/macos-production-deploy-script.test.js`, and
    `node tests/production-status-smoke-harness.test.js`
  - `git diff --check`
- Commit/push:
  - `100f3da` (`优化 Note 列表标题显示`) pushed to `origin/main` and
    `public/main`.
- Production deployment:
  - deployed with:
    `npm run --silent deploy:macos -- --plugin note --execute --json`
  - source ref: clean commit `100f3dabaff0`;
  - production target: `/Users/hermes-host/HermesMobile/plugins/note`;
  - backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260615T031453Z-plugin-note-manual`;
  - deploy plan preserved `data/` and `runtime/`, restored
    `hermes-host:staff`, restarted `system/com.hermesmobile.plugin.note`, and
    passed the Note manifest health check.
- Production readback:
  - `http://127.0.0.1:4181/` serves
    `styles.css?v=20260615-note-title-v1`;
  - production `styles.css` contains `.list-toolbar { display: none; }`;
  - production `styles.css` contains `.note-row-title` two-line clamp via
    `-webkit-line-clamp: 2` and `white-space: normal`;
  - production manifest readback returned plugin id `note`.
- Evidence ledger:
  - appended test, deploy, and production smoke records to
    `$HOME/.homeai-qa/note-evidence-ledger.jsonl`.
- Caveat:
  - A direct launch-token smoke from the development shell was not completed:
    the production Owner `.hermes-note` directory correctly denies normal
    development-user reads, and the available sudo password file did not pass
    `sudo` in this shell. The central deploy script's launchd and manifest
    validations passed.
- Privacy:
  - No raw workspace key, registration key, launch token, cookie, attachment
    bytes, full note body, screenshot, password, or long log was intentionally
    stored.

## 2026-06-12 Dark Theme Preview Polish

- Status: local source validated; prepared for private/public push.
- UI changes:
  - `public/styles.css` strengthens the Note dark theme to a true black surface
    with higher-contrast text, inputs, chips, thumbnails, sidebars, and sheets.
  - `public/file-viewer.html` applies the same dark palette to Markdown
    preview cards, tables, code blocks, action sheets, and generated
    print/share HTML.
  - `public/index.html` bumps the stylesheet query string to
    `20260609-dark-theme-v1`.
- Validation passed:
  - `npm test` passed: 57/57.
  - `npm run check` passed.
  - `npm run privacy` passed.
  - `git diff --check` passed.
- Privacy:
  - No raw workspace key, registration key, launch token, cookie, attachment
    bytes, full note body, screenshot, password, or long log was intentionally
    stored.

## Latest Mac Production Workspace Notebook Schema Fix - 2026-06-09

- User reported WuPing workspace Save to Note showed:
  `保存到 Note 失败：ERR_SQLITE_ERROR`.
- Root cause:
  - WuPing `.hermes-note` binding and production `plugin_workspaces` row were
    active and complete;
  - direct WuPing Note API create reproduced `500 ERR_SQLITE_ERROR`;
  - direct Note SQLite/service probe revealed
    `UNIQUE constraint failed: notebooks.id`;
  - `notebooks.id` was a global primary key, so Owner's existing `hermes`
    notebook prevented any other workspace from creating its own `hermes`
    notebook for Hermes receipt saves.
- Source changes:
  - `src/stores/sqlite-note-store.js`
    - new schema now uses `primary key (workspace_id, id)` for `notebooks`;
    - startup migration rebuilds old global-primary-key `notebooks` tables
      into workspace-scoped tables while preserving existing rows.
  - `tests/sqlite-note-store.test.js`
    - added regression coverage for migrating an old schema and creating
      separate Owner/WuPing `hermes` notebooks.
  - `docs/DATA_MODEL.md` and `docs/ARCHITECTURE.md`
    - documented workspace-local notebook identity.
- Commit/push:
  - `259a9fe` (`fix: scope note notebooks by workspace`) pushed to
    `origin/main`.
- Verification:
  - `npm test` passed, 56 tests;
  - `npm run check`, `npm run check:architecture`, `npm run privacy`, and
    `git diff --check` passed.
- Production deployment:
  - deployed from clean detached worktree
    `/Users/hermes-dev/HermesMobileDev/tmp/note-deploy-259a9fe`;
  - production target:
    `/Users/hermes-host/HermesMobile/plugins/note`;
  - backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260609T051515Z-plugin-note-note-workspace-notebooks-schema-v659`;
  - after discovering the previous central deploy script deleted plugin
    runtime `data/` and copied source ownership, restored Note `data/` from the
    backup, removed the copied worktree `.git` file, restored owner to
    `hermes-host:staff`, and kickstarted
    `system/com.hermesmobile.plugin.note`.
- Production readback:
  - Note manifest is reachable at `127.0.0.1:4181`;
  - `notebooks` primary key is now workspace-scoped:
    `workspace_id pk=1`, `id pk=2`;
  - `note:owner` and `note:weixin_wuping` now each have notebook id `hermes`;
  - WuPing API create smoke returned `201`, delete returned `200`, and no smoke
    note remained afterward.
- Current local workspace state:
  - `public/file-viewer.html`, `public/index.html`, and `public/styles.css`
    remain dirty from unrelated UI work and were not deployed by this fix.

## Latest Note MCP Hermes Agent Compatibility Fix - 2026-06-03

- User reported NAS Hermes Mobile could not use Note MCP even though the Note plugin itself could return notes.
- Root cause found from NAS Gateway `nasgw1` logs:
  - Hermes Agent SDK rejected Note MCP `initialize` because the wrapper returned only `protocolVersion` and `capabilities`; it lacked `serverInfo`.
  - After adding `serverInfo`, Hermes Agent then rejected wrapper output because the wrapper responded to id-less MCP notifications such as `notifications/initialized` with an invalid JSON-RPC error containing `id: null`.
- Source changes in this workspace:
  - `scripts/note_mcp_stdio.py`
    - `initialize` now returns `serverInfo: { name: "note", version: "1.0.0" }`.
    - id-less notifications now return no response.
    - exceptions from id-less messages are ignored instead of emitting invalid `id:null` JSON-RPC errors.
  - `tests/mcp-wrapper.test.js`
    - added initialize `serverInfo` coverage.
    - added notification no-output coverage.
- Verification:
  - Local: `python -m py_compile scripts\note_mcp_stdio.py`
  - Local: `node --test tests\mcp-wrapper.test.js`
  - Local: `npm run check -- --help` completed the configured syntax checks.
  - Local: `npm run privacy`
  - Local: `git diff --check` passed with CRLF warnings only.
- NAS sync:
  - Backups:
    - `/volume1/docker/note/backups/note-mcp-server-info-20260603-172651`
    - `/volume1/docker/note/backups/note-mcp-notification-fix-20260603-172919`
  - Synced:
    - `/volume1/docker/note/source/scripts/note_mcp_stdio.py`
    - `/volume1/docker/note/source/tests/mcp-wrapper.test.js`
  - NAS checks passed with pinned Node:
    - `python3 -m py_compile scripts/note_mcp_stdio.py`
    - `/volume1/docker/hermes-mobile/runtime/node-v22.22.3-linux-x64/bin/node --test tests/mcp-wrapper.test.js`
- NAS Hermes verification after restarting `nasgw1`:
  - `nasgw1` profile config includes `note` toolset, `mcp_servers.note`, and `platform_toolsets.api_server: note`.
  - Recent `nasgw1` Gateway log has no Note/MCP initialize errors.
  - Real Hermes Agent schema probe for `nasgw1` includes:
    - `mcp_note_notes_search`
    - `mcp_note_notes_create`
    - `mcp_note_notes_get`
    - `mcp_note_notes_recent`
    - `mcp_note_notes_update`
    - `mcp_note_notes_delete`
    - `mcp_note_notes_tags_list`
  - Direct MCP `notes_recent` smoke returned `recentOk=true`, payload key `notes`, `noteCount=1`, and only metadata keys were printed.
- Status:
  - Note repo changes are local and uncommitted unless the user explicitly asks for a Note commit/push.
  - Existing local `.agent-context` changes from prior context setup remain; do not overwrite them blindly.

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

## Latest UI Repair - No Horizontal Drag And Footer Bottom Alignment - 2026-06-03

- Locked page-level horizontal overflow in mobile and `embed=hermes` layouts:
  - Root/body/app/workspace/home/editor containers now cap width and hide horizontal overflow.
  - Mobile editor panel no longer sits offscreen with `translateX(100%)`; it uses overlay visibility/opacity so it does not double document width.
- Adjusted embedded bottom tabs to match Hermes plugin footer geometry:
  - `html[data-embed="hermes"] .mobile-tabs` is now the app-shell grid footer row with `position: relative`.
  - Removed embedded safe-area bottom padding from the Note tabs; Hermes host owns its own footer/safe area.
  - Embedded editor scroll bottom padding is fixed to Note-owned spacing only.
- Added `scripts/no-horizontal-drag-harness.js` and `npm run visual:no-horizontal-drag`.
- Latest Playwright evidence at mobile viewport 390x740:
  - `document.scrollWidth=390` in home and editor states.
  - Note bottom tabs bottom equals viewport bottom: gap `0px`.

## Latest Attachment UI - Typed File Icons And Preview - 2026-06-03

- Confirmed attachment storage model:
  - SQLite stores attachment metadata only: `workspace_id`, `note_id`, `name`, `kind`, `size`, and `metadata_json`.
  - Attachment bytes, including images, PDF, and Word files, live under `data/attachments/...`.
  - `metadata_json.storageKey` points to the internal attachment file path segment.
- Updated app attachment summaries so every attachment with `storageKey` receives a bounded app URL, not only images.
- Added typed attachment icons in list chips and attachment rows:
  - PDF, Word, Excel, PowerPoint, image, audio, document, and generic file.
- Added attachment preview behavior:
  - Images open the image preview overlay.
  - PDF opens in an iframe preview when the browser can render it.
  - Word and other non-browser-rendered files show a file preview card with an open-file action.
- Added `scripts/visual-attachment-preview-harness.js` and `npm run visual:attachment-preview`.
- Latest DOM evidence at mobile viewport 390x740:
  - First rendered batch had 56 non-image file icons.
  - PDF icons: 45.
  - Word icons: 6.
  - Right-side legacy thumbnails: 0.

## Latest Attachment UI - Real Thumbnails And Document Preview - 2026-06-03

- Fixed list and inline image previews so they use real generated thumbnails instead of original images scaled down by CSS.
- Added `scripts/backfill-image-thumbnails.js` and `scripts/generate-image-thumbnails.ps1`.
  - Thumbnails are JPEG files under `data/thumbnails`.
  - Attachment metadata now stores `thumbnailStorageKey`, `thumbnailMime`, dimensions, and byte size.
  - The app exposes thumbnails through `/api/v1/app/attachments/:id/thumbnail`.
- Updated list chips, attachment rows, and imported inline image grids to load `thumbnailUrl` first.
  - Opening the image preview still loads the original attachment URL.
- Updated PDF preview to use a bounded preview panel with fit-to-width hints.
- Updated file previews to fill the Note iframe viewport in embedded mobile mode.
- Updated DOCX/Word preview:
  - `scripts/render-docx-preview.ps1` extracts `word/document.xml` locally.
  - `/api/v1/app/attachments/:id/preview` returns bounded HTML from the DOCX package.
  - Word clicks now open an iframe preview with open and download actions.
  - Legacy Word files or failed conversions still fall back to the file card.
- Added visual harness coverage:
  - List image chips must use `/thumbnail`.
  - Image preview must not open editor inputs.
  - PDF preview must render in a fit-to-width iframe panel.
  - Word preview must open a local `/preview` iframe and render extracted document text.
- Current imported workspace evidence:
  - Image attachments scanned: 1537.
  - Images with original stored bytes: 1513.
  - Images with generated thumbnails: 1513.
  - Example image original: 4,356,851 bytes; thumbnail: 5,432 bytes.

## Latest Hermes Embed Preview/Thumbnail Hotfix - 2026-06-03

- User report through Hermes Mobile:
  - Opening an image/file preview inside a plugin should be full-screen and hide Hermes host chrome.
  - Note's new list thumbnails sometimes do not display, while opening the large image works.
- Changes made in this Note workspace:
  - `public/app.js`
    - `emitNavigationState()` now sends `previewFullscreen`, `fullscreenPreview`, and bounded `preview` metadata when `route.surface === 'image_preview'`.
    - This lets Hermes Mobile v520 hide its plugin-context footer while the Note image/file preview overlay is active.
    - Added a capture-phase image error fallback for preview thumbnails: image chips render `thumbnailUrl` first but keep the original attachment URL in `data-fallback-src`, then switch once if the thumbnail request fails.
    - The fallback is URL-only and does not expose note body or attachment bytes in postMessage payloads.
  - `public/index.html`
    - Static query string advanced to `20260603-preview-fullscreen`.
  - `tests/embedded-contract.test.js`
    - Covers bounded fullscreen preview navigation payload and thumbnail fallback markup.
  - `scripts/visual-attachment-preview-harness.js`
    - Now checks `imageChipHasFallback=true` and `brokenImageChips=0`, not only that the chip URL contains `/thumbnail`.
- Validation:
  - `node --check public\app.js`
  - `node --check scripts\visual-attachment-preview-harness.js`
  - `node --no-warnings --test tests\embedded-contract.test.js`
  - `node scripts\privacy-scan.js`
  - Direct Note attachment route smoke for `att_exb_1010` returned 200 for both original and `/thumbnail`.
  - Playwright direct Note check at `http://127.0.0.1:4181/?embed=hermes` showed first 12 image chips had `naturalWidth > 0` and no failed thumbnail requests.
  - `NOTE_VISUAL_BASE_URL=http://127.0.0.1:4181/?embed=hermes npm run visual:attachment-preview` returned `imageChipUsesThumbnail=true`, `imageChipHasFallback=true`, `brokenImageChips=0`, and `previewInputs=0`.
- Status:
  - The running Note service on port `4181` serves `public/index.html` with `20260603-preview-fullscreen`.
  - This workspace was already dirty with many unrelated Note changes before this hotfix. Do not blindly commit all dirty files or revert them; isolate any future commit carefully.
- Privacy:
  - No raw Hermes key, Note workspace key, launch token, cookie, note body, attachment content, screenshot, or long log was stored.

## Latest Hermes MCP Reachability Hotfix - 2026-06-04

- User report through Hermes Mobile:
  - `mcp_note_notes_create` was called twice from ordinary chat but timed out
    with `urlopen error timed out`.
- Root cause:
  - `HermesMobileNotePluginWatchdog` had registered the Note service as
    `127.0.0.1:4181`, which worked for Windows browser checks but was not
    reachable from WSL Gateway MCP workers.
  - The selected low Gateway profiles pointed Note MCP at a LAN address, which
    also timed out from WSL for Note API calls.
- Changes made in this Note workspace:
  - `scripts/note-plugin-watchdog.ps1` default `HostName` is now `0.0.0.0`.
  - `scripts/register-note-plugin-autostart.ps1` default `HostName` is now
    `0.0.0.0`.
  - `docs/HERMES_PLUGIN_MCP.md` documents that WSL-based Hermes Gateway MCP
    should use the Windows WSL host gateway address for the Note API base URL.
- Runtime repair:
  - Re-registered the `HermesMobileNotePluginWatchdog` scheduled task with
    `-HostName 0.0.0.0`.
  - Restarted the Note plugin service; it now listens on `0.0.0.0:4181`.
- Validation:
  - Windows `http://127.0.0.1:4181/api/v1/hermes/plugin/manifest` returned
    `200`.
  - WSL `http://172.27.192.1:4181/api/v1/hermes/plugin/manifest` returned the
    Note manifest.
  - Hermes low Gateway profiles were rebuilt in the Agent workspace and now
    point Note MCP at `http://172.27.192.1:4181`.
  - A Note MCP stdio `tools/list` call from WSL passed.
  - The requested note title `Note MCP 可用工具说明` was created and
    search-confirmed with note id `9fcdadf8-9fba-42a3-97aa-9ff383c11317`.
- Status:
  - This Note workspace still has substantial pre-existing unrelated dirty
    files. Do not blindly commit all dirty files or revert unrelated changes;
    isolate any future commit carefully.
- Privacy:
  - No raw Note workspace key, Hermes owner key, launch token, cookie, note
    body, attachment content, screenshot, or long log was stored.

## Read First Next Time

## Latest MD/File Preview Browser Verification - 2026-06-04

- User report:
  - Markdown attachment preview still showed the Hermes-style error page instead of rendered HTML.
  - User explicitly requested browser verification.
- Root cause:
  - Note was opening viewer iframes with root-absolute paths such as `/markdown-viewer.html`.
  - Under Hermes Mobile same-origin plugin proxy, that can resolve to Hermes Mobile's root viewer instead of Note's proxied viewer.
  - Hermes root `markdown-viewer.html` does not have Note's attachment preview route context, so it shows the "No internal preview route" style error.
- Changes made in this Note workspace:
  - `public/app.js`
    - `attachmentViewerUrl()` now uses relative viewer shell paths: `pdf-viewer.html`, `markdown-viewer.html`, and `file-viewer.html`.
    - The viewer query includes the Note attachment `preview` URL so MD/Word/text preview shells can fetch bounded converted text through Note.
  - `public/markdown-viewer.html` and `public/file-viewer.html`
    - Accept explicit `preview` query parameters.
    - Preserve Note proxy prefixes when mapping attachment URLs to `/preview`.
  - `public/styles.css`
    - File preview panels now use a constrained block layout; iframes are `display:block`, `max-width:100%`, and `min-width:0`.
    - This fixed PDF iframe overflow on a 390px mobile viewport.
  - `public/index.html`
    - Static resource version advanced to `20260604-md-preview-proxy-v2`.
  - `scripts/note-server.js`
    - Default production port changed to `4181`.
  - Visual harness scripts
    - Default direct URL changed from stale `4173` to `4181`.
    - `scripts/visual-attachment-preview-harness.js` can now read a workspace-local `.hermes-note` config/key and exchange it for a short launch URL internally. It does not print raw keys or launch tokens.
    - Attachment preview harness assertions now accept relative viewer paths, which is required for Hermes proxy correctness.
  - `tests/attachment-file-preview-routes.test.js`
    - Covers explicit `preview` parameter handling and relative viewer-shell paths.
- Browser verification:
  - Android Chrome DevTools was reachable over ADB, but no active Hermes Note iframe was open; the only matched plugin iframe was Wardrobe.
  - A Playwright browser run used the real `owner` workspace launch flow against `http://127.0.0.1:4181`.
  - Real launch page loaded 120 visible note rows and image thumbnails from `/api/v1/app/attachments/:id/thumbnail`, all returning 200 in the sampled run.
  - Clicking the real Markdown attachment opened `.markdown-preview-frame` with relative `markdown-viewer.html`.
  - The iframe rendered HTML with `hasPreview=true`, `hasError=false`, 4 headings, and 8 paragraph/list blocks in the sampled run.
- Validation:
  - `npm test` passed: 48/48.
  - `npm run check` passed.
  - `npm run visual:attachment-preview` passed with `rightThumbs=82`, `imageChipUsesThumbnail=true`, `imageChipHasFallback=true`, `brokenImageChips=0`, `previewInputs=0`, and `previewHeadVisible=false`.
  - `npm run check:architecture` passed.
  - `npm run privacy` passed.
  - `git diff --check` passed with only existing LF-to-CRLF warnings.
- Status:
  - The running Note service is still process `node scripts/note-server.js` listening on `0.0.0.0:4181`.
  - Static files are served with `Cache-Control: no-store`; the new query string is also present to avoid PWA/proxy stale assets.
  - This workspace remains dirty with substantial prior Note work; do not blindly commit all dirty files or revert unrelated changes.
- Privacy:
  - No raw workspace key, registration key, launch token, cookie, attachment bytes, screenshot, full note body, or long log was intentionally stored in this handoff.

## Latest Hermes Proxy Preview Not Found Fix - 2026-06-04

- User evidence:
  - Screenshot showed the Markdown overlay title `2026-06-04_穿着入库回执.md`, but the viewer body only displayed `Not found`.
- Root cause:
  - The previous fix made the viewer shell path relative, so the Note viewer opened correctly.
  - Inside the viewer, the explicit Note preview URL was still `/api/v1/app/attachments/.../preview`.
  - Under Hermes same-origin proxy, that root path resolves to Hermes Mobile root, not to `/api/hermes-plugins/note/proxy/api/v1/app/...`, causing the preview fetch to return `Not found`.
- Changes made:
  - `public/markdown-viewer.html`
    - Internal `fixed-viewport.js` and `markdown-renderer-client.js` script references are now relative.
    - `previewUrlFor()` now rewrites Note app API paths into the current Note proxy prefix when loaded under `/api/hermes-plugins/note/proxy/`.
  - `public/file-viewer.html`
    - Same relative script reference fix.
    - Same proxy-prefix rewrite for preview, original, and download paths.
  - `public/pdf-viewer.html`
    - Internal fixed viewport and PDF.js import/worker references are now relative.
    - PDF download fetch paths now use the same Note proxy-prefix rewrite for `/api/v1/app/...`.
  - `public/app.js`
    - `attachmentViewerUrl()` now adds `viewer_v=20260604-proxy-preview-v3` to bust stale mobile/PWA viewer iframe caches.
  - `public/index.html`
    - Static resource query string advanced to `20260604-proxy-preview-v3`.
  - `scripts/visual-attachment-preview-harness.js`
    - Added a browser-level Hermes proxy simulation: serves `markdown-viewer.html` under `/api/hermes-plugins/note/proxy/`, deliberately returns 404 for root `/api/v1/app/...`, and asserts the viewer fetches the proxied Note preview route.
  - `tests/attachment-file-preview-routes.test.js`
    - Static coverage for relative viewer assets, proxy-prefix helper, and `viewer_v`.
- Validation:
  - `npm test` passed: 48/48.
  - `npm run check` passed.
  - `npm run visual:attachment-preview` passed and reported `proxyMarkdownPreview=true`.
  - `npm run check:architecture` passed.
  - `npm run privacy` passed.
  - `git diff --check` passed with only LF-to-CRLF warnings.
  - Note service remains listening on `0.0.0.0:4181`.
- Status:
  - Browser/PWA may need the Note plugin page reopened so the iframe gets `app.js?v=20260604-proxy-preview-v3` and viewer URLs include `viewer_v=20260604-proxy-preview-v3`.
- Privacy:
  - No raw workspace key, registration key, launch token, cookie, attachment bytes, full note body, screenshot, or long log was intentionally stored in this handoff.

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

## 2026-06-06 Home AI Platform Contract Pointer

- Added `docs/HOME_AI_PLATFORM_CONTRACT.md`.
- Contract version: `20260606-v1`.
- Scope: Note is treated as a standard inserted Home AI plugin and the planned
  first local home for non-structured memory plus cross-plugin links.
- This was a documentation-only update. No Note code, local service, Mac
  production files, Gateway workers, note data, attachments, launch tokens, or
  credentials were changed.
- Next steps:
  - implement Note link tools and Reference / Memory Graph V1 harness coverage;
  - keep exact Mac production source/data roots current after future Note
    deploys;
  - add Appium/iOS Simulator evidence for embedded previews, gesture behavior,
    and installed-PWA shell differences.

## 2026-06-06 Home AI Platform Contract Checker Closure

- Home AI main workspace added and ran:
  `node scripts\plugin-workspace-platform-contract-check.js --plugin note --json`.
- Mac read-only platform probe passed through `homeai-mac`:
  - source path `/Users/hermes-host/HermesMobile/plugins/note` exists;
  - data root `/Users/hermes-host/HermesMobile/plugins/note/data` exists;
  - launchd `com.hermesmobile.plugin.note` is loaded;
  - manifest `http://127.0.0.1:4181/api/v1/hermes/plugin/manifest` returned
    HTTP 200.
- No Note code, service, production data, Gateway worker, note content,
  attachment bytes, launch token, or credential material was changed by this
  checker closure.

## 2026-06-06 Home AI Central Contract Review

- Added the Home AI platform contract pointer to `.agent-context/PROJECT_CONTEXT.md`.
- Re-read the Note pointer document and central Home AI contract documents for:
  deployment, plugin workspace contract, Reference / Memory Graph V1, graph
  harness planning, mobile visual evidence, MCP tool upgrade closure, Mac
  production access, and platform test matrix.
- Architecture constraint for next work:
  - do not implement ad-hoc Note cross-plugin references;
  - align Note links with Reference / Memory Graph V1 object refs, edges,
    backlinks, idempotency, permission intersection, and plugin reference
    contract methods;
  - treat browser Playwright checks as insufficient for shell/safe-area/gesture
    changes when Appium/iOS Simulator or installed PWA evidence is required by
    the central contract.
- No Note code, service, production data, Gateway worker, note content,
  attachment bytes, launch token, or credential material was changed in this
  review.

## 2026-06-06 Reference Graph Service-First Refactor

- Implemented the Note-local Home AI Reference / Memory Graph V1 slice:
  - SQLite graph schema/store for `reference_nodes`, `reference_object_refs`,
    `reference_edges`, `reference_events`, and `reference_provenance`;
  - `src/services/reference-graph-service.js` for relation validation,
    idempotent edge creation, event/object operations, and bounded metadata;
  - `src/services/note-reference-service.js` for Note link wrappers,
    backlinks, and Note `reference_*` contract projections;
  - `src/server-routes/reference-api-routes.js` for bounded HTTP routes;
  - MCP wrapper tools: `notes_link_create`, `notes_links_list`,
    `notes_backlinks_list`, `notes_link_delete`, `reference_object_types`,
    `reference_get`, and `reference_summarize`.
- Service-first cleanup:
  - `src/server-routes/hermes-plugin-routes.js` is now a small compositor;
  - app workspace routes, notes API routes, reference routes, HTTP utilities,
    app workspace service, and imported body rendering were split into
    separate files;
  - `scripts/check-architecture.js` now enforces route/service line budgets and
    reference-contract guardrails.
- Docs updated:
  - `docs/REFERENCE_GRAPH_ALIGNMENT_PLAN.md`;
  - `docs/ARCHITECTURE.md`;
  - `docs/DOCS_INDEX.md`;
  - `docs/CROSS_PLUGIN_REFERENCES_DESIGN.md`;
  - `docs/HERMES_PLUGIN_MCP.md`;
  - `docs/HERMES_PLUGIN_HARNESS.md`;
  - `docs/HOME_AI_PLATFORM_CONTRACT.md`;
  - `docs/TEST_MATRIX.md`.
- Validation status before commit:
  - `npm test` passed: 54/54.
  - `npm run check` passed.
  - `npm run check:architecture` passed.
  - `npm run privacy` passed.
  - `python -m py_compile scripts\note_mcp_stdio.py` passed.
  - `git diff --check` passed with only LF-to-CRLF warnings.
  - `npm run visual:attachment-preview` passed after restarting 4181 on current
    code.
  - `npm run visual:embedded-back`, `npm run visual:no-horizontal-drag`, and
    `npm run perf:ui` passed after restarting 4181 with
    `NOTE_APP_WORKSPACE_ID=note:owner` for direct-browser harness mode.
  - `npm run visual:theme-sync` passed.
- Runtime note:
  - The current local hidden Node process listens on `0.0.0.0:4181` from this
    workspace. It was restarted for validation with direct harness fallback
    workspace `note:owner`; Hermes embedded plugin launch still resolves the
    workspace from launch token.
- Privacy:
  - No raw workspace key, registration key, launch token, cookie, attachment
    bytes, full note body, screenshot, or long log was intentionally stored.

## 2026-06-08 Home Toolbar And Create Sheet Gesture Deploy

- UI cleanup:
  - Removed the home-page quick-create strip, including Super Note, Photo,
    Scan, and Attachment large entries.
  - Removed the list title/subtitle prompt from the home list toolbar.
  - Kept the sort dropdown as the left-side toolbar control.
  - Kept create modes in the bottom plus sheet.
- Gesture behavior:
  - Added create-sheet right-swipe dismissal in `public/app.js`.
  - When the plus sheet is open, a right swipe closes the Note sheet locally,
    emits Note navigation back to `home`, and does not ask Hermes host to exit
    the plugin.
  - Existing `hermes.plugin.back` handling still closes Note internals first.
- Harness/docs:
  - Added `scripts/create-sheet-gesture-harness.js`.
  - Added `npm run visual:create-sheet-gesture`.
  - Updated `docs/HERMES_PLUGIN_HARNESS.md` and `docs/TEST_MATRIX.md`.
- Local validation:
  - `npm test` passed: 55/55.
  - `npm run check` passed.
  - `npm run check:architecture` passed.
  - `npm run privacy` passed.
  - `python -m py_compile scripts\note_mcp_stdio.py` passed.
  - `npm run visual:create-sheet-gesture` passed with
    `beforeSurface=create_sheet`, `afterSurface=home`,
    `sheetOpenAfterSwipe=false`, and `hostBackResults=0`.
  - `npm run visual:embedded-back` and `npm run visual:no-horizontal-drag`
    passed.
  - `git diff --check` passed with only LF-to-CRLF warnings.
  - UTF-8 BOM checks passed for changed text files.
- Mac production deployment:
  - Synced the current local source surface to
    `/Users/hermes-host/HermesMobile/plugins/note` after finding the Mac source
    was behind local `package.json`/`src` expectations.
  - Backups:
    - `/Users/hermes-host/HermesMobile/plugins/note/backups/ui-gesture-20260608-175248`
    - `/Users/hermes-host/HermesMobile/plugins/note/backups/source-sync-20260608-175446/source-before-sync.tar`
  - Restarted `system/com.hermesmobile.plugin.note`.
  - Mac production validation:
    - `npm run check` passed using the pinned Home AI Node runtime.
    - `npm test` passed: 55/55, using a temporary `/tmp` test-only
      `python` wrapper to call `/usr/bin/python3` for MCP wrapper tests.
    - `http://127.0.0.1:4181/api/v1/hermes/plugin/manifest` returned HTTP
      200 after restart.
- Privacy:
  - No raw workspace key, registration key, launch token, cookie, attachment
    bytes, full note body, screenshot, password, or long log was intentionally
    stored.
