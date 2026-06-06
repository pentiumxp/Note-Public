'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createHermesPluginRoutes } = require('../src/server-routes/hermes-plugin-routes');
const { openNoteDatabase } = require('../src/stores/sqlite-note-store');

test('app attachment preview routes expose bounded text previews for Markdown and Word', async () => {
  const db = openNoteDatabase(':memory:');
  const attachmentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'note-app-preview-'));
  seedNote(db, { id: 'note-1', workspaceId: 'note:owner' });
  seedNote(db, { id: 'note-2', workspaceId: 'note:wuping' });
  writeAttachment(attachmentRoot, 'note_owner/att-md.md', '# Heading\n\nroute markdown body');
  writeAttachment(attachmentRoot, 'note_owner/att-docx.docx', createMinimalDocxBuffer('Word preview body'));
  seedAttachment(db, {
    id: 'att-md',
    workspaceId: 'note:owner',
    noteId: 'note-1',
    name: 'readme.md',
    size: 28,
    storageKey: 'note_owner/att-md.md',
    mime: 'text/markdown'
  });
  seedAttachment(db, {
    id: 'att-docx',
    workspaceId: 'note:owner',
    noteId: 'note-1',
    name: 'contract.docx',
    size: 512,
    storageKey: 'note_owner/att-docx.docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
  seedAttachment(db, {
    id: 'att-other',
    workspaceId: 'note:wuping',
    noteId: 'note-2',
    name: 'private.md',
    size: 7,
    storageKey: 'note_owner/att-md.md',
    mime: 'text/markdown'
  });

  const route = createHermesPluginRoutes({
    pluginService: fakePluginService(),
    db,
    appWorkspaceId: 'note:owner',
    attachmentRoot
  });

  const markdown = await callRoute(route, '/api/v1/app/attachments/att-md/preview');
  assert.equal(markdown.status, 200);
  assert.equal(markdown.json.name, 'readme.md');
  assert.equal(markdown.json.mime, 'text/markdown');
  assert.match(markdown.json.text, /route markdown body/);
  assert.equal(JSON.stringify(markdown.json).includes('storageKey'), false);
  assert.equal(JSON.stringify(markdown.json).includes('note_owner/att-md.md'), false);

  const word = await callRoute(route, '/api/v1/app/attachments/att-docx/preview');
  assert.equal(word.status, 200);
  assert.equal(word.json.name, 'contract.docx');
  assert.equal(word.json.text, 'Word preview body');
  assert.equal(word.json.truncated, false);

  const hidden = await callRoute(route, '/api/v1/app/attachments/att-other/preview');
  assert.equal(hidden.status, 404);
  assert.equal(hidden.json.error, 'ATTACHMENT_NOT_FOUND');
});

