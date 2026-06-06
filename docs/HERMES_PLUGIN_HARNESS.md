# Hermes Plugin Harness

## Required Gates

```powershell
npm test
npm run check
npm run check:architecture
npm run visual:swipe-delete
npm run visual:embedded-back
npm run visual:no-horizontal-drag
npm run visual:attachment-preview
npm run perf:ui
node scripts/privacy-scan.js
python -m py_compile scripts/note_mcp_stdio.py
git diff --check
```

## Coverage

| Requirement | Harness |
| --- | --- |
| Manifest readable before workspace activation | `tests/hermes-plugin-service.test.js` |
| Manifest omits secrets and local paths | `tests/hermes-plugin-service.test.js` |
| Registration missing key, wrong key, create, update | `tests/hermes-plugin-service.test.js` |
| Registration stores hash only | `tests/hermes-plugin-service.test.js`, `tests/sqlite-note-store.test.js` |
| Workspace id conflicts return `invalid_workspace` | `tests/hermes-plugin-service.test.js` |
| Launch unregistered, wrong key, success | `tests/hermes-plugin-service.test.js` |
| Launch entry omits raw key, workspace id, DB path | `tests/hermes-plugin-service.test.js` |
| SQLite reads and writes filter by `workspace_id` | `tests/sqlite-note-store.test.js`, `scripts/check-architecture.js` |
| Owner and non-Owner notes are isolated | `tests/sqlite-note-store.test.js` |
| MCP config/key fail closed | `tests/mcp-wrapper.test.js` |
| MCP `--no-workspace-override` rejects override args | `tests/mcp-wrapper.test.js` |
| MCP tools/list returns local names | `tests/mcp-wrapper.test.js` |
| MCP tools/list exposes Note link and Reference contract tools as local names | `tests/mcp-wrapper.test.js` |
| Reference Graph SQLite tables, indexes, workspace isolation, and idempotency | `tests/reference-graph-store.test.js` |
| Note link service creates Note-to-plugin links, lists backlinks, rejects invalid relations, and keeps outputs bounded | `tests/note-reference-service.test.js` |
| Reference API routes are scoped to the bound workspace and expose Note `reference_*` contract without note body | `tests/reference-api-routes.test.js` |
| Service-first route files stay below line budgets and main Hermes route delegates app/notes/reference behavior | `scripts/check-architecture.js` |
| Embedded postMessage contract is bounded | `tests/embedded-contract.test.js` |
| Embedded `embed=hermes` layout uses iframe-relative height and owns only Note bottom nav spacing | `tests/embedded-layout.test.js`, Playwright geometry smoke |
| Swipe delete is visually hidden before swipe, reachable only after short swipe, and the embedded list shows dense rows after scrolling | `scripts/visual-swipe-delete-harness.js` |
| Hermes host back is handled inside Note before the host exits the plugin | `scripts/embedded-back-harness.js` |
| Embedded mobile page does not allow page-level horizontal dragging in home or editor states | `scripts/no-horizontal-drag-harness.js` |
| Attachment thumbnails use typed icons, image chips open image preview, and MD/Word/PDF file chips open copied Hermes in-app viewer shells | `tests/attachment-file-preview-routes.test.js`, `scripts/visual-attachment-preview-harness.js` |
| Mobile list performance stays bounded by windowed initial rows and avoids full-list rerender on note open | `scripts/perf-note-ui-harness.js` |
| Privacy scan excludes raw secrets and tokens | `scripts/privacy-scan.js` |

## Manual Integration Smoke

After Hermes Mobile writes `.hermes-note` files for a test workspace:

1. Start Note with `NOTE_REGISTRATION_KEY` and `NOTE_DB_PATH`.
2. Call provisioning from Hermes Mobile server side.
3. Call launch from Hermes Mobile server side.
4. Embed returned `entry_path` through the same-origin iframe proxy.
5. Register MCP server `note` with `scripts/note_mcp_stdio.py`.
6. Confirm Hermes Agent sees `mcp_note_notes_search` and not `mcp_note_mcp_note_notes_search`.
7. If Reference Graph tools changed, confirm Hermes Agent sees single-prefix names
   such as `mcp_note_notes_link_create` and `mcp_note_reference_get`.

Do not paste raw keys or launch tokens into logs, screenshots, docs, or handoff.
