'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { normalizeImportedBody, readableText } = require('./imported-note-render-service');

function createAppWorkspaceService({ db, attachmentRoot, documentPreviewService }) {
  if (!db) {
    throw new Error('db is required');
  }
  if (!documentPreviewService) {
    throw new Error('documentPreviewService is required');
  }

  function getWorkspaceSnapshot(workspaceId, options = {}) {
    const workspace = db.prepare(`
      select workspace_id, hermes_workspace_id, display_name, status
      from plugin_workspaces
      where workspace_id = ?
    `).get(workspaceId) || {
      workspace_id: workspaceId,
      hermes_workspace_id: workspaceId.replace(/^note:/, ''),
      display_name: '笔记',
      status: 'local'
    };
    const notebooks = db.prepare(`
      select b.id, b.name, count(n.id) as noteCount
      from notebooks b
      left join notes n on n.workspace_id = b.workspace_id and n.notebook_id = b.id and n.deleted_at is null
      where b.workspace_id = ?
      group by b.id, b.name
      order by b.name collate nocase
    `).all(workspaceId).map((notebook) => ({
      ...notebook,
      name: notebookDisplayName(notebook.id, notebook.name)
    }));
    const knownNotebookIds = new Set(notebooks.map((notebook) => notebook.id));
    const missingNotebooks = db.prepare(`
      select n.notebook_id as id, count(n.id) as noteCount
      from notes n
      left join notebooks b on b.workspace_id = n.workspace_id and b.id = n.notebook_id
      where n.workspace_id = ? and n.deleted_at is null and b.id is null
      group by n.notebook_id
      order by n.notebook_id collate nocase
    `).all(workspaceId)
      .filter((notebook) => !knownNotebookIds.has(notebook.id))
      .map((notebook) => ({
        ...notebook,
        name: notebookDisplayName(notebook.id)
      }));
    const rows = db.prepare(`
      select id, title, body, notebook_id, tags_json, tasks_json, shortcut, reminder_at, status, created_at, updated_at
      from notes
      where workspace_id = ? and deleted_at is null
      order by updated_at desc
      limit 1000
    `).all(workspaceId);
    const notes = rows.map((row) => appNoteSummary(db, workspaceId, row, options));
    return {
      workspace: {
        id: workspace.workspace_id,
        hermesWorkspaceId: workspace.hermes_workspace_id,
        displayName: workspace.display_name,
        status: workspace.status
      },
      notebooks: [...notebooks, ...missingNotebooks],
      notes,
      counts: {
        notes: notes.length,
        attachments: notes.reduce((total, note) => total + note.attachmentCount, 0)
      }
    };
  }

  function getNote(workspaceId, noteId, options = {}) {
    const row = db.prepare(`
      select id, title, body, notebook_id, tags_json, tasks_json, shortcut, reminder_at, status, created_at, updated_at
      from notes
      where workspace_id = ? and id = ? and deleted_at is null
    `).get(workspaceId, noteId);
    if (!row) {
      return null;
    }
    return appNoteDetail(db, workspaceId, row, options);
  }

  function deleteNote(workspaceId, noteId, clock = () => new Date().toISOString()) {
    const now = clock();
    const result = db.prepare(`
      update notes
      set deleted_at = ?, status = 'trash', updated_at = ?
      where workspace_id = ? and id = ? and deleted_at is null
    `).run(now, now, workspaceId, noteId);
    if (!result.changes) {
      return null;
    }
    return { id: noteId };
  }

  function attachmentContent(workspaceId, attachmentId, options = {}) {
    const resolved = resolveAttachment(workspaceId, attachmentId, options);
    if (!resolved.row) {
      return { status: 404, error: 'ATTACHMENT_NOT_FOUND' };
    }
    if (!resolved.ok) {
      return { status: 403, error: 'ATTACHMENT_FORBIDDEN' };
    }
    try {
      return {
        status: 200,
        content: fs.readFileSync(resolved.filePath),
        mime: options.thumbnail ? (resolved.metadata.thumbnailMime || 'image/jpeg') : (resolved.metadata.mime || 'application/octet-stream'),
        cacheControl: options.thumbnail ? 'private, max-age=86400' : 'private, max-age=300'
      };
    } catch {
      return { status: 404, error: 'ATTACHMENT_FILE_NOT_FOUND' };
    }
  }

  function attachmentPreview(workspaceId, attachmentId) {
    const resolved = resolveAttachment(workspaceId, attachmentId, {});
    if (!resolved.row) {
      return { status: 404, error: 'ATTACHMENT_NOT_FOUND' };
    }
    if (!resolved.ok) {
      return { status: 403, error: 'ATTACHMENT_FORBIDDEN' };
    }

    const name = resolved.row.name || path.basename(resolved.filePath);
    const mime = String(resolved.metadata.mime || '').toLowerCase();
    const ext = path.extname(name || resolved.filePath).toLowerCase();
    const isDocx = ext === '.docx' || mime.includes('officedocument.wordprocessingml');
    const isText = ['.txt', '.md', '.markdown', '.csv', '.json'].includes(ext) || /^text\//i.test(mime);

    if (!isDocx && !isText) {
      return { status: 415, error: 'ATTACHMENT_PREVIEW_UNSUPPORTED' };
    }

    try {
      const preview = isDocx
        ? documentPreviewService.extractDocxText(resolved.filePath)
        : documentPreviewService.textFilePreview(resolved.filePath);
      let size = Number(resolved.row.size || 0);
      if (!size) {
        try {
          size = fs.statSync(resolved.filePath).size;
        } catch {
          size = 0;
        }
      }
      return {
        status: 200,
        payload: {
          name,
          mime: resolved.metadata.mime || '',
          size,
          text: preview.text,
          totalChars: preview.totalChars,
          truncated: preview.truncated
        }
      };
    } catch {
      return { status: 422, error: 'ATTACHMENT_PREVIEW_FAILED' };
    }
  }

  function resolveAttachment(workspaceId, attachmentId, options = {}) {
    const row = db.prepare(`
      select id, name, kind, size, created_at, metadata_json
      from attachments
      where workspace_id = ? and id = ?
    `).get(workspaceId, attachmentId);
    if (!row) {
      return { row: null, ok: false };
    }
    const metadata = safeJson(row.metadata_json, {});
    const storageKey = options.thumbnail ? String(metadata.thumbnailStorageKey || '') : String(metadata.storageKey || '');
    const rootName = options.thumbnail ? 'thumbnails' : 'attachments';
    const root = options.thumbnail
      ? path.resolve(process.cwd(), 'data', rootName)
      : path.resolve(attachmentRoot || path.join(process.cwd(), 'data', rootName));
    const filePath = path.resolve(root, ...storageKey.split('/'));
    return {
      row,
      metadata,
      storageKey,
      root,
      filePath,
      ok: Boolean(storageKey && (filePath === root || filePath.startsWith(`${root}${path.sep}`)))
    };
  }

  return {
    attachmentContent,
    attachmentPreview,
    deleteNote,
    getNote,
    getWorkspaceSnapshot
  };
}

