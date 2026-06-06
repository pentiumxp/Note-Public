'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createHermesPluginRoutes } = require('../src/server-routes/hermes-plugin-routes');
const { openNoteDatabase } = require('../src/stores/sqlite-note-store');

test('reference API routes create links and backlinks in the bound workspace only', async () => {
  const db = openNoteDatabase(':memory:');
  seedNote(db, 'note:owner', 'owner-note', 'Owner dinner');
  seedNote(db, 'note:weixin_wuping', 'wuping-note', 'Wuping dinner');
  const route = createHermesPluginRoutes({
    pluginService: fakePluginService(),
    db,
    idGenerator: prefixedIds(),
    clock: () => '2026-06-06T00:00:00.000Z'
  });

  const created = await callRoute(route, '/api/v1/notes/links', {
    method: 'POST',
    workspaceId: 'note:owner',
    json: {
      note_id: 'owner-note',
      target_plugin_id: 'finance',
      target_object_type: 'transaction',
      target_object_id: 'txn-api',
      relation: 'evidence_for',
      display_snapshot: { title: 'Receipt txn-api' },
      idempotency_key: 'api-link'
    }
  });

  assert.equal(created.status, 201);
  assert.equal(created.json.link.relation, 'evidence_for');
  assert.equal(JSON.stringify(created.json).includes('access-key'), false);

  const backlinks = await callRoute(route, '/api/v1/notes/backlinks?plugin_id=finance&object_type=transaction&object_id=txn-api', {
    workspaceId: 'note:owner'
  });
  assert.equal(backlinks.status, 200);
  assert.deepEqual(backlinks.json.notes.map((note) => note.note_id), ['owner-note']);

  const hidden = await callRoute(route, '/api/v1/notes/backlinks?plugin_id=finance&object_type=transaction&object_id=txn-api', {
    workspaceId: 'note:weixin_wuping'
  });
  assert.equal(hidden.status, 200);
  assert.deepEqual(hidden.json.notes, []);
});

test('reference API exposes Note object contract without note body', async () => {
  const db = openNoteDatabase(':memory:');
  seedNote(db, 'note:owner', 'note-ref', 'Reference note', 'private body should only be summarized');
  const route = createHermesPluginRoutes({
    pluginService: fakePluginService(),
    db,
    idGenerator: prefixedIds(),
    clock: () => '2026-06-06T00:00:00.000Z'
  });

  const types = await callRoute(route, '/api/v1/reference/object-types', { workspaceId: 'note:owner' });
  assert.equal(types.status, 200);
  assert.equal(types.json.object_types[0].object_type, 'note');

  const object = await callRoute(route, '/api/v1/reference/get?object_type=note&object_id=note-ref', { workspaceId: 'note:owner' });
  assert.equal(object.status, 200);
  assert.equal(object.json.object.title, 'Reference note');
  assert.equal(Object.prototype.hasOwnProperty.call(object.json.object, 'body'), false);

  const summary = await callRoute(route, '/api/v1/reference/summarize?object_type=note&object_id=note-ref&purpose=link-preview', { workspaceId: 'note:owner' });
  assert.equal(summary.status, 200);
  assert.equal(summary.json.summary.purpose, 'link-preview');
});

function fakePluginService() {
  return {
    async verifyWorkspaceKey({ workspaceId }) {
      return { workspace_id: workspaceId };
    }
  };
}

async function callRoute(route, target, options = {}) {
  const url = new URL(target, 'http://note.test');
  const body = options.json ? Buffer.from(JSON.stringify(options.json), 'utf8') : Buffer.alloc(0);
  const request = {
    method: options.method || 'GET',
    headers: {
      'x-note-workspace-id': options.workspaceId || 'note:owner',
      authorization: 'Bearer test-key'
    },
    async *[Symbol.asyncIterator]() {
      if (body.length) {
        yield body;
      }
    }
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

function prefixedIds() {
  let i = 0;
  return (prefix = 'id') => `${prefix}_${++i}`;
}

function seedNote(db, workspaceId, id, title, body = 'body') {
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
    '[]',
    '[]',
    0,
    'active',
    '2026-06-06T00:00:00.000Z',
    '2026-06-06T00:00:00.000Z'
  );
}
