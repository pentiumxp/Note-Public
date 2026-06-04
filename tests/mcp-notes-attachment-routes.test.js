'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createHermesPluginRoutes } = require('../src/server-routes/hermes-plugin-routes');
const { openNoteDatabase } = require('../src/stores/sqlite-note-store');

test('MCP notes create persists attachments and returns bounded attachment output', async () => {
  const db = openNoteDatabase(':memory:');
  const attachmentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'note-mcp-route-attachments-'));
  const savedAssets = [];
  let id = 0;
  const route = createHermesPluginRoutes({
    pluginService: {
      async verifyWorkspaceKey() {
        return { workspace_id: 'note:owner' };
      }
    },
    db,
    attachmentRoot,
    attachmentStore: { saveAsset: (asset) => savedAssets.push(asset) },
    idGenerator: () => `id_${++id}`,
    clock: () => '2026-06-04T00:00:00.000Z'
  });

  const create = await callRoute(route, '/api/v1/notes', {
    method: 'POST',
    headers: {
      'x-note-workspace-id': 'note:owner',
      authorization: 'Bearer test-key'
    },
    json: {
      title: 'MCP attachment note',
      body: 'Synthetic route body',
      attachments: [{
        name: 'capture.txt',
        mime: 'text/plain',
        data_base64: Buffer.from('route attachment payload', 'utf8').toString('base64')
      }]
    }
  });

  assert.equal(create.status, 201);
  assert.equal(create.json.note.attachmentCount, 1);

  const rows = db.prepare(`
    select id, note_id, metadata_json
    from attachments
    where workspace_id = ?
  `).all('note:owner');
  assert.equal(rows.length, 1);
  const metadata = JSON.parse(rows[0].metadata_json);
  assert.equal(metadata.mime, 'text/plain');
  assert.equal(metadata.data_base64, undefined);
  const filePath = path.resolve(attachmentRoot, ...metadata.storageKey.split('/'));
  assert.equal(fs.readFileSync(filePath, 'utf8'), 'route attachment payload');
  assert.equal(savedAssets.length, 1);
  assert.equal(savedAssets[0].attachmentId, rows[0].id);

  const detail = await callRoute(route, `/api/v1/notes/${encodeURIComponent(create.json.note.id)}`, {
    headers: {
      'x-note-workspace-id': 'note:owner',
      authorization: 'Bearer test-key'
    }
  });
  assert.equal(detail.status, 200);
  assert.equal(detail.json.note.attachments[0].name, 'capture.txt');
  assert.equal(detail.json.note.attachments[0].available, true);
  assert.equal(detail.json.note.attachments[0].storageKey, undefined);
  assert.equal(JSON.stringify(detail.json).includes(metadata.storageKey), false);
});

async function callRoute(route, target, options = {}) {
  const url = new URL(target, 'http://note.test');
  const body = options.json ? Buffer.from(JSON.stringify(options.json), 'utf8') : Buffer.alloc(0);
  const request = {
    method: options.method || 'GET',
    headers: options.headers || {},
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
  const routed = await route(request, response, { url, pathname: url.pathname });
  return {
    routed,
    status: response.status,
    headers: response.headers,
    body: response.body,
    json: response.body ? JSON.parse(response.body) : null
  };
}
