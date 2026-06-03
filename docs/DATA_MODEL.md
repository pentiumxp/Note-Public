# Data Model

## Note

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Stable note id. |
| `title` | string | yes | Non-empty after trim. |
| `body` | string | yes | Private content; do not log or place in fixtures except synthetic examples. |
| `notebookId` | string | yes | Links the note to a workspace-local notebook. |
| `tags` | string[] | no | Normalized by the service. |
| `status` | string | yes | Initial value: `active`. |
| `createdAt` | string | yes | ISO-8601 timestamp. |
| `updatedAt` | string | yes | ISO-8601 timestamp. |

## Notebook

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Stable notebook id. |
| `workspace_id` | string | yes | Always scoped as `note:<hermes_workspace_id>`. |
| `name` | string | yes | Unique within one workspace. |
| `source` | string | no | Import provenance such as `yinxiang.notes`. |
| `created_at` | string | yes | ISO-8601 timestamp. |
| `updated_at` | string | yes | ISO-8601 timestamp. |

Yinxiang imports map exported notebooks to workspace-local notebooks. The importer stores note body and bounded attachment metadata in `note.sqlite3`, records attachment assets in `attachment.sqlite3`, materializes resource payloads under ignored `data/attachments/`, and keeps raw import files under ignored `imports/`.

## Attachment

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Stable attachment id scoped by the imported note source key. |
| `workspace_id` | string | yes | Always filtered with the owning note workspace. |
| `note_id` | string | yes | Owning note id. |
| `name` | string | yes | Original display name when provided by the export. |
| `kind` | string | yes | Bounded type such as `image`, `audio`, `document`, or `file`. |
| `metadata_json.storageKey` | string | yes for imported binaries | Internal path key under the Note attachment root, not an absolute path. |

Attachment bytes are not stored as BLOBs in `note.sqlite3`. The main Note database stores note-to-attachment metadata for UI and query projection only.

## Attachment Asset Ledger

`attachment.sqlite3` stores the durable attachment asset ledger:

| Table | Purpose |
| --- | --- |
| `attachment_blobs` | One row per unique content hash, including `sha256`, size, MIME, storage key, status, and timestamps. |
| `attachment_objects` | One row per logical workspace-bound note attachment, including note id, attachment id, display name, blob hash, source hash, and status. |
| `attachment_integrity_checks` | Append-only records for integrity scans. |

Attachment files are content-addressed under `data/attachments/<workspace>/<sha-prefix>/<sha><ext>`.

See `docs/ATTACHMENT_ASSET_STORE.md` for the required write flow and backup contract.

## Future Migration Rules

- Add schema migrations before changing persistent formats.
- Run migration dry runs before production use.
- Keep rollback instructions in `docs/DEPLOYMENT.md`.
