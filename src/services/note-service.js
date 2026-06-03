'use strict';

function createNoteService({ store, idGenerator, clock }) {
  if (!store) {
    throw new Error('store is required');
  }

  const nextId = idGenerator || (() => `note_${Date.now()}`);
  const now = clock || (() => new Date().toISOString());

  async function createNote(input) {
    const noteInput = normalizeInput(input, { requireBody: true });
    const timestamp = now();
    const note = {
      id: nextId(),
      title: noteInput.title,
      body: noteInput.body,
      notebookId: noteInput.notebookId,
      tags: noteInput.tags,
      tasks: noteInput.tasks,
      attachments: noteInput.attachments,
      shortcut: Boolean(input.shortcut),
      reminderAt: input.reminderAt || null,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await store.save(note);
    return note;
  }

  async function listNotes() {
    return store.list();
  }

  async function getNote(id) {
    requireId(id);
    const note = await store.get(id);
    if (!note) {
      throw serviceError('NOTE_NOT_FOUND', 'Note not found');
    }
    return note;
  }

  async function updateNote(id, patch) {
    requireId(id);
    const existing = await getNote(id);
    const normalized = normalizePatch(patch);
    const updated = {
      ...existing,
      ...normalized,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now()
    };
    await store.save(updated);
    return updated;
  }

  async function deleteNote(id) {
    requireId(id);
    const existing = await getNote(id);
    await store.remove(existing.id);
    return { id: existing.id, deleted: true };
  }

  async function searchNotes(query) {
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) {
      return [];
    }
    const notes = await store.list();
    return notes.filter((note) => {
      return note.title.toLowerCase().includes(needle) || note.body.toLowerCase().includes(needle);
    });
  }

  async function toggleShortcut(id, shortcut) {
    requireId(id);
    return updateNote(id, { shortcut: Boolean(shortcut) });
  }

  async function addTask(id, taskInput) {
    requireId(id);
    const existing = await getNote(id);
    const text = String(taskInput?.text || '').trim();
    if (!text) {
      throw serviceError('NOTE_VALIDATION_FAILED', 'Task text is required');
    }
    const task = {
      id: taskInput.id || nextId(),
      text,
      done: false,
      createdAt: now(),
      completedAt: null
    };
    const updated = {
      ...existing,
      tasks: [...(existing.tasks || []), task],
      updatedAt: now()
    };
    await store.save(updated);
    return task;
  }

  async function updateTask(id, taskId, patch) {
    requireId(id);
    requireId(taskId);
    const existing = await getNote(id);
    let found = false;
    const updatedTasks = (existing.tasks || []).map((task) => {
      if (task.id !== taskId) {
        return task;
      }
      found = true;
      const nextTask = { ...task };
      if (Object.prototype.hasOwnProperty.call(patch || {}, 'text')) {
        const text = String(patch.text || '').trim();
        if (!text) {
          throw serviceError('NOTE_VALIDATION_FAILED', 'Task text is required');
        }
        nextTask.text = text;
      }
      if (Object.prototype.hasOwnProperty.call(patch || {}, 'done')) {
        nextTask.done = Boolean(patch.done);
        nextTask.completedAt = nextTask.done ? now() : null;
      }
      return nextTask;
    });
    if (!found) {
      throw serviceError('NOTE_TASK_NOT_FOUND', 'Task not found');
    }
    const updated = { ...existing, tasks: updatedTasks, updatedAt: now() };
    await store.save(updated);
    return updated;
  }

  async function addAttachment(id, attachmentInput) {
    requireId(id);
    const existing = await getNote(id);
    const name = String(attachmentInput?.name || '').trim();
    if (!name) {
      throw serviceError('NOTE_VALIDATION_FAILED', 'Attachment name is required');
    }
    const attachment = {
      id: attachmentInput.id || nextId(),
      name,
      kind: attachmentInput.kind || 'file',
      size: Number(attachmentInput.size || 0),
      createdAt: now()
    };
    const updated = {
      ...existing,
      attachments: [...(existing.attachments || []), attachment],
      updatedAt: now()
    };
    await store.save(updated);
    return attachment;
  }

  return {
    createNote,
    listNotes,
    getNote,
    updateNote,
    deleteNote,
    searchNotes,
    toggleShortcut,
    addTask,
    updateTask,
    addAttachment
  };
}

function normalizeInput(input, options = {}) {
  if (!input || typeof input !== 'object') {
    throw serviceError('NOTE_VALIDATION_FAILED', 'Note input is required');
  }
  const title = String(input.title || '').trim();
  if (!title) {
    throw serviceError('NOTE_VALIDATION_FAILED', 'Note title is required');
  }
  const body = String(input.body || '');
  if (options.requireBody && !body.trim()) {
    throw serviceError('NOTE_VALIDATION_FAILED', 'Note body is required');
  }
  return {
    title,
    body,
    notebookId: String(input.notebookId || 'inbox'),
    tags: normalizeTags(input.tags),
    tasks: normalizeTasks(input.tasks),
    attachments: normalizeAttachments(input.attachments)
  };
}

function normalizePatch(patch) {
  if (!patch || typeof patch !== 'object') {
    throw serviceError('NOTE_VALIDATION_FAILED', 'Patch is required');
  }
  const allowed = {};
  if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
    allowed.title = normalizeInput({ title: patch.title, body: 'x', tags: [] }).title;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'body')) {
    allowed.body = String(patch.body || '');
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'tags')) {
    allowed.tags = normalizeTags(patch.tags);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'notebookId')) {
    allowed.notebookId = String(patch.notebookId || 'inbox');
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'shortcut')) {
    allowed.shortcut = Boolean(patch.shortcut);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'reminderAt')) {
    allowed.reminderAt = patch.reminderAt || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
    const status = String(patch.status || '');
    if (!['active', 'archived', 'trash'].includes(status)) {
      throw serviceError('NOTE_VALIDATION_FAILED', 'Unsupported note status');
    }
    allowed.status = status;
  }
  if (Object.keys(allowed).length === 0) {
    throw serviceError('NOTE_VALIDATION_FAILED', 'Patch has no supported fields');
  }
  return allowed;
}

function normalizeTasks(tasks) {
  if (!Array.isArray(tasks)) {
    return [];
  }
  return tasks.map((task, index) => {
    const text = String(task.text || '').trim();
    if (!text) {
      throw serviceError('NOTE_VALIDATION_FAILED', 'Task text is required');
    }
    return {
      id: task.id || `task_${index + 1}`,
      text,
      done: Boolean(task.done),
      createdAt: task.createdAt || null,
      completedAt: task.completedAt || null
    };
  });
}

function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments)) {
    return [];
  }
  return attachments.map((attachment, index) => {
    const name = String(attachment.name || '').trim();
    if (!name) {
      throw serviceError('NOTE_VALIDATION_FAILED', 'Attachment name is required');
    }
    return {
      id: attachment.id || `att_${index + 1}`,
      name,
      kind: attachment.kind || 'file',
      size: Number(attachment.size || 0)
    };
  });
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }
  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))];
}

function requireId(id) {
  if (!id || typeof id !== 'string') {
    throw serviceError('NOTE_VALIDATION_FAILED', 'Note id is required');
  }
}

function serviceError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

module.exports = {
  createNoteService,
  serviceError
};
