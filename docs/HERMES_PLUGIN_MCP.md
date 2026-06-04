# Hermes Plugin MCP

## Wrapper

Path:

```text
scripts/note_mcp_stdio.py
```

Windows example:

```powershell
python C:\Users\xuxin\Documents\Note\scripts\note_mcp_stdio.py `
  --workspace C:\ProgramData\HermesMobile\data\drive\users\<workspaceId> `
  --no-workspace-override `
  --api-base-url http://127.0.0.1:<note-port>
```

For Hermes Mobile Gateway workers running inside WSL, the Note plugin service
must listen on a Windows address reachable from WSL, normally `0.0.0.0:4181`,
and the MCP wrapper should use the Windows WSL host gateway address, for example
`http://172.27.192.1:4181`, not Windows-only loopback.

NAS example:

```bash
/opt/hermes-gateway-runtime/venv/bin/python \
  /volume1/docker/note/source/scripts/note_mcp_stdio.py \
  --workspace /volume1/docker/hermes-mobile/data/drive/users/<workspaceId> \
  --no-workspace-override \
  --api-base-url http://127.0.0.1:<note-port>
```

## Workspace Binding

The wrapper reads only:

```text
<workspace>/.hermes-note/config.json
<workspace>/.hermes-note/access-key.txt
```

It fails closed if config or key is missing. It does not fall back to Owner. It rejects model-provided workspace, key, or token override arguments.

## Tool Names

The wrapper returns local names:

```text
notes_search
notes_recent
notes_get
notes_create
notes_update
notes_delete
notes_tags_list
```

Hermes Agent adds the final callable prefix:

```text
mcp_note_notes_search
mcp_note_notes_recent
mcp_note_notes_get
mcp_note_notes_create
mcp_note_notes_update
mcp_note_notes_delete
mcp_note_notes_tags_list
```

The wrapper must not return `mcp_note_*` names, otherwise Hermes would create a double prefix.

## Output Boundary

Search and recent tools return bounded summaries: id, title, short snippet, tags, timestamps, and attachment count. `notes_get` returns one note body only. Tools never return raw workspace keys, launch tokens, cookies, database paths, or an unbounded note library dump.

## Attachment Input Boundary

`notes_create` and `notes_update` accept an optional `attachments` array. This is intended for small, bounded captures from Hermes Agent, not for arbitrary local file reads.

Each attachment item supports:

```json
{
  "name": "receipt.png",
  "kind": "image",
  "mime": "image/png",
  "size": 12345,
  "data_base64": "<bounded base64 payload>"
}
```

`content_base64` and `base64` are accepted as aliases for `data_base64`. The wrapper and API reject local paths, URLs, workspace overrides, keys, launch tokens, and storage keys in attachment arguments.

Limits:

- at most 8 attachments per call;
- at most 8 MiB decoded bytes per attachment;
- attachment bytes are stored under the Note attachment root using a content-addressed `workspace/sha-prefix/sha.ext` storage key;
- metadata is saved in the Note SQLite attachment rows and mirrored into the attachment SQLite index when the runtime attachment store is configured.

`notes_update` appends new attachments to the existing note. It does not replace or delete existing attachments. A future explicit attachment delete/replace tool should be added before exposing destructive attachment changes.

MCP outputs never return raw attachment bytes. Search/recent return attachment counts. `notes_get` may return bounded attachment metadata such as id, display name, kind, size, mime, created time, and availability, but not raw bytes, local paths, launch tokens, workspace keys, or database paths.
