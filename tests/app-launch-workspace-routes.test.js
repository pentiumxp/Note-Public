'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHermesPluginRoutes } = require('../src/server-routes/hermes-plugin-routes');
const { openNoteDatabase } = require('../src/stores/sqlite-note-store');

test('embedded app routes are scoped by launch token instead of default owner workspace', async () => {
  const db = openNoteDatabase(':memory:');
  seedWorkspace(db, 'note:owner', 'owner', 'Owner');
  seedWorkspace(db, 'note:weixin_wuping', 'weixin_wuping', 'WuPing');
  seedNote(db, {
    id: 'owner-note',
    workspaceId: 'note:owner',
    title: 'owner private note',
    body: '<p>owner body</p>'
  });
  seedNote(db, {
    id: 'wuping-note',
    workspaceId: 'note:weixin_wuping',
    title: 'wuping private note',
    body: '<p>wuping body</p>'
  });
  seedAttachment(db, {
    id: 'wuping-attachment',
    workspaceId: 'note:weixin_wuping',
    noteId: 'wuping-note'
  });

  const route = createHermesPluginRoutes({
    pluginService: fakePluginService({
      'owner-token': 'note:owner',
      'wuping-token': 'note:weixin_wuping'
    }),
    db,
    appWorkspaceId: 'note:owner',
    requireAppLaunchToken: true
  });

  const noToken = await callRoute(route, '/api/v1/app/workspace');
  assert.equal(noToken.status, 403);
  assert.equal(noToken.json.error, 'permission_denied');

  const wupingList = await callRoute(route, '/api/v1/app/workspace?launch=wuping-token');
  assert.equal(wupingList.status, 200);
  assert.equal(wupingList.json.workspace.id, 'note:weixin_wuping');
  assert.deepEqual(wupingList.json.notes.map((note) => note.title), ['wuping private note']);
  assert.match(wupingList.json.notes[0].attachments[0].url, /launch=wuping-token/);

  const ownerDetailFromWuping = await callRoute(route, '/api/v1/app/notes/owner-note?launch=wuping-token');
  assert.equal(ownerDetailFromWuping.status, 404);
  assert.equal(ownerDetailFromWuping.json.error, 'NOTE_NOT_FOUND');

  const ownerList = await callRoute(route, '/api/v1/app/workspace?launch=owner-token');
  assert.equal(ownerList.status, 200);
  assert.equal(ownerList.json.workspace.id, 'note:owner');
  assert.deepEqual(ownerList.json.notes.map((note) => note.title), ['owner private note']);
});

function fakePluginService(tokens) {
  return {
    async verifyLaunchToken(token) {
      const workspaceId = tokens[token];
      if (!workspaceId) {
        const error = new Error('invalid launch token');
        error.code = 'permission_denied';
        error.status = 403;
        throw error;
      }
      return {
        token,
        workspace_id: workspaceId,
        expires_at: '2099-01-01T00:00:00.000Z'
      };
    }
  };
}

async function callRoute(route, target, options = {}) {
  const url = new URL(target, 'http://note.test');
  const request = {
    method: options.method || 'GET',
    headers: options.headers || {},
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
  const routed = await route(request, response, { url, pathname: url.pathname });
  return {
    routed,
    status: response.status,
    headers: response.headers,
    body: response.body,
    json: response.body ? JSON.parse(response.body) : null
  };
}

function seedWorkspace(db, workspaceId, hermesWorkspaceId, displayName) {
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
    hermesWorkspaceId,
    displayName,
    '0'.repeat(64),
    JSON.stringify(['notes:read', 'notes:write', 'notes:search']),
    'active',
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
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
    note.body,
    'inbox',
    '[]',
    '[]',
    0,
    'active',
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  );
}

function seedAttachment(db, attachment) {
  db.prepare(`
    insert into attachments (
      id,
      workspace_id,
      note_id,
      name,
      kind,
      size,
      metadata_json,
      created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    attachment.id,
    attachment.workspaceId,
    attachment.noteId,
    'fixture.pdf',
    'file',
    12,
    JSON.stringify({ storageKey: 'fixture/attachment.pdf', mime: 'application/pdf' }),
    '2026-01-01T00:00:00.000Z'
  );
}