test('Note app uses Hermes viewer shells for in-app MD, Word, and PDF preview', () => {
  const app = fs.readFileSync(path.join(process.cwd(), 'public', 'app.js'), 'utf8');
  const fileViewer = fs.readFileSync(path.join(process.cwd(), 'public', 'file-viewer.html'), 'utf8');
  const markdownViewer = fs.readFileSync(path.join(process.cwd(), 'public', 'markdown-viewer.html'), 'utf8');
  const pdfViewer = fs.readFileSync(path.join(process.cwd(), 'public', 'pdf-viewer.html'), 'utf8');

  assert.match(app, /function attachmentViewerUrl\(attachment, info\)/);
  assert.match(app, /query\.set\('preview', attachment\.previewUrl\)/);
  assert.match(app, /query\.set\('viewer_v', '20260604-proxy-preview-v3'\)/);
  assert.match(app, /\? 'pdf-viewer\.html'/);
  assert.match(app, /\? 'markdown-viewer\.html'/);
  assert.match(app, /: 'file-viewer\.html'/);
  assert.doesNotMatch(app, /\? '\/pdf-viewer\.html'/);
  assert.doesNotMatch(app, /\? '\/markdown-viewer\.html'/);
  assert.doesNotMatch(app, /: '\/file-viewer\.html'/);
  assert.match(app, /TaskDocumentPreviewUi/);
  assert.match(fileViewer, /const previewSrc = params\.get\("preview"\)/);
  assert.match(fileViewer, /function proxyPrefixForCurrentViewer\(\)/);
  assert.match(fileViewer, /url\.pathname\.startsWith\("\/api\/v1\/app\/"\)/);
  assert.match(fileViewer, /return `\$\{proxyPrefix\}\$\{path\}`/);
  assert.match(fileViewer, /<script src="fixed-viewport\.js/);
  assert.match(fileViewer, /<script src="markdown-renderer-client\.js/);
  assert.match(fileViewer, /\.\*\\\/api\\\/v1\\\/app\\\/attachments/);
  assert.match(markdownViewer, /const previewSrc = params\.get\("preview"\)/);
  assert.match(markdownViewer, /function proxyPrefixForCurrentViewer\(\)/);
  assert.match(markdownViewer, /url\.pathname\.startsWith\("\/api\/v1\/app\/"\)/);
  assert.match(markdownViewer, /return `\$\{proxyPrefix\}\$\{path\}`/);
  assert.match(markdownViewer, /<script src="fixed-viewport\.js/);
  assert.match(markdownViewer, /<script src="markdown-renderer-client\.js/);
  assert.match(markdownViewer, /\.\*\\\/api\\\/v1\\\/app\\\/attachments/);
  assert.match(markdownViewer, /renderMarkdownDocument/);
  assert.match(pdfViewer, /function proxyPrefixForCurrentViewer\(\)/);
  assert.match(pdfViewer, /url\.pathname\.startsWith\("\/api\/v1\/app\/"\)/);
  assert.match(pdfViewer, /<script src="fixed-viewport\.js/);
  assert.match(pdfViewer, /\.\/vendor\/pdfjs\/pdf\.min\.js/);
  assert.match(pdfViewer, /new Uint8Array\(buffer\)/);
  assert.match(pdfViewer, /const options = \{ data: await preparePdfBytes\(\), disableWorker: isAndroid \}/);
  assert.match(pdfViewer, /pdfjsLib\.getDocument\(options\)\.promise/);
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
    headers: response.headers,
    json: response.body ? JSON.parse(response.body) : null
  };
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
    note.id,
    'fixture body',
    'inbox',
    '[]',
    '[]',
    0,
    'active',
    '2026-06-04T00:00:00.000Z',
    '2026-06-04T00:00:00.000Z'
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
    attachment.name,
    'document',
    attachment.size,
    JSON.stringify({ storageKey: attachment.storageKey, mime: attachment.mime }),
    '2026-06-04T00:00:00.000Z'
  );
}

function writeAttachment(root, storageKey, content) {
  const filePath = path.resolve(root, ...storageKey.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function createMinimalDocxBuffer(text) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p></w:body></w:document>`;
  return zipSingleFile('word/document.xml', Buffer.from(xml, 'utf8'));
}

function zipSingleFile(name, data) {
  const nameBuffer = Buffer.from(name, 'utf8');
  const dataBuffer = Buffer.from(data);
  const flags = 0x0800;
  const method = 0;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(flags, 6);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(0, 14);
  local.writeUInt32LE(dataBuffer.length, 18);
  local.writeUInt32LE(dataBuffer.length, 22);
  local.writeUInt16LE(nameBuffer.length, 26);

  const centralOffset = local.length + nameBuffer.length + dataBuffer.length;
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(flags, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(dataBuffer.length, 20);
  central.writeUInt32LE(dataBuffer.length, 24);
  central.writeUInt16LE(nameBuffer.length, 28);

  const centralSize = central.length + nameBuffer.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, nameBuffer, dataBuffer, central, nameBuffer, eocd]);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
