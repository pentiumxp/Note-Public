'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createHermesPluginRoutes,
  normalizeImportedBody,
  notebookDisplayName
} = require('../src/server-routes/hermes-plugin-routes');
const { openNoteDatabase } = require('../src/stores/sqlite-note-store');

test('plain text note bodies preserve paragraphs, line breaks, and lists', () => {
  const html = normalizeImportedBody('第一段\n第二行\n\n- 项目一\n- 项目二');

  assert.match(html, /<p>第一段<br>第二行<\/p>/);
  assert.match(html, /<ul><li>项目一<\/li><li>项目二<\/li><\/ul>/);
});

test('ENML note bodies remove wrapper noise while preserving structure', () => {
  const html = normalizeImportedBody('<?xml version="1.0"?><!DOCTYPE en-note SYSTEM "x"><en-note><ul><li><div>事项</div></li></ul></en-note>');

  assert.doesNotMatch(html, /<\?xml|DOCTYPE|en-note/i);
  assert.match(html, /<ul><li><div>事项<\/div><\/li><\/ul>/);
});

test('notebook display names repair known mojibake and plugin ids', () => {
  assert.equal(notebookDisplayName('inbox', '???'), '收件箱');
  assert.equal(notebookDisplayName('hermes'), 'Home AI');
  assert.equal(notebookDisplayName('hermes', 'Hermes Mobile'), 'Home AI');
  assert.equal(notebookDisplayName('custom', '家庭资料'), '家庭资料');
});

test('app workspace includes readable notebook fallback rows', async () => {
  const db = openNoteDatabase(':memory:');
  seedWorkspace(db, 'note:owner');
  seedNotebook(db, { workspaceId: 'note:owner', id: 'inbox', name: '???' });
  seedNote(db, { workspaceId: 'note:owner', id: 'n1', notebookId: 'inbox', title: 'Inbox' });
  seedNote(db, { workspaceId: 'note:owner', id: 'n2', notebookId: 'hermes', title: 'Hermes' });
  const route = createHermesPluginRoutes({
    pluginService: fakePluginService(),
    db,
    requireAppLaunchToken: false,
    appWorkspaceId: 'note:owner'
  });

  const response = await callRoute(route, '/api/v1/app/workspace');

  assert.equal(response.status, 200);
  const notebooks = new Map(response.json.notebooks.map((notebook) => [notebook.id, notebook.name]));
  assert.equal(notebooks.get('inbox'), '收件箱');
  assert.equal(notebooks.get('hermes'), 'Home AI');
});

function fakePluginService() {
  return {
    async verifyWorkspaceKey() {
      return { workspace_id: 'note:owner' };
    }
  };
}

async function callRoute(route, target) {
  const url = new URL(target, 'http://note.test');
  const request = {
    method: 'GET',
    headers: {},
    async *[Symbol.asyncIterator]() {}
  };
  const response = {
    status: 0,
    headers: {},
    body: '',
    writeHead(status, headers = {}) {
      this.status = status;
      this.headers = headers;
    },
    end(chunk = '') {
      this.body += String(chunk);
    }
  };
  await route(request, response, { url, pathname: url.pathname });
  return {
    status: response.status,
    json: response.body ? JSON.parse(response.body) : null
  };
}

function seedWorkspace(db, workspaceId) {
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
  `).run(
    workspaceId,
    workspaceId.replace(/^note:/, ''),
    'Owner',
    '0'.repeat(64),
    '[]',
    'active',
    '2026-06-04T00:00:00.000Z',
    '2026-06-04T00:00:00.000Z'
  );
}

function seedNotebook(db, notebook) {
  db.prepare(`
    insert into notebooks (id, workspace_id, name, source, created_at, updated_at)
    values (?, ?, ?, ?, ?, ?)
  `).run(
    notebook.id,
    notebook.workspaceId,
    notebook.name,
    'fixture',
    '2026-06-04T00:00:00.000Z',
    '2026-06-04T00:00:00.000Z'
  );
}

function seedNote(db, note) {
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
    note.id,
    note.workspaceId,
    note.title,
    '正文',
    note.notebookId,
    '[]',
    '[]',
    0,
    'active',
    '2026-06-04T00:00:00.000Z',
    '2026-06-04T00:00:00.000Z'
  );
}
