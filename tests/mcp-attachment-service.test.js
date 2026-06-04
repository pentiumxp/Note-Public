'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { materializeMcpAttachments } = require('../src/services/mcp-attachment-service');

test('materializes MCP base64 attachments into safe content-addressed storage', () => {
  const attachmentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'note-mcp-attachments-'));
  const savedAssets = [];
  const payload = Buffer.from('small attachment payload', 'utf8');
  const sha256 = crypto.createHash('sha256').update(payload).digest('hex');

  const attachments = materializeMcpAttachments([{
    name: 'receipt.png',
    mime: 'image/png',
    data_base64: payload.toString('base64')
  }], {
    workspaceId: 'note:owner',
    noteId: 'note_1',
    attachmentRoot,
    attachmentStore: { saveAsset: (asset) => savedAssets.push(asset) },
    idGenerator: () => 'fixed-id',
    clock: () => '2026-06-04T00:00:00.000Z'
  });

  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].id, 'att_fixed-id');
  assert.equal(attachments[0].kind, 'image');
  assert.equal(attachments[0].size, payload.length);
  assert.equal(attachments[0].metadata.mime, 'image/png');
  assert.equal(attachments[0].metadata.sha256, sha256);
  assert.equal(attachments[0].metadata.data_base64, undefined);

  const storageKey = attachments[0].metadata.storageKey;
  assert.match(storageKey, /^note_owner\/[a-f0-9]{2}\/[a-f0-9]{64}\.png$/);
  const savedPath = path.resolve(attachmentRoot, ...storageKey.split('/'));
  assert.equal(fs.readFileSync(savedPath, 'utf8'), 'small attachment payload');

  assert.equal(savedAssets.length, 1);
  assert.equal(savedAssets[0].workspaceId, 'note:owner');
  assert.equal(savedAssets[0].noteId, 'note_1');
  assert.equal(savedAssets[0].storageKey, storageKey);
});

test('rejects unsafe MCP attachment fields and oversized batches', () => {
  const attachmentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'note-mcp-attachments-'));

  assert.throws(
    () => materializeMcpAttachments([{ name: 'secret.txt', path: 'C:/secret.txt' }], {
      workspaceId: 'note:owner',
      noteId: 'note_1',
      attachmentRoot
    }),
    { code: 'NOTE_ATTACHMENT_FIELD_FORBIDDEN' }
  );

  assert.throws(
    () => materializeMcpAttachments(Array.from({ length: 9 }, (_, index) => ({ name: `file-${index}.txt` })), {
      workspaceId: 'note:owner',
      noteId: 'note_1',
      attachmentRoot
    }),
    { code: 'NOTE_ATTACHMENT_TOO_MANY' }
  );
});
