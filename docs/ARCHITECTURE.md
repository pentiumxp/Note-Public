# Architecture

## Layers

| Layer | Responsibility | Current Path |
| --- | --- | --- |
| Service | Note lifecycle, validation, status transitions, permission hooks | `src/services/note-service.js` |
| Store | Persistence read/write abstraction | `src/stores/memory-note-store.js` |
| Provider | File/external-system import/export boundary | `src/providers/file-note-provider.js` |
| Projection | Workspace summaries, filters, task views | `src/view-models/workspace-view-model.js` |
| Hermes plugin service | Manifest, provisioning, workspace key hash verification, launch token creation | `src/services/hermes-plugin-service.js` |
| SQLite store | Note-owned persistent database and workspace-isolated reads/writes | `src/stores/sqlite-note-store.js` |
| Routes | HTTP glue for plugin and notes API | `src/server-routes/hermes-plugin-routes.js` |
| MCP wrapper | Workspace-bound stdio bridge for Hermes Agent | `scripts/note_mcp_stdio.py` |
| Importer | Yinxiang `.notes` notebook import into Note SQLite | `scripts/import-yinxiang-notes.js` |
| UI | Local web prototype, DOM events, rendering | `public/` |
| Harness | Service, contract, and workflow tests | `tests/` |

## Service First Boundary

Business rules belong in the note service:

- validating note input;
- assigning ids and timestamps through injected dependencies;
- enforcing update/delete semantics;
- organizing notebooks, tags, shortcuts, tasks, reminders, and attachment metadata;
- coordinating store/provider operations;
- returning bounded errors.

Entry files, future routes, and UI components may only parse input, inject dependencies, call services, and format responses.

## Hermes Mobile Plugin Boundary

Note is an independent plugin application, not a Hermes Mobile built-in module. Hermes Mobile owns plugin discovery, workspace-local config/key writing, same-origin iframe proxying, launch-token handoff, Gateway profile MCP registration, and topic/delivery-directory binding. Note owns the notes UI/API, SQLite data, workspace/user isolation, provisioning validation, launch validation, MCP wrapper, and Note-specific harnesses.

Every Hermes workspace maps to a separate Note workspace identity:

```text
note:<hermes_workspace_id>
```

Owner data must not be reused for another Hermes workspace. All Note service and MCP access must verify the workspace-local key against the stored hash for the target Note workspace.

## AI Memory Boundary

Hermes Mobile is the AI center and MCP orchestration layer. Note is a plugin that stores non-structured notes and cross-plugin object references.

Domain plugins keep their own structured data:

- billing owns bills and statistics;
- wardrobe owns clothing, outfits, and wear logs;
- people owns person and relationship records;
- calendar owns events and reminders.

Note may link a note to those objects, but must not copy their full data or write their business records directly. Hermes Mobile decides when to call each plugin MCP and when to create Note references.

## Modules

| Module | Owns | Does Not Own | Tests |
| --- | --- | --- | --- |
| Note service | validation, lifecycle, search projection | disk I/O, HTTP, UI rendering | `tests/note-service.test.js` |
| Note store | note persistence API | business rules, provider parsing | `tests/note-service.test.js` through fake/in-memory store |
| File provider | import/export adapter contract | permission decisions, note lifecycle | future provider tests |
| Workspace view model | filtered lists, counters, task summaries | persistence, note mutation | `tests/workspace-view-model.test.js` |
| Hermes plugin service | registration key validation, workspace id normalization, launch token creation | SQL persistence, route parsing, UI | `tests/hermes-plugin-service.test.js` |
| SQLite note store | `workspace_id` filtered note/workspace persistence | auth decisions, request parsing | `tests/sqlite-note-store.test.js` |
| MCP wrapper | workspace-local config/key loading, local tool names, bounded API calls | workspace selection by model args, raw key output | `tests/mcp-wrapper.test.js` |

## Data Model

Initial note shape:

