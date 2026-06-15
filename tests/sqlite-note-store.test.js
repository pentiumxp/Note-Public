'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const {
  createSqliteHermesWorkspaceStore,
  createSqliteNoteStore,
  openNoteDatabase
} = require('../src/stores/sqlite-note-store');
const { ensureNotebookRecord } = require('../src/services/app-workspace-service');
const { hashRawKey } = require('../src/services/hermes-plugin-service');

test('SQLite note store isolates owner and non-owner workspaces', async () => {
  const db = openNoteDatabase(':memory:');
  const ownerStore = createSqliteNoteStore({ db, workspaceId: 'note:owner' });
  const testStore = createSqliteNoteStore({ db, workspaceId: 'note:weixin_test_1' });

  await ownerStore.save({
    id: 'same_note_id',
    title: 'Owner note',
    body: 'Owner-only body',
    notebookId: 'inbox',
    tags: ['owner'],
    tasks: [],
    attachments: [],
    shortcut: false,
    reminderAt: null,
    status: 'active',
    createdAt: '2026-06-03T00:00:00.000Z',
    updatedAt: '2026-06-03T00:00:00.000Z'
  });
  await testStore.save({
    id: 'test_note_id',
    title: 'Test workspace note',
    body: 'Non-owner body',
    notebookId: 'inbox',
    tags: ['test'],
    tasks: [],
    attachments: [{ id: 'att_1', name: 'scan.pdf', kind: 'document', size: 100 }],
    shortcut: false,
    reminderAt: null,
    status: 'active',
    createdAt: '2026-06-03T00:00:00.000Z',
    updatedAt: '2026-06-03T00:00:00.000Z'
  });

  assert.equal((await ownerStore.list()).length, 1);
  assert.equal((await testStore.list()).length, 1);
  assert.equal(await ownerStore.get('test_note_id'), null);
  assert.equal(await testStore.get('same_note_id'), null);
  assert.equal((await testStore.get('test_note_id')).attachments[0].name, 'scan.pdf');
});

test('SQLite workspace store saves access key hash only', async () => {
  const db = openNoteDatabase(':memory:');
  const workspaceStore = createSqliteHermesWorkspaceStore(db);

  await workspaceStore.saveWorkspace({
    workspace_id: 'note:weixin_wuping',
    hermes_workspace_id: 'weixin_wuping',
    display_name: '吴萍',
    access_key_hash: hashRawKey('raw-workspace-key'),
    scopes: ['notes:read'],
    status: 'active',
    created_at: '2026-06-03T00:00:00.000Z',
    updated_at: '2026-06-03T00:00:00.000Z'
  });

  const workspace = await workspaceStore.getWorkspace('note:weixin_wuping');
  assert.equal(workspace.access_key_hash, hashRawKey('raw-workspace-key'));
  assert.notEqual(workspace.access_key_hash, 'raw-workspace-key');
});

test('SQLite schema has required workspace indexes', () => {
  const db = openNoteDatabase(':memory:');
  const indexes = db.prepare("select name from sqlite_master where type = 'index'").all().map((row) => row.name);

  assert.ok(indexes.includes('idx_notes_workspace_updated'));
  assert.ok(indexes.includes('idx_notes_workspace_deleted'));
  assert.ok(indexes.includes('idx_attachments_workspace_note'));
});

test('SQLite schema migrates notebooks to workspace-scoped ids', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'note-notebooks-schema-'));
  const dbPath = path.join(dir, 'note.sqlite3');
  const oldDb = new DatabaseSync(dbPath);
  oldDb.exec(`
    create table notebooks (
      id text primary key,
      workspace_id text not null,
      name text not null,
      source text,
      created_at text not null,
      updated_at text not null,
      unique(workspace_id, name)
    );

    insert into notebooks (id, workspace_id, name, source, created_at, updated_at)
    values ('hermes', 'note:owner', 'Hermes Mobile', 'mcp', '2026-06-09T00:00:00.000Z', '2026-06-09T00:00:00.000Z');
  `);
  oldDb.close();

  const db = openNoteDatabase(dbPath);
  const tableInfo = db.prepare('pragma table_info(notebooks)').all();
  assert.equal(tableInfo.find((column) => column.name === 'workspace_id').pk, 1);
  assert.equal(tableInfo.find((column) => column.name === 'id').pk, 2);

  ensureNotebookRecord(db, 'note:owner', 'hermes');
  ensureNotebookRecord(db, 'note:weixin_wuping', 'hermes');

  const rows = db.prepare(`
    select workspace_id, id, name
    from notebooks
    where id = 'hermes'
    order by workspace_id
  `).all().map((row) => ({ ...row }));
  assert.deepEqual(rows, [
    { workspace_id: 'note:owner', id: 'hermes', name: 'Home AI' },
    { workspace_id: 'note:weixin_wuping', id: 'hermes', name: 'Home AI' }
  ]);
  db.close();
});
