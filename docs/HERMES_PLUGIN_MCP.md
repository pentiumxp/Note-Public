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