```json
{
  "id": "note_...",
  "title": "string",
  "body": "string",
  "notebookId": "string",
  "tags": ["string"],
  "tasks": [{"id": "task_...", "text": "string", "done": false}],
  "attachments": [{"id": "att_...", "name": "string", "kind": "file"}],
  "shortcut": false,
  "reminderAt": null,
  "status": "active",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

Idempotency keys are required for future import/export workflows.

Hermes plugin SQLite tables:

```sql
plugin_workspaces(workspace_id, hermes_workspace_id, display_name, access_key_hash, scopes_json, status, created_at, updated_at)
launch_tokens(token, workspace_id, expires_at, created_at)
notes(id, workspace_id, title, body, notebook_id, tags_json, tasks_json, shortcut, reminder_at, status, created_at, updated_at, deleted_at)
notebooks(id, workspace_id, name, source, created_at, updated_at)
attachments(id, workspace_id, note_id, name, kind, size, metadata_json, created_at)
note_links(id, workspace_id, note_id, target_plugin_id, target_object_type, target_object_id, relation, label, display_snapshot_json, created_by, created_at, deleted_at)
```

Required indexes:

```sql
create index idx_notes_workspace_updated on notes(workspace_id, updated_at desc);
create index idx_notes_workspace_deleted on notes(workspace_id, deleted_at);
create index idx_notebooks_workspace_name on notebooks(workspace_id, name);
create index idx_attachments_workspace_note on attachments(workspace_id, note_id);
create index idx_note_links_note on note_links(workspace_id, note_id, deleted_at);
create index idx_note_links_target on note_links(workspace_id, target_plugin_id, target_object_type, target_object_id, deleted_at);
create index idx_note_links_relation on note_links(workspace_id, relation, deleted_at);
```

`note_links` is planned by `docs/CROSS_PLUGIN_REFERENCES_DESIGN.md`; implementation is pending.

## API and Messages

The local plugin server exposes bounded plugin and notes routes:

- `GET /api/v1/hermes/plugin/manifest`
- `POST /api/v1/hermes/plugin/workspaces`
- `POST /api/v1/hermes/plugin/launch`
- `GET /api/v1/notes/search`
- `GET /api/v1/notes/recent`
- `GET /api/v1/notes/:id`
- `POST /api/v1/notes`
- `PATCH /api/v1/notes/:id`
- `DELETE /api/v1/notes/:id`
- `GET /api/v1/notes/tags`

For the local embedded app surface, the server also exposes a same-origin, server-selected workspace view:

- `GET /api/v1/app/workspace`
- `GET /api/v1/app/notes/:id`

These routes are for rendering the configured app workspace, defaulting in development to `note:yinxiang_import`. They do not expose a raw workspace key to browser JavaScript. Hermes MCP and plugin routes still use the workspace key contract above.

Routes should expose bounded DTOs and use stable error codes:

- `NOTE_VALIDATION_FAILED`
- `NOTE_NOT_FOUND`
- `NOTE_PERMISSION_DENIED`
- `NOTE_PROVIDER_FAILED`
- `NOTE_TASK_NOT_FOUND`
- `registration_key_required`
- `registration_key_invalid`
- `invalid_workspace`
- `workspace_not_registered`
- `permission_denied`
- `workspace_registration_failed`

The embedded app supports `hermes:theme`, `hermes:workspace`, `hermes:refresh`, and `hermes:visibility`. It sends bounded `plugin:ready`, `plugin:refreshRequested`, and `plugin:navigationChanged` events only.

## Async and Recovery

There are no async queues in the local prototype. Any future import/export, sync, OCR, voice transcription, web clipper, model processing, or backfill workflow must define retry, duplicate submission, timeout, reconciliation, and recovery behavior before implementation.

## External Systems

Initial external boundary is local file-system import/export only. Yinxiang `.notes` files are imported per notebook: each exported file name becomes a Note notebook in the target workspace, each note keeps its original ENML-like body, and resource payloads are materialized under Note-owned ignored `data/attachments/`. The database stores bounded attachment metadata plus an internal `storageKey`, never a user-supplied absolute path. Raw export files live under ignored `imports/` and are never committed. Cloud drives, Obsidian vaults, Git remotes, model services, and mobile clients are out of scope until documented.

## Reference-App Mapping

| Reference Area | Local Prototype Equivalent | Notes |
| --- | --- | --- |
| 首页 | Main notes workspace | Desktop uses wide panes; mobile should collapse into tabbed surfaces. |
| 搜索 | Search input and filtered notes | Future mobile parity should expose a dedicated search tab. |
| Central create | `新建`, task, attachment actions | Needs bottom-sheet style menu for text, super note, photo, recording, attachment. |
| 模板 | Placeholder | Requires separate requirements before real template library. |
| 我的 | Placeholder sync/status/account panel | Must not store real account tokens. |
| 快捷方式/标签/提醒 | Sidebar filters and metadata | Reminder workflow becomes H1 if notifications sync externally. |

## Deployment Boundary

The scaffold is local-only. Production deployment requires `docs/DEPLOYMENT.md` to be expanded with backup, rollback, health checks, version checks, and operator runbooks.

## Observability

Initial logs must be bounded metadata only. Future structured logs may include route names, note counts, status codes, durations, and short error codes, but not private note bodies or secrets.
