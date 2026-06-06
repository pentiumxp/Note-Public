# Architecture

## Layers

| Layer | Responsibility | Current Path |
| --- | --- | --- |
| Service | Note lifecycle, validation, status transitions, permission hooks | `src/services/note-service.js` |
| Store | Persistence read/write abstraction | `src/stores/memory-note-store.js` |
| Provider | File/external-system import/export boundary | `src/providers/file-note-provider.js` |
| Projection | Workspace summaries, filters, task views | `src/view-models/workspace-view-model.js` |
| Hermes plugin service | Manifest, provisioning, workspace key hash verification, launch token creation | `src/services/hermes-plugin-service.js` |
| Document preview service | Bounded text extraction for Markdown/text and DOCX attachment previews | `src/services/document-preview-service.js` |
| MCP attachment service | Bounded MCP attachment payload validation and materialization | `src/services/mcp-attachment-service.js` |
| App workspace service | Embedded app workspace projection, imported body rendering delegation, attachment read/preview service calls | `src/services/app-workspace-service.js` |
| Reference graph service | Home AI Reference / Memory Graph V1 validation, relations, idempotent edges | `src/services/reference-graph-service.js` |
| Note reference service | Note-specific link/backlink wrappers and Note reference contract | `src/services/note-reference-service.js` |
| SQLite store | Note-owned persistent database and workspace-isolated reads/writes | `src/stores/sqlite-note-store.js` |
| Attachment SQLite store | Content-addressed attachment object/blob index | `src/stores/sqlite-attachment-store.js` |
| Reference graph SQLite store | Workspace-scoped object refs, edges, events, provenance | `src/stores/sqlite-reference-graph-store.js` |
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
| MCP attachment service | base64 payload limits, file materialization, attachment-store indexing | HTTP auth, note mutation, model prompts | `tests/mcp-attachment-service.test.js` |
| Document preview service | bounded text extraction for in-app viewer shells | raw file serving, workspace auth, UI shell rendering | `tests/attachment-file-preview-routes.test.js` |
| SQLite note store | `workspace_id` filtered note/workspace persistence | auth decisions, request parsing | `tests/sqlite-note-store.test.js` |
| Reference graph service | allowed relation vocabulary, idempotency, bounded metadata | route parsing, plugin object ownership | `tests/note-reference-service.test.js` |
| Reference graph store | workspace-scoped graph persistence and indexes | business relation validation | `tests/reference-graph-store.test.js` |
| Reference API routes | bounded HTTP DTOs for Note link wrappers and Note reference contract | graph validation, note lifecycle | `tests/reference-api-routes.test.js` |
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
reference_nodes(node_id, workspace_id, node_type, title, summary, privacy_class, metadata_json, created_at, updated_at)
reference_object_refs(ref_id, workspace_id, plugin_id, object_type, object_id, display_title, display_subtitle, display_time, thumbnail_hint, snapshot_time, permission_scope_json, created_at, updated_at)
reference_edges(edge_id, workspace_id, source_kind, source_id, target_kind, target_id, relation_type, event_key, confidence, created_by, created_at, metadata_json, provenance_id, idempotency_key, deleted_at)
reference_events(event_id, workspace_id, event_key, title, time_start, time_end, place_hint, summary, metadata_json, created_at, updated_at)
reference_provenance(provenance_id, workspace_id, source_type, source_ref, run_id, message_id, tool_call_id, idempotency_key, summary, metadata_json, created_at)
```

Required indexes:

```sql
create index idx_notes_workspace_updated on notes(workspace_id, updated_at desc);
create index idx_notes_workspace_deleted on notes(workspace_id, deleted_at);
create index idx_notebooks_workspace_name on notebooks(workspace_id, name);
create index idx_attachments_workspace_note on attachments(workspace_id, note_id);
create index idx_reference_object_refs_identity on reference_object_refs(workspace_id, plugin_id, object_type, object_id);
create index idx_reference_edges_source on reference_edges(workspace_id, source_kind, source_id, deleted_at);
create index idx_reference_edges_target on reference_edges(workspace_id, target_kind, target_id, deleted_at);
create unique index idx_reference_edges_idempotency on reference_edges(workspace_id, idempotency_key) where idempotency_key is not null and idempotency_key <> '';
```

Reference Graph alignment is documented in `docs/REFERENCE_GRAPH_ALIGNMENT_PLAN.md`.
Older `note_links` planning language is superseded by the Home AI Reference /
Memory Graph V1 contract.

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
- `POST /api/v1/notes/links`
- `GET /api/v1/notes/:id/links`
- `GET /api/v1/notes/backlinks`
- `DELETE /api/v1/notes/links/:id`
- `GET /api/v1/reference/object-types`
- `GET /api/v1/reference/get`
- `GET /api/v1/reference/summarize`

For the local embedded app surface, the server also exposes a same-origin app
workspace view:

- `GET /api/v1/app/workspace`
- `GET /api/v1/app/notes/:id`
- `GET /api/v1/app/attachments/:id`
- `GET /api/v1/app/attachments/:id/thumbnail`
- `GET /api/v1/app/attachments/:id/preview`

In embedded production, these routes resolve the workspace from the verified
launch token and fail closed when no launch token is present. Development-only
standalone runs may still use a configured fallback workspace. The app routes
must not expose a raw workspace key to browser JavaScript, and they must not
fall back to `note:owner` when Hermes launches a non-owner workspace. Hermes
MCP and plugin routes still use the workspace key contract above.

Attachment preview mirrors the Hermes Mobile viewer module. Note includes
`public/file-viewer.html`, `public/markdown-viewer.html`,
`public/pdf-viewer.html`, `public/markdown-renderer-client.js`, and the local
PDF.js assets under `public/vendor/pdfjs/`. The Note app opens non-image
attachments in an in-app iframe viewer:

- PDF files use `pdf-viewer.html` and render from same-origin fetched bytes
  through PDF.js `Uint8Array` input, not through the browser's native PDF
  iframe.
- Markdown files use `markdown-viewer.html` and render through the copied
  Hermes Markdown renderer.
- DOCX files use `file-viewer.html`; the app attachment preview endpoint
  returns bounded JSON text extracted by `src/services/document-preview-service.js`.

The preview endpoint never returns storage keys, database paths, raw launch
tokens, or attachment bytes. It is workspace-bound through the same app launch
verification as the attachment download route.

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

Initial external boundary is local file-system import/export plus MCP-provided bounded attachment payloads. Yinxiang `.notes` files are imported per notebook: each exported file name becomes a Note notebook in the target workspace, each note keeps its original ENML-like body, and resource payloads are materialized under the Note-owned attachment root. MCP attachments must arrive as bounded base64 payloads; model-provided paths, URLs, keys, launch tokens, and storage keys are rejected. The database stores bounded attachment metadata plus an internal `storageKey`, never a user-supplied absolute path. Runtime app attachment routes resolve `storageKey` only under the configured attachment root and reject path escape attempts. The runtime also mirrors attachment blob/object records into `data/attachment.sqlite3` when the attachment store is configured. Raw export files live under ignored `imports/` and are never committed. Cloud drives, Obsidian vaults, Git remotes, model services, and mobile clients are out of scope until documented.

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
