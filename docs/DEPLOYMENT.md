# Deployment

## Current State

Note now has a local plugin server for Hermes Mobile integration. Production deployment still requires operator-selected backup, rollback, and health-check wiring.

## Runtime

```powershell
npm start
```

`npm start` runs `scripts/note-server.js`, serving both the embedded app and plugin API.

## Environment

```text
HOST=0.0.0.0
PORT=4173
NOTE_DB_PATH=./data/note.sqlite3
NOTE_REGISTRATION_KEY=<provided outside repo>
```

Example data paths:

```text
Windows dev: C:\ProgramData\HermesMobile\plugins\note\data\note.sqlite3
NAS prod:    /volume1/docker/note/data/note.sqlite3
```

Do not write raw registration keys, workspace-local keys, launch tokens, cookies, or database-private content into docs, logs, screenshots, handoff, or tests.

## Required Before Deployment

- selected runtime and hosting target;
- backup location;
- rollback command;
- health check command;
- privacy-safe logging configuration;
- migration dry run;
- production smoke checklist.

## Local Validation

```powershell
npm test
npm run check
npm run check:architecture
npm run privacy
python -m py_compile scripts/note_mcp_stdio.py
git diff --check
```

## Hermes Mobile Configuration Needed

Hermes Mobile must provide:

- plugin manifest URL, for example `HERMES_MOBILE_NOTE_PLUGIN_MANIFEST_URL`;
- server-side `NOTE_REGISTRATION_KEY` for provisioning calls;
- workspace-local `.hermes-note/config.json` and `access-key.txt`;
- same-origin iframe proxy for returned launch `entry_path`;
- Gateway profile `mcp_servers.note` pointing at `scripts/note_mcp_stdio.py`.
