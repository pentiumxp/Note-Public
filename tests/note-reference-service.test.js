'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { openNoteDatabase } = require('../src/stores/sqlite-note-store');
const { createSqliteNoteStore } = require('../src/stores/sqlite-note-store');
const { createSqliteReferenceGraphStore } = require('../src/stores/sqlite-reference-graph-store');
const { createReferenceGraphService } = require('../src/services/reference-graph-service');
const { createNoteReferenceService } = require('../src/services/note-reference-service');

test('Note reference service links notes to plugin objects and returns backlinks', async () => {
  const db = openNoteDatabase(':memory:');
  seedNote(db, 'note:owner', 'note-1', 'Dinner note', 'Dinner with Zhang San, paid 238 CNY.');
  seedNote(db, 'note:weixin_wuping', 'wuping-note-1', 'Other workspace note', 'Private body.');

  const owner = serviceFor(db, 'note:owner');
  const wuping = serviceFor(db, 'note:weixin_wuping');

  const first = await owner.linkCreate({
    note_id: 'note-1',
    target_plugin_id: 'finance',
    target_object_type: 'transaction',
    target_object_id: 'txn-238',
    relation: 'same_event',
    label: 'Dinner 238',
    display_snapshot: { title: 'Dinner 238 CNY', subtitle: 'Finance transaction' },
    idempotency_key: 'same-dinner-link'
  });
  const duplicate = await owner.linkCreate({
    note_id: 'note-1',
    target_plugin_id: 'finance',
    target_object_type: 'transaction',
    target_object_id: 'txn-238',
    relation: 'same_event',
    idempotency_key: 'same-dinner-link'
  });

  assert.equal(duplicate.link.link_id, first.link.link_id);
  assert.equal(first.link.target.plugin_id, 'finance');
  await assert.rejects(
    () => owner.linkCreate({
      note_id: 'note-1',
      target_plugin_id: 'finance',
      target_object_type: 'transaction',
      target_object_id: 'txn-other',
      relation: 'same_event',
      idempotency_key: 'same-dinner-link'
    }),
    /Idempotency key was already used/
  );

  const links = await owner.linksList('note-1');
  assert.equal(links.links.length, 1);
  assert.equal(links.links[0].target.display.title, 'Dinner 238 CNY');

  const backlinks = await owner.backlinksList({
    plugin_id: 'finance',
    object_type: 'transaction',
    object_id: 'txn-238'
  });
  assert.equal(backlinks.links.length, 1);
  assert.equal(backlinks.notes[0].title, 'Dinner note');
  assert.equal(JSON.stringify(backlinks).includes('paid 238 CNY'), true);
  assert.equal(JSON.stringify(backlinks).includes('Private body'), false);

  const hidden = await wuping.backlinksList({
    plugin_id: 'finance',
    object_type: 'transaction',
    object_id: 'txn-238'
  });
  assert.deepEqual(hidden, { links: [], notes: [] });
});

test('Note reference service exposes bounded Note reference contract', async () => {
  const db = openNoteDatabase(':memory:');
  seedNote(db, 'note:owner', 'note-2', 'Long note', '<p>' + 'x'.repeat(1000) + '</p>');
  const service = serviceFor(db, 'note:owner');

  const types = service.referenceObjectTypes();
  assert.equal(types.object_types[0].object_type, 'note');
  assert.equal(types.object_types[0].relations.includes('same_event'), true);

  const object = await service.referenceGet('note', 'note-2');
  assert.equal(object.object.plugin_id, 'note');
  assert.equal(object.object.note_id, 'note-2');
  assert.ok(object.object.summary.length <= 500);
  assert.equal(Object.prototype.hasOwnProperty.call(object.object, 'body'), false);

  await assert.rejects(
    () => service.linkCreate({
      note_id: 'note-2',
      target_plugin_id: 'finance',
      target_object_type: 'transaction',
      target_object_id: 'txn-1',
      relation: 'explains'
    }),
    /Unsupported reference relation/
  );
});

function serviceFor(db, workspaceId) {
  const noteStore = createSqliteNoteStore({ db, workspaceId });
  const graphStore = createSqliteReferenceGraphStore({ db, workspaceId });
  const graphService = createReferenceGraphService({
    store: graphStore,
    idGenerator: prefixedIds(),
    clock: () => '2026-06-06T00:00:00.000Z'
  });
  return createNoteReferenceService({ noteStore, graphService });
}

function prefixedIds() {
  let i = 0;
  return (prefix = 'id') => `${prefix}_${++i}`;
}

function seedNote(db, workspaceId, id, title, body) {
  db.prepare(`
    insert into plugin_workspaces (
      workspace_id,
      hermes_workspace_id,
      display_name,
      access_key_hash,
      scopes_json,
      status,
      created_at,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(workspace_id) do nothing
  `).run(
    workspaceId,
    workspaceId.replace(/^note:/, ''),
    workspaceId,
    '0'.repeat(64),
    '[]',
    'active',
    '2026-06-06T00:00:00.000Z',
    '2026-06-06T00:00:00.000Z'
  );
  db.prepare(`
    insert into notes (
      id,
      workspace_id,
      title,
      body,
      notebook_id,
      tags_json,
      tasks_json,
      shortcut,
      status,
      created_at,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workspaceId,
    title,
    body,
    'inbox',
    '["MCP"]',
    '[]',
    0,
    'active',
    '2026-06-06T00:00:00.000Z',
    '2026-06-06T00:00:00.000Z'
  );
}
