# Hermes Plugin Provisioning

## Endpoint

```http
POST /api/v1/hermes/plugin/workspaces
Authorization: Bearer <NOTE_REGISTRATION_KEY>
Content-Type: application/json
```

Hermes Mobile calls this endpoint from the server side only. It must not be called from browser UI.

## Registration Credential

The Note service accepts the registration credential from `NOTE_REGISTRATION_KEY`
or a server-side key file. Supported file environment variables are:

```text
NOTE_REGISTRATION_KEY_PATH
NOTE_REGISTRATION_KEY_FILE
HERMES_MOBILE_NOTE_PLUGIN_OWNER_KEY_PATH
HERMES_MOBILE_PLUGIN_NOTE_OWNER_KEY_PATH
NOTE_HERMES_OWNER_KEY_PATH
NOTE_HERMES_OWNER_KEY_FILE
```

Hermes Mobile production may also keep the key under its data directory as a
server-only plugin secret, for example:

```text
<Hermes data dir>/plugin-secrets/note-owner-key.txt
```

This file contains the Note registration credential only. It is not a workspace
raw key, launch token, cookie, or browser credential, and it must not be exposed
through frontend state, iframe URLs, logs, screenshots, docs, or MCP arguments.

## Workspace Mapping

Each Hermes workspace maps to one Note workspace:

```text
note:<hermes_workspace_id>
```

Examples:

```text
owner -> note:owner
weixin_wuping -> note:weixin_wuping
weixin_test_1 -> note:weixin_test_1
```

Owner data must not be reused when Hermes switches to another workspace.

## Request

```json
{
  "owner": "hermes",
  "workspace_id": "note:<hermes_workspace_id>",
  "hermes_workspace_id": "<hermes_workspace_id>",
  "target_workspace_id": "<hermes_workspace_id>",
  "display_name": "<workspace display name>",
  "access_key_hash": "<sha256(workspace-local raw key)>",
  "scopes": ["notes:read", "notes:write", "notes:search"]
}
```

The Note service stores the hash only. It never stores the raw workspace key.

## Responses

Success:

```json
{
  "ok": true,
  "workspace_id": "note:<hermes_workspace_id>",
  "hermes_workspace_id": "<hermes_workspace_id>",
  "status": "active",
  "provisioning_result": "created",
  "scopes": ["notes:read", "notes:write", "notes:search"]
}
```

Stable error codes:

| Code | Meaning |
| --- | --- |
| `registration_key_required` | Missing `NOTE_REGISTRATION_KEY` bearer credential |
| `registration_key_invalid` | Bearer credential does not match |
| `invalid_workspace` | Workspace ids are missing or conflict |
| `workspace_registration_failed` | Internal failure |

## Workspace-Local Files

Hermes Mobile writes these files inside the Hermes user's drive root:

```text
<Hermes user root>/.hermes-note/config.json
<Hermes user root>/.hermes-note/access-key.txt
```

`config.json` contains non-sensitive config only:

```json
{
  "schema_version": 1,
  "api_base_url": "http://127.0.0.1:<note-port>",
  "workspace_id": "note:<hermes_workspace_id>",
  "hermes_workspace_id": "<hermes_workspace_id>",
  "display_name": "<workspace display name>",
  "access_key_file": "access-key.txt",
  "scopes": ["notes:read", "notes:write", "notes:search"]
}
```

`access-key.txt` contains the workspace-local raw key and is read only by server-side tooling such as the MCP wrapper.
