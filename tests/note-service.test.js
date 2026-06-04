'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createNoteService } = require('../src/services/note-service');
const { createMemoryNoteStore } = require('../src/stores/memory-note-store');

function createSubject() {
  let id = 0;
  return createNoteService({
    store: createMemoryNoteStore(),
    idGenerator: () => `note_${++id}`,
    clock: () => '2026-06-02T00:00:00.000Z'
  });
}

test('creates and reads a note', async () => {
  const service = createSubject();
  const note = await service.createNote({
    title: ' First note ',
    body: 'Synthetic note body',
    tags: ['work', 'work', 'idea']
  });

  assert.equal(note.id, 'note_1');
  assert.equal(note.title, 'First note');
  assert.equal(note.notebookId, 'inbox');
  assert.deepEqual(note.tags, ['work', 'idea']);
  assert.deepEqual(note.tasks, []);
  assert.deepEqual(note.attachments, []);
  assert.deepEqual(await service.getNote(note.id), note);
});

test('updates allowed fields without changing stable identity', async () => {
  const service = createSubject();
  const note = await service.createNote({ title: 'Draft', body: 'Synthetic body' });

  const updated = await service.updateNote(note.id, { title: 'Final', tags: ['done'] });

  assert.equal(updated.id, note.id);
  assert.equal(updated.createdAt, note.createdAt);
  assert.equal(updated.title, 'Final');
  assert.deepEqual(updated.tags, ['done']);
});

test('searches title and body', async () => {
  const service = createSubject();
  await service.createNote({ title: 'Inbox', body: 'Synthetic body' });
  await service.createNote({ title: 'Archive', body: 'Contains searchable marker' });

  const matches = await service.searchNotes('marker');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].title, 'Archive');
});

test('rejects invalid notes with bounded error code', async () => {
  const service = createSubject();

  await assert.rejects(
    () => service.createNote({ title: '', body: 'Synthetic body' }),
    { code: 'NOTE_VALIDATION_FAILED' }
  );
});

test('deletes notes', async () => {
  const service = createSubject();
  const note = await service.createNote({ title: 'Disposable', body: 'Synthetic body' });

  assert.deepEqual(await service.deleteNote(note.id), { id: note.id, deleted: true });
  await assert.rejects(() => service.getNote(note.id), { code: 'NOTE_NOT_FOUND' });
});

test('organizes notes with notebook, shortcut, and trash status', async () => {
  const service = createSubject();
  const note = await service.createNote({ title: 'Project', body: 'Synthetic body', notebookId: 'work' });

  const shortcut = await service.toggleShortcut(note.id, true);
  const trashed = await service.updateNote(note.id, { status: 'trash' });

  assert.equal(shortcut.shortcut, true);
  assert.equal(trashed.notebookId, 'work');
  assert.equal(trashed.status, 'trash');
});

test('adds and completes note tasks', async () => {
  const service = createSubject();
  const note = await service.createNote({ title: 'Task note', body: 'Synthetic body' });

  const task = await service.addTask(note.id, { text: 'Review capture flow' });
  const updated = await service.updateTask(note.id, task.id, { done: true });

  assert.equal(task.text, 'Review capture flow');
  assert.equal(updated.tasks[0].done, true);
  assert.equal(updated.tasks[0].completedAt, '2026-06-02T00:00:00.000Z');
});

test('adds attachment metadata without file content', async () => {
  const service = createSubject();
  const note = await service.createNote({ title: 'Attachment note', body: 'Synthetic body' });

  const attachment = await service.addAttachment(note.id, { name: 'scan.pdf', kind: 'document', size: 128 });
  const saved = await service.getNote(note.id);

  assert.deepEqual(attachment, {
    id: 'note_2',
    name: 'scan.pdf',
    kind: 'document',
    size: 128,
    createdAt: '2026-06-02T00:00:00.000Z'
  });
  assert.equal(saved.attachments[0].name, 'scan.pdf');
});

test('preserves bounded attachment metadata on create and update', async () => {
  const service = createSubject();
  const note = await service.createNote({
    title: 'Attachment metadata',
    body: 'Synthetic body',
    attachments: [{
      id: 'att_a',
      name: 'receipt.png',
      kind: 'image',
      size: 42,
      metadata: {
        mime: 'image/png',
        storageKey: 'note_owner/ab/hash.png',
        sha256: 'abc123',
        data_base64: 'must-not-persist'
      },
      createdAt: '2026-06-01T00:00:00.000Z'
    }]
  });

  assert.equal(note.attachments[0].metadata.mime, 'image/png');
  assert.equal(note.attachments[0].metadata.storageKey, 'note_owner/ab/hash.png');
  assert.equal(note.attachments[0].metadata.data_base64, undefined);

  const updated = await service.updateNote(note.id, {
    attachments: [...note.attachments, {
      id: 'att_b',
      name: 'doc.docx',
      kind: 'document',
      metadata: {
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        missingFile: true,
        path: 'must-not-persist'
      }
    }]
  });

  assert.equal(updated.attachments.length, 2);
  assert.equal(updated.attachments[1].metadata.missingFile, true);
  assert.equal(updated.attachments[1].metadata.path, undefined);
});
