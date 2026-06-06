# Reference Graph Alignment Plan

Last updated: 2026-06-06.

## Decision

Note cross-plugin references must follow the Home AI Reference / Memory Graph V1
contract. Note must not create a separate ad-hoc reference format for Finance,
Wardrobe, People, Email, Directory, or future plugins.

The canonical platform contract remains:

```text
C:\Users\xuxin\Documents\Agent\docs\IMPLEMENTATION_NOTES\reference-memory-graph-v1.md
```

This document records Note-local implementation choices only.

## Current Local Implementation

Note now has a service-first local graph slice:

| Layer | Path |
| --- | --- |
| Graph schema | `src/stores/sqlite-reference-graph-schema.js` |
| Graph store | `src/stores/sqlite-reference-graph-store.js` |
| Graph service | `src/services/reference-graph-service.js` |
| Note wrappers | `src/services/note-reference-service.js` |
| Reference HTTP routes | `src/server-routes/reference-api-routes.js` |
| MCP wrapper | `scripts/note_mcp_stdio.py` |

The implementation uses the existing Note SQLite database. It adds these tables:

```text
reference_nodes
reference_object_refs
reference_edges
reference_events
reference_provenance
```

All graph queries are scoped by `workspace_id`. Object identity is:

```text
workspace_id + plugin_id + object_type + object_id
```

## Note MCP Surface

The wrapper returns local tool names only:

```text
notes_link_create
notes_links_list
notes_backlinks_list
notes_link_delete
reference_object_types
reference_get
reference_summarize
```

Hermes Agent adds the final callable prefix, for example:

```text
mcp_note_notes_link_create
mcp_note_reference_get
```

The wrapper must not return pre-prefixed `mcp_note_*` names.

## Boundaries

Note may store:

- free-form note text;
- attachments;
- stable references to plugin-owned objects;
- bounded display snapshots for UI and backlink lists.

Note must not store:

- full Finance/Wardrobe/People/Email object details;
- raw workspace keys, launch tokens, cookies, DB paths, or local file paths;
- unbounded private note body batches in list/search/backlink outputs.

Hermes Mobile remains responsible for multi-plugin orchestration. Note link
tools create graph links only; they do not create bills, clothing records,
people records, emails, or calendar events.

## Relation Vocabulary

V1 relation values are intentionally small:

```text
mentions
same_event
evidence_for
created_from
context_for
followup_to
```

Do not add near-duplicate relation names in Note without updating the central
Home AI contract and the Note harness.

## Idempotency

`notes_link_create` accepts `idempotency_key`. Repeated calls with the same key
return the existing edge and must not create duplicate links.

Repeated calls must also avoid degrading a previously useful display snapshot
into a bare object id.

## Harness

The focused harnesses are:

```text
tests/reference-graph-store.test.js
tests/note-reference-service.test.js
tests/reference-api-routes.test.js
tests/mcp-wrapper.test.js
scripts/check-architecture.js
```

They cover:

- graph table/index creation;
- workspace-isolated object refs and edges;
- idempotent edge creation;
- Note-to-Finance backlinks;
- Owner/non-Owner isolation;
- invalid relation rejection;
- bounded Note `reference_get` and `reference_summarize`;
- MCP local tool names without `mcp_note_` pre-prefixing;
- service-first route line budgets.