function ensureNotebookRecord(db, workspaceId, notebookId, notebookName = '') {
  const id = normalizeNotebookId(notebookId);
  const name = notebookDisplayName(id, notebookName);
  const now = new Date().toISOString();
  const existing = db.prepare(`
    select id, name
    from notebooks
    where workspace_id = ? and id = ?
  `).get(workspaceId, id);
  if (existing) {
    if (isBrokenNotebookName(existing.name)) {
      db.prepare(`
        update notebooks
        set name = ?, source = coalesce(source, ?), updated_at = ?
        where workspace_id = ? and id = ?
      `).run(name, 'mcp', now, workspaceId, id);
    }
    return;
  }
  db.prepare(`
    insert into notebooks (id, workspace_id, name, source, created_at, updated_at)
    values (?, ?, ?, ?, ?, ?)
  `).run(id, workspaceId, name, 'mcp', now, now);
}

function normalizeNotebookId(value) {
  return String(value || 'inbox').trim() || 'inbox';
}

function notebookDisplayName(id, name = '') {
  const explicit = String(name || '').trim();
  if (explicit && !isBrokenNotebookName(explicit)) {
    return explicit;
  }
  const normalizedId = normalizeNotebookId(id);
  const known = {
    inbox: '收件箱',
    notebook_inbox: '收件箱',
    hermes: 'Hermes Mobile'
  };
  if (known[normalizedId]) {
    return known[normalizedId];
  }
  if (/^notebook_[a-f0-9]+$/i.test(normalizedId)) {
    return '笔记本';
  }
  return normalizedId;
}

function isBrokenNotebookName(value) {
  const text = String(value || '').trim();
  return !text || text === '???' || /^[?]+$/.test(text) || /[绗楃拋閺傞梽濞撮崥妫ｉ幖濡幋韫]/.test(text);
}

function appNoteSummary(db, workspaceId, row, options = {}) {
  const attachments = attachmentSummaries(db, workspaceId, row.id, options);
  const snippet = readableText(row.body, attachments).slice(0, 180);
  return {
    id: row.id,
    title: row.title,
    snippet,
    notebookId: row.notebook_id,
    tags: safeJson(row.tags_json, []),
    tasks: safeJson(row.tasks_json, []),
    shortcut: Boolean(row.shortcut),
    reminderAt: row.reminder_at || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attachmentCount: attachments.length,
    attachments
  };
}

function appNoteDetail(db, workspaceId, row, options = {}) {
  const attachments = attachmentSummaries(db, workspaceId, row.id, options);
  return {
    ...appNoteSummary(db, workspaceId, row, options),
    attachments,
    body: normalizeImportedBody(row.body, attachments)
  };
}

function attachmentSummaries(db, workspaceId, noteId, options = {}) {
  return db.prepare(`
    select id, name, kind, size, metadata_json, created_at
    from attachments
    where workspace_id = ? and note_id = ?
    order by created_at asc
  `).all(workspaceId, noteId).map((row) => {
    const metadata = safeJson(row.metadata_json, {});
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      size: row.size,
      mime: metadata.mime || '',
      resourceHash: metadata.resourceHash || '',
      storageKey: metadata.storageKey || '',
      url: metadata.storageKey ? scopedAppUrl(`/api/v1/app/attachments/${encodeURIComponent(row.id)}`, options) : '',
      thumbnailUrl: metadata.thumbnailStorageKey ? scopedAppUrl(`/api/v1/app/attachments/${encodeURIComponent(row.id)}/thumbnail`, options) : '',
      previewUrl: metadata.storageKey ? scopedAppUrl(`/api/v1/app/attachments/${encodeURIComponent(row.id)}/preview`, options) : '',
      createdAt: row.created_at
    };
  });
}

function scopedAppUrl(pathname, options = {}) {
  const launchToken = String(options.launchToken || '').trim();
  if (!launchToken) {
    return pathname;
  }
  const separator = pathname.includes('?') ? '&' : '?';
  return `${pathname}${separator}launch=${encodeURIComponent(launchToken)}`;
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

module.exports = {
  appNoteSummary,
  createAppWorkspaceService,
  ensureNotebookRecord,
  normalizeImportedBody,
  notebookDisplayName,
  readableText
};
