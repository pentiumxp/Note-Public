'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  attachmentKind,
  decodeXml,
  materializeNoteAttachments,
  normalizeYinxiangDate,
  parseNotesExport
} = require('../scripts/import-yinxiang-notes');
const {
  writeAttachmentPayload
} = require('../scripts/import-yinxiang-exb');

test('parses Yinxiang .notes export blocks without exposing real fixture data', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export3.dtd">
<en-export>
  <note>
    <title>Imported &amp; Note</title>
    <content><![CDATA[<?xml version="1.0" encoding="UTF-8"?><en-note><div>body</div></en-note>]]></content>
    <created>20260102T030405Z</created>
    <updated>20260103T040506Z</updated>
    <tag>alpha</tag>
    <tag>alpha</tag>
    <tag>beta</tag>
    <resource>
      <data encoding="base64">QUJDRA==</data>
      <mime>image/png</mime>
      <resource-attributes>
        <file-name>image.png</file-name>
      </resource-attributes>
    </resource>
  </note>
</en-export>`;

  const notes = parseNotesExport(xml, {
    file: 'sample.notes',
    notebookId: 'notebook_sample'
  });

  assert.equal(notes.length, 1);
  assert.equal(notes[0].title, 'Imported & Note');
  assert.equal(notes[0].notebookId, 'notebook_sample');
  assert.equal(notes[0].createdAt, '2026-01-02T03:04:05.000Z');
  assert.equal(notes[0].updatedAt, '2026-01-03T04:05:06.000Z');
  assert.deepEqual(notes[0].tags, ['alpha', 'beta']);
  assert.equal(notes[0].attachments.length, 1);
  assert.equal(notes[0].attachments[0].name, 'image.png');
  assert.equal(notes[0].attachments[0].kind, 'image');
});

test('materializes imported attachment bytes under an internal storage key', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'note-yinxiang-import-'));
  const note = {
    id: 'note_1',
    attachments: [{
      id: 'att_1',
      name: 'photo.png',
      kind: 'image',
      size: 4,
      metadata: { mime: 'image/png' },
      importDataBase64: 'QUJDRA==',
      createdAt: '2026-01-01T00:00:00.000Z'
    }]
  };

  const materialized = materializeNoteAttachments(note, {
    attachmentRoot: root,
    workspaceId: 'note:demo'
  });

  assert.equal(materialized.attachments[0].importDataBase64, undefined);
  assert.equal(materialized.attachments[0].metadata.storageKey, 'note_demo/note_1/att_1.png');
  assert.equal(fs.readFileSync(path.join(root, 'note_demo', 'note_1', 'att_1.png'), 'utf8'), 'ABCD');
});

test('normalizes helper values used by the importer', () => {
  assert.equal(normalizeYinxiangDate('20261231T235959Z'), '2026-12-31T23:59:59.000Z');
  assert.equal(normalizeYinxiangDate('bad'), '');
  assert.equal(decodeXml('&lt;a title=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt;'), '<a title="x">Tom & Jerry</a>');
  assert.equal(attachmentKind('application/pdf'), 'document');
  assert.equal(attachmentKind('video/mp4'), 'file');
});

test('EXB importer writes attachment bytes to content-addressed paths', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'note-exb-attachment-'));
  const written = writeAttachmentPayload({
    attachmentRoot: root,
    workspaceId: 'note:demo',
    mime: 'application/pdf',
    inlineData: Buffer.from('PDF bytes'),
    externalAttachmentRoot: '',
    noteUid: '1',
    hash: 'source'
  });

  assert.ok(written.sha256);
  assert.equal(written.storageKey, `note_demo/${written.sha256.slice(0, 2)}/${written.sha256}.pdf`);
  assert.equal(fs.readFileSync(path.join(root, ...written.storageKey.split('/')), 'utf8'), 'PDF bytes');
});
