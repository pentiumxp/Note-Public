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
PORT=4181
NOTE_DB_PATH=./data/note.sqlite3
NOTE_ATTACHMENT_DB_PATH=./data/attachment.sqlite3
NOTE_ATTACHMENT_ROOT=./data/attachments
NOTE_REGISTRATION_KEY=<provided outside repo>
NOTE_REGISTRATION_KEY_PATH=<server-only key file>
```

Example data paths:

```text
Windows dev: C:\ProgramData\HermesMobile\plugins\note\data\note.sqlite3
NAS prod:    /volume1/docker/note/data/note.sqlite3
```

Do not write raw registration keys, workspace-local keys, launch tokens, cookies, or database-private content into docs, logs, screenshots, handoff, or tests.

## Windows User-Level Watchdog

Local Hermes Mobile production uses `scripts/register-note-plugin-autostart.ps1`
to register `HermesMobileNotePluginWatchdog` under the current Windows user.
The watchdog keeps the Note plugin listening on `0.0.0.0:4181` and starts the
service with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\register-note-plugin-autostart.ps1 `
  -Port 4181 `
  -HostName 0.0.0.0 `
  -WorkspaceId note:owner `
  -RegistrationKeyPath C:\ProgramData\HermesMobile\data\plugin-secrets\note-owner-key.txt
```

If `-RegistrationKeyPath` is omitted, the registration script and watchdog try
`C:\ProgramData\HermesMobile\data\plugin-secrets\note-owner-key.txt` before
falling back to environment variables. The Note service must receive the
registration key path at process startup; otherwise Hermes workspace
provisioning fails closed with `registration_key_invalid` even when Hermes
itself has already created the key file.

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
