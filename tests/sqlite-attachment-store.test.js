'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createSqliteAttachmentStore,
  openAttachmentDatabase
} = require('../src/stores/sqlite-attachment-store');

test('SQLite attachment store records blobs and workspace-bound objects', () => {
  const db = openAttachmentDatabase(':memory:');
  const store = createSqliteAttachmentStore({ db, idGenerator: () => 'object_row_1' });

  store.saveAsset({
    workspaceId: 'note:owner',
    noteId: 'note_1',
    attachmentId: 'att_1',
    name: 'scan.pdf',
    kind: 'document',
    size: 12,
    mime: 'application/pdf',
    storageKey: 'note_owner/aa/aa.pdf',
    sha256: 'a'.repeat(64),
    sourceHash: 'source_hash',
    status: 'active',
    createdAt: '2026-06-03T00:00:00.000Z'
  });

  const object = store.getObject('note:owner', 'att_1');
  assert.equal(object.name, 'scan.pdf');
  assert.equal(object.sha256, 'a'.repeat(64));
  assert.equal(object.storageKey, 'note_owner/aa/aa.pdf');
  assert.equal(object.mime, 'application/pdf');
  assert.equal(object.status, 'active');
  assert.equal(store.getObject('note:other', 'att_1'), null);
});

test('SQLite attachment store records missing objects without fake blobs', () => {
  const db = openAttachmentDatabase(':memory:');
  const store = createSqliteAttachmentStore({ db });

  store.saveAsset({
    workspaceId: 'note:owner',
    noteId: 'note_1',
    attachmentId: 'att_missing',
    name: 'missing.docx',
    kind: 'document',
    status: 'missing',
    createdAt: '2026-06-03T00:00:00.000Z'
  });

  const object = store.getObject('note:owner', 'att_missing');
  assert.equal(object.status, 'missing');
  assert.equal(object.sha256, '');
  assert.equal(object.storageKey, '');
});

test('SQLite attachment schema has integrity tables and workspace indexes', () => {
  const db = openAttachmentDatabase(':memory:');
  const tables = db.prepare("select name from sqlite_master where type = 'table'").all().map((row) => row.name);
  const indexes = db.prepare("select name from sqlite_master where type = 'index'").all().map((row) => row.name);

  assert.ok(tables.includes('attachment_blobs'));
  assert.ok(tables.includes('attachment_objects'));
  assert.ok(tables.includes('attachment_integrity_checks'));
  assert.ok(indexes.includes('idx_attachment_objects_workspace_note'));
  assert.ok(indexes.includes('idx_attachment_objects_workspace_status'));
});
