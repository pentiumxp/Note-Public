# Note

Note is a local-first notes workspace scaffold and Hermes Mobile plugin candidate for building an Evernote/Yinxiang-style workspace without copying proprietary branding, assets, or private user data. The project keeps a docs-first boundary: requirements, architecture, implementation phases, test matrix, security rules, plugin contracts, and handoff context are defined before feature work.

## Current Scope

The current MVP is a mobile-first local web prototype plus Hermes plugin contract implementation. It includes notebooks, tags, shortcuts, search, rich-text editing, task capture, attachment metadata, SQLite workspace isolation, plugin manifest/provisioning/launch endpoints, and a workspace-bound MCP wrapper. Cloud sync, OCR, web clipper, and production deployment remain behind documented H1 harness requirements.

## Project Layout

```text
.agent-context/          Durable context for future Codex threads
docs/                    Requirements, architecture, implementation, test matrix
src/services/            Business rules and note lifecycle
src/stores/              Persistence boundary
src/server-routes/       HTTP route glue for plugin/API endpoints
src/providers/           File/external-system boundary
src/view-models/         UI projection helpers
public/                  Local web prototype
tests/                   Service and harness tests
scripts/                 Local validation utilities
```

## Local Commands

```powershell
npm test
npm run check
npm run check:architecture
npm run privacy
python -m py_compile scripts/note_mcp_stdio.py
git diff --check
npm start
```

`npm start` runs the Note plugin server. Use `npm run prototype` only when a static-only prototype server is needed.

## Hermes Plugin Docs

- `docs/HERMES_PLUGIN_MANIFEST.md`
- `docs/HERMES_PLUGIN_PROVISIONING.md`
- `docs/HERMES_PLUGIN_LAUNCH.md`
- `docs/HERMES_PLUGIN_MCP.md`
- `docs/HERMES_PLUGIN_HARNESS.md`

## Development Rules

- Business logic belongs in services/providers, not entrypoint files.
- Tests must match the H1/H2/H3 classification in `docs/TEST_MATRIX.md`.
- Do not commit runtime files, secrets, raw model responses, long logs, or complete private note bodies in fixtures, docs, or handoffs.
