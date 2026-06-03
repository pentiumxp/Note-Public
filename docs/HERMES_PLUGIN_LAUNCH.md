# Hermes Plugin Launch

## Endpoint

```http
POST /api/v1/hermes/plugin/launch
Authorization: Bearer <workspace-local raw key>
Content-Type: application/json
```

Hermes Mobile calls launch from the server side after workspace provisioning.

## Request

```json
{
  "workspace_id": "note:<hermes_workspace_id>",
  "target_workspace_id": "<hermes_workspace_id>"
}
```

The Note service verifies:

- the Note workspace exists;
- the workspace id maps to the same Hermes workspace id;
- the raw key hash matches the hash saved during provisioning.

## Success Response

```json
{
  "entry_path": "/note.html?embed=hermes&launch=<short-lived-token>",
  "expires_in": 300,
  "expires_in_seconds": 300
}
```

The entry path must not include raw keys, workspace ids, database paths, local file paths, cookies, or private note content.

## Stable Error Codes

| Code | Meaning |
| --- | --- |
| `workspace_not_registered` | Workspace was not provisioned |
| `permission_denied` | Missing or invalid workspace-local key |
| `invalid_workspace` | Workspace ids conflict |
| `workspace_registration_failed` | Internal failure |

## Embedded App Contract

The iframe entry is `/note.html?embed=hermes`. Note supports these inbound messages:

- `hermes:theme`
- `hermes:workspace`
- `hermes:refresh`
- `hermes:visibility`

Note sends these bounded host events:

- `plugin:ready`
- `plugin:refreshRequested`
- `plugin:navigationChanged`

Messages must not carry raw note body batches, raw workspace keys, launch tokens, cookies, or secrets.
