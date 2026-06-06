'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { openNoteDatabase } = require('../src/stores/sqlite-note-store');
const { createSqliteReferenceGraphStore } = require('../src/stores/sqlite-reference-graph-store');

test('SQLite reference graph stores object refs and idempotent edges by workspace', () => {
  const db = openNoteDatabase(':memory:');
  const owner = createSqliteReferenceGraphStore({ db, workspaceId: 'note:owner' });
  const wuping = createSqliteReferenceGraphStore({ db, workspaceId: 'note:weixin_wuping' });

  const noteRef = owner.upsertObjectRef(ref('ref-note', 'note', 'note', 'note-1', 'Owner note'));
  const billRef = owner.upsertObjectRef(ref('ref-bill', 'finance', 'transaction', 'txn-1', 'Dinner 238'));
  const edge = owner.saveEdge({
    edge_id: 'edge-1',
    source_kind: 'object_ref',
    source_id: noteRef.ref_id,
    target_kind: 'object_ref',
    target_id: billRef.ref_id,
    relation_type: 'same_event',
    event_key: 'event-dinner',
    confidence: 1,
    created_by: 'hermes',
    created_at: '2026-06-06T00:00:00.000Z',
    metadata: {},
    idempotency_key: 'idem-dinner'
  });
  const duplicate = owner.saveEdge({
    edge_id: 'edge-duplicate',
    source_kind: 'object_ref',
    source_id: noteRef.ref_id,
    target_kind: 'object_ref',
    target_id: billRef.ref_id,
    relation_type: 'same_event',
    event_key: 'event-dinner',
    confidence: 1,
    created_by: 'hermes',
    created_at: '2026-06-06T00:00:01.000Z',
    metadata: {},
    idempotency_key: 'idem-dinner'
  });

  assert.equal(edge.edge_id, 'edge-1');
  assert.equal(duplicate.edge_id, 'edge-1');
  assert.equal(owner.listEdges({ target: { kind: 'object_ref', id: billRef.ref_id } }).length, 1);
  assert.equal(wuping.getObjectRefByIdentity('finance', 'transaction', 'txn-1'), null);
  assert.equal(wuping.listEdges({ target: { kind: 'object_ref', id: billRef.ref_id } }).length, 0);
});

test('SQLite reference graph schema has workspace indexes and graph tables', () => {
  const db = openNoteDatabase(':memory:');
  const tables = db.prepare(`
    select name from sqlite_master
    where type = 'table' and name like 'reference_%'
    order by name
  `).all().map((row) => row.name);
  const indexes = db.prepare(`
    select name from sqlite_master
    where type = 'index' and name like 'idx_reference_%'
    order by name
  `).all().map((row) => row.name);

  assert.deepEqual(tables, [
    'reference_edges',
    'reference_events',
    'reference_nodes',
    'reference_object_refs',
    'reference_provenance'
  ]);
  assert.ok(indexes.includes('idx_reference_object_refs_identity'));
  assert.ok(indexes.includes('idx_reference_edges_source'));
  assert.ok(indexes.includes('idx_reference_edges_target'));
  assert.ok(indexes.includes('idx_reference_edges_idempotency'));
});

function ref(refId, pluginId, objectType, objectId, title) {
  return {
    ref_id: refId,
    plugin_id: pluginId,
    object_type: objectType,
    object_id: objectId,
    display_title: title,
    display_subtitle: '',
    snapshot_time: '2026-06-06T00:00:00.000Z',
    permission_scope: {},
    created_at: '2026-06-06T00:00:00.000Z',
    updated_at: '2026-06-06T00:00:00.000Z'
  };
}
