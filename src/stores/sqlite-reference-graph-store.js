'use strict';

const { ensureReferenceGraphSchema } = require('./sqlite-reference-graph-schema');

function createSqliteReferenceGraphStore({ db, workspaceId }) {
  requireWorkspaceId(workspaceId);
  ensureReferenceGraphSchema(db);

  return {
    saveNode(node) {
      db.prepare(`
        insert into reference_nodes (
          node_id,
          workspace_id,
          node_type,
          title,
          summary,
          privacy_class,
          metadata_json,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(node_id) do update set
          title = excluded.title,
          summary = excluded.summary,
          privacy_class = excluded.privacy_class,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at
        where reference_nodes.workspace_id = excluded.workspace_id
      `).run(
        node.node_id,
        workspaceId,
        node.node_type,
        node.title,
        node.summary || '',
        node.privacy_class || 'private',
        JSON.stringify(node.metadata || {}),
        node.created_at,
        node.updated_at
      );
      return this.getNode(node.node_id);
    },

    getNode(nodeId) {
      const row = db.prepare(`
        select node_id, workspace_id, node_type, title, summary, privacy_class, metadata_json, created_at, updated_at
        from reference_nodes
        where workspace_id = ? and node_id = ?
      `).get(workspaceId, nodeId);
      return row ? nodeFromRow(row) : null;
    },

    upsertObjectRef(ref) {
      db.prepare(`
        insert into reference_object_refs (
          ref_id,
          workspace_id,
          plugin_id,
          object_type,
          object_id,
          display_title,
          display_subtitle,
          display_time,
          thumbnail_hint,
          snapshot_time,
          permission_scope_json,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(workspace_id, plugin_id, object_type, object_id) do update set
          display_title = excluded.display_title,
          display_subtitle = excluded.display_subtitle,
          display_time = excluded.display_time,
          thumbnail_hint = excluded.thumbnail_hint,
          snapshot_time = excluded.snapshot_time,
          permission_scope_json = excluded.permission_scope_json,
          updated_at = excluded.updated_at
      `).run(
        ref.ref_id,
        workspaceId,
        ref.plugin_id,
        ref.object_type,
        ref.object_id,
        ref.display_title,
        ref.display_subtitle || '',
        ref.display_time || null,
        ref.thumbnail_hint || null,
        ref.snapshot_time,
        JSON.stringify(ref.permission_scope || {}),
        ref.created_at,
        ref.updated_at
      );
      return this.getObjectRefByIdentity(ref.plugin_id, ref.object_type, ref.object_id);
    },

    getObjectRefByIdentity(pluginId, objectType, objectId) {
      const row = db.prepare(`
        select ref_id, workspace_id, plugin_id, object_type, object_id, display_title, display_subtitle,
          display_time, thumbnail_hint, snapshot_time, permission_scope_json, created_at, updated_at
        from reference_object_refs
        where workspace_id = ? and plugin_id = ? and object_type = ? and object_id = ?
      `).get(workspaceId, pluginId, objectType, objectId);
      return row ? objectRefFromRow(row) : null;
    },

    getObjectRefById(refId) {
      const row = db.prepare(`
        select ref_id, workspace_id, plugin_id, object_type, object_id, display_title, display_subtitle,
          display_time, thumbnail_hint, snapshot_time, permission_scope_json, created_at, updated_at
        from reference_object_refs
        where workspace_id = ? and ref_id = ?
      `).get(workspaceId, refId);
      return row ? objectRefFromRow(row) : null;
    },

    saveEdge(edge) {
      if (edge.idempotency_key) {
        const existing = db.prepare(`
          select edge_id, workspace_id, source_kind, source_id, target_kind, target_id, relation_type,
            event_key, confidence, created_by, created_at, metadata_json, provenance_id, idempotency_key, deleted_at
          from reference_edges
          where workspace_id = ? and idempotency_key = ?
        `).get(workspaceId, edge.idempotency_key);
        if (existing) {
          return edgeFromRow(existing);
        }
      }
      db.prepare(`
        insert into reference_edges (
          edge_id,
          workspace_id,
          source_kind,
          source_id,
          target_kind,
          target_id,
          relation_type,
          event_key,
          confidence,
          created_by,
          created_at,
          metadata_json,
          provenance_id,
          idempotency_key,
          deleted_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null)
      `).run(
        edge.edge_id,
        workspaceId,
        edge.source_kind,
        edge.source_id,
        edge.target_kind,
        edge.target_id,
        edge.relation_type,
        edge.event_key || null,
        edge.confidence,
        edge.created_by,
        edge.created_at,
        JSON.stringify(edge.metadata || {}),
        edge.provenance_id || null,
        edge.idempotency_key || null
      );
      return this.getEdge(edge.edge_id);
    },

    getEdge(edgeId) {
      const row = db.prepare(`
        select edge_id, workspace_id, source_kind, source_id, target_kind, target_id, relation_type,
          event_key, confidence, created_by, created_at, metadata_json, provenance_id, idempotency_key, deleted_at
        from reference_edges
        where workspace_id = ? and edge_id = ?
      `).get(workspaceId, edgeId);
      return row ? edgeFromRow(row) : null;
    },

    getEdgeByIdempotency(idempotencyKey) {
      const key = String(idempotencyKey || '').trim();
      if (!key) {
        return null;
      }
      const row = db.prepare(`
        select edge_id, workspace_id, source_kind, source_id, target_kind, target_id, relation_type,
          event_key, confidence, created_by, created_at, metadata_json, provenance_id, idempotency_key, deleted_at
        from reference_edges
        where workspace_id = ? and idempotency_key = ?
      `).get(workspaceId, key);
      return row ? edgeFromRow(row) : null;
    },

    listEdges(filter = {}) {
      const clauses = ['workspace_id = ?', 'deleted_at is null'];
      const values = [workspaceId];
      if (filter.source) {
        clauses.push('source_kind = ? and source_id = ?');
        values.push(filter.source.kind, filter.source.id);
      }
      if (filter.target) {
        clauses.push('target_kind = ? and target_id = ?');
        values.push(filter.target.kind, filter.target.id);
      }
      if (filter.event_key) {
        clauses.push('event_key = ?');
        values.push(filter.event_key);
      }
      if (filter.relation_type) {
        clauses.push('relation_type = ?');
        values.push(filter.relation_type);
      }
      const limit = Math.max(1, Math.min(100, Number(filter.limit || 50)));
      const rows = db.prepare(`
        select edge_id, workspace_id, source_kind, source_id, target_kind, target_id, relation_type,
          event_key, confidence, created_by, created_at, metadata_json, provenance_id, idempotency_key, deleted_at
        from reference_edges
        where ${clauses.join(' and ')}
        order by created_at desc
        limit ${limit}
      `).all(...values);
      return rows.map(edgeFromRow);
    },

    deleteEdge(edgeId, deletedAt) {
      const result = db.prepare(`
        update reference_edges
        set deleted_at = ?
        where workspace_id = ? and edge_id = ? and deleted_at is null
      `).run(deletedAt, workspaceId, edgeId);
      return result.changes > 0;
    },

    upsertEvent(event) {
      db.prepare(`
        insert into reference_events (
          event_id,
          workspace_id,
          event_key,
          title,
          time_start,
          time_end,
          place_hint,
          summary,
          metadata_json,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(workspace_id, event_key) do update set
          title = excluded.title,
          time_start = excluded.time_start,
          time_end = excluded.time_end,
          place_hint = excluded.place_hint,
          summary = excluded.summary,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at
      `).run(
        event.event_id,
        workspaceId,
        event.event_key,
        event.title,
        event.time_start || null,
        event.time_end || null,
        event.place_hint || null,
        event.summary || '',
        JSON.stringify(event.metadata || {}),
        event.created_at,
        event.updated_at
      );
      return this.getEventByKey(event.event_key);
    },

    getEventByKey(eventKey) {
      const row = db.prepare(`
        select event_id, workspace_id, event_key, title, time_start, time_end, place_hint,
          summary, metadata_json, created_at, updated_at
        from reference_events
        where workspace_id = ? and event_key = ?
      `).get(workspaceId, eventKey);
      return row ? eventFromRow(row) : null;
    },

    saveProvenance(record) {
      db.prepare(`
        insert into reference_provenance (
          provenance_id,
          workspace_id,
          source_type,
          source_ref,
          run_id,
          message_id,
          tool_call_id,
          idempotency_key,
          summary,
          metadata_json,
          created_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        record.provenance_id,
        workspaceId,
        record.source_type,
        record.source_ref,
        record.run_id || null,
        record.message_id || null,
        record.tool_call_id || null,
        record.idempotency_key || null,
        record.summary || '',
        JSON.stringify(record.metadata || {}),
        record.created_at
      );
      return { ...record, workspace_id: workspaceId };
    }
  };
}

function nodeFromRow(row) {
  return {
    node_id: row.node_id,
    workspace_id: row.workspace_id,
    node_type: row.node_type,
    title: row.title,
    summary: row.summary,
    privacy_class: row.privacy_class,
    metadata: safeJson(row.metadata_json, {}),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function objectRefFromRow(row) {
  return {
    ref_id: row.ref_id,
    workspace_id: row.workspace_id,
    plugin_id: row.plugin_id,
    object_type: row.object_type,
    object_id: row.object_id,
    display: {
      title: row.display_title,
      subtitle: row.display_subtitle || '',
      time: row.display_time || '',
      thumbnail_hint: row.thumbnail_hint || ''
    },
    snapshot_time: row.snapshot_time,
    permission_scope: safeJson(row.permission_scope_json, {}),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function edgeFromRow(row) {
  return {
    edge_id: row.edge_id,
    workspace_id: row.workspace_id,
    source: { kind: row.source_kind, id: row.source_id },
    target: { kind: row.target_kind, id: row.target_id },
    relation_type: row.relation_type,
    event_key: row.event_key || '',
    confidence: Number(row.confidence),
    created_by: row.created_by,
    created_at: row.created_at,
    metadata: safeJson(row.metadata_json, {}),
    provenance_id: row.provenance_id || '',
    idempotency_key: row.idempotency_key || '',
    deleted_at: row.deleted_at || ''
  };
}

function eventFromRow(row) {
  return {
    event_id: row.event_id,
    workspace_id: row.workspace_id,
    event_key: row.event_key,
    title: row.title,
    time_start: row.time_start || '',
    time_end: row.time_end || '',
    place_hint: row.place_hint || '',
    summary: row.summary,
    metadata: safeJson(row.metadata_json, {}),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function requireWorkspaceId(workspaceId) {
  if (!workspaceId || typeof workspaceId !== 'string' || !workspaceId.startsWith('note:')) {
    throw new Error('workspaceId must use note:<hermes_workspace_id>');
  }
}

module.exports = {
  createSqliteReferenceGraphStore,
  ensureReferenceGraphSchema
};
