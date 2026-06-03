# Hermes Plugin Manifest

## Endpoint

```http
GET /api/v1/hermes/plugin/manifest
```

The manifest is readable on fresh install. It only proves the Note plugin is installed; it does not mean any Hermes workspace has been provisioned.

## Bounded Shape

```json
{
  "id": "note",
  "title": "笔记",
  "kind": "embedded_app",
  "entry": {
    "url": "/note.html?embed=hermes",
    "mode": "iframe"
  },
  "launch": {
    "endpoint": "/api/v1/hermes/plugin/launch",
    "method": "POST",
    "token_ttl_seconds": 300
  },
  "provisioning": {
    "endpoint": "/api/v1/hermes/plugin/workspaces",
    "method": "POST",
    "mode": "workspace_binding"
  },
  "mcp": {
    "server": "note",
    "toolset": "note",
    "requiredTools": ["mcp_note_notes_search", "mcp_note_notes_create"]
  },
  "toolsets": ["note"],
  "workspace": {
    "required": true,
    "idFormat": "note:<hermes_workspace_id>"
  },
  "embedding": {
    "sameOriginProxy": true,
    "postMessage": true,
    "themeInheritance": true
  }
}
```

## Privacy Boundary

The manifest must not expose secrets, database paths, local filesystem roots, raw workspace keys, launch tokens, cookies, note bodies, or user-private data.

## Hermes Mobile Side

Hermes Mobile should register this endpoint through a configuration value such as `HERMES_MOBILE_NOTE_PLUGIN_MANIFEST_URL`. Workspace activation still requires provisioning.
