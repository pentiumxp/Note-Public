'use strict';

function ensureReferenceGraphSchema(db) {
  db.exec(`
    create table if not exists reference_nodes (
      node_id text primary key,
      workspace_id text not null,
      node_type text not null,
      title text not null,
      summary text not null,
      privacy_class text not null,
      metadata_json text not null,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists reference_object_refs (
      ref_id text primary key,
      workspace_id text not null,
      plugin_id text not null,
      object_type text not null,
      object_id text not null,
      display_title text not null,
      display_subtitle text not null,
      display_time text,
      thumbnail_hint text,
      snapshot_time text not null,
      permission_scope_json text not null,
      created_at text not null,
      updated_at text not null,
      unique(workspace_id, plugin_id, object_type, object_id)
    );

    create table if not exists reference_edges (
      edge_id text primary key,
      workspace_id text not null,
      source_kind text not null,
      source_id text not null,
      target_kind text not null,
      target_id text not null,
      relation_type text not null,
      event_key text,
      confidence real not null,
      created_by text not null,
      created_at text not null,
      metadata_json text not null,
      provenance_id text,
      idempotency_key text,
      deleted_at text
    );

    create table if not exists reference_events (
      event_id text primary key,
      workspace_id text not null,
      event_key text not null,
      title text not null,
      time_start text,
      time_end text,
      place_hint text,
      summary text not null,
      metadata_json text not null,
      created_at text not null,
      updated_at text not null,
      unique(workspace_id, event_key)
    );

    create table if not exists reference_provenance (
      provenance_id text primary key,
      workspace_id text not null,
      source_type text not null,
      source_ref text not null,
      run_id text,
      message_id text,
      tool_call_id text,
      idempotency_key text,
      summary text not null,
      metadata_json text not null,
      created_at text not null
    );

    create index if not exists idx_reference_nodes_workspace_type
      on reference_nodes(workspace_id, node_type);
    create index if not exists idx_reference_object_refs_identity
      on reference_object_refs(workspace_id, plugin_id, object_type, object_id);
    create index if not exists idx_reference_edges_source
      on reference_edges(workspace_id, source_kind, source_id, deleted_at);
    create index if not exists idx_reference_edges_target
      on reference_edges(workspace_id, target_kind, target_id, deleted_at);
    create index if not exists idx_reference_edges_event
      on reference_edges(workspace_id, event_key, deleted_at);
    create index if not exists idx_reference_edges_relation
      on reference_edges(workspace_id, relation_type, deleted_at);
    create unique index if not exists idx_reference_edges_idempotency
      on reference_edges(workspace_id, idempotency_key)
      where idempotency_key is not null and idempotency_key <> '';
    create index if not exists idx_reference_events_workspace_key
      on reference_events(workspace_id, event_key);
  `);
}

module.exports = {
  ensureReferenceGraphSchema
};
