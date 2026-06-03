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

Yinxiang `.notes` import maps each exported file to one notebook. The importer stores the note body and attachment metadata in SQLite, materializes resource payloads under ignored `data/attachments/`, and keeps the raw `.notes` files under ignored `imports/`.

## Attachment

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Stable attachment id scoped by the imported note source key. |
| `workspace_id` | string | yes | Always filtered with the owning note workspace. |
| `note_id` | string | yes | Owning note id. |
| `name` | string | yes | Original display name when provided by the export. |
| `kind` | string | yes | Bounded type such as `image`, `audio`, `document`, or `file`. |
| `metadata_json.storageKey` | string | yes for imported binaries | Internal path key under the Note attachment root, not an absolute path. |

## Future Migration Rules

- Add schema migrations before changing persistent formats.
- Run migration dry runs before production use.
- Keep rollback instructions in `docs/DEPLOYMENT.md`.
