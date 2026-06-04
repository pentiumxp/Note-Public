'use strict';

const { createNoteService } = require('../services/note-service');
const { materializeMcpAttachments, recordMcpAttachmentAssets } = require('../services/mcp-attachment-service');
const { createSqliteNoteStore } = require('../stores/sqlite-note-store');

function createHermesPluginRoutes({ pluginService, db, idGenerator, clock, appWorkspaceId, requireAppLaunchToken = false, attachmentRoot, attachmentStore = null }) {
  return async function route(request, response, context) {
    if (request.method === 'GET' && context.pathname === '/api/v1/app/workspace') {
      return withAppWorkspace(request, response, context, (appContext) => {
        return sendJson(response, 200, getAppWorkspaceSnapshot(db, appContext.workspaceId, appContext));
      });
    }

    const appNoteMatch = /^\/api\/v1\/app\/notes\/([^/]+)$/.exec(context.pathname);
    if (appNoteMatch && request.method === 'GET') {
      return withAppWorkspace(request, response, context, (appContext) => {
        const note = getAppNote(db, appContext.workspaceId, decodeURIComponent(appNoteMatch[1]), appContext);
        return note ? sendJson(response, 200, { note }) : sendJson(response, 404, { ok: false, error: 'NOTE_NOT_FOUND' });
      });
    }

    if (appNoteMatch && request.method === 'DELETE') {
      return withAppWorkspace(request, response, context, (appContext) => {
        const deleted = deleteAppNote(db, appContext.workspaceId, decodeURIComponent(appNoteMatch[1]));
        return deleted ? sendJson(response, 200, { ok: true, id: deleted.id, deleted: true }) : sendJson(response, 404, { ok: false, error: 'NOTE_NOT_FOUND' });
      });
    }

    const appAttachmentThumbnailMatch = /^\/api\/v1\/app\/attachments\/([^/]+)\/thumbnail$/.exec(context.pathname);
    if (appAttachmentThumbnailMatch && request.method === 'GET') {
      return withAppWorkspace(request, response, context, (appContext) => {
        return sendAppAttachment(response, db, appContext.workspaceId, decodeURIComponent(appAttachmentThumbnailMatch[1]), { thumbnail: true });
      });
    }

    const appAttachmentPreviewMatch = /^\/api\/v1\/app\/attachments\/([^/]+)\/preview$/.exec(context.pathname);
    if (appAttachmentPreviewMatch && request.method === 'GET') {
      return withAppWorkspace(request, response, context, (appContext) => {
        return sendAppAttachmentPreview(response, db, appContext.workspaceId, decodeURIComponent(appAttachmentPreviewMatch[1]));
      });
    }

    const appAttachmentMatch = /^\/api\/v1\/app\/attachments\/([^/]+)$/.exec(context.pathname);
    if (appAttachmentMatch && request.method === 'GET') {
      return withAppWorkspace(request, response, context, (appContext) => {
        return sendAppAttachment(response, db, appContext.workspaceId, decodeURIComponent(appAttachmentMatch[1]));
      });
    }

    if (request.method === 'GET' && context.pathname === '/api/v1/hermes/plugin/manifest') {
      return sendJson(response, 200, await pluginService.getManifest());
    }

    if (request.method === 'POST' && context.pathname === '/api/v1/hermes/plugin/workspaces') {
      return handleJson(response, async () => {
        return pluginService.provisionWorkspace({
          authorization: request.headers.authorization,
          body: await readJson(request)
        });
      });
    }

    if (request.method === 'POST' && context.pathname === '/api/v1/hermes/plugin/launch') {
      return handleJson(response, async () => {
        return pluginService.launchWorkspace({
          authorization: request.headers.authorization,
          body: await readJson(request)
        });
      });
    }

    if (context.pathname === '/api/v1/notes/search' && request.method === 'GET') {
      return withWorkspace(request, response, pluginService, db, async (service) => {
        const limit = boundedLimit(context.url.searchParams.get('limit'));
        const query = context.url.searchParams.get('query') || '';
        const notes = await service.searchNotes(query);
        sendJson(response, 200, { notes: notes.slice(0, limit).map(noteSummary) });
      });
    }

    if (context.pathname === '/api/v1/notes/recent' && request.method === 'GET') {
      return withWorkspace(request, response, pluginService, db, async (service) => {
        const limit = boundedLimit(context.url.searchParams.get('limit'));
        const notes = await service.listNotes();
        sendJson(response, 200, { notes: notes.slice(0, limit).map(noteSummary) });
      });
    }

    if (context.pathname === '/api/v1/notes/tags' && request.method === 'GET') {
      return withWorkspace(request, response, pluginService, db, async (service) => {
        const notes = await service.listNotes();
        const tags = new Set();
        for (const note of notes) {
          for (const tag of note.tags || []) {
            tags.add(tag);
          }
        }
        sendJson(response, 200, { tags: [...tags].sort() });
      });
    }

    const noteMatch = /^\/api\/v1\/notes\/([^/]+)$/.exec(context.pathname);
    if (noteMatch && request.method === 'GET') {
      return withWorkspace(request, response, pluginService, db, async (service) => {
        sendJson(response, 200, { note: noteDetail(await service.getNote(decodeURIComponent(noteMatch[1]))) });
      });
    }

    if (context.pathname === '/api/v1/notes' && request.method === 'POST') {
      return withWorkspace(request, response, pluginService, db, async (service, workspace) => {
        const body = await readJson(request);
        let note = await service.createNote({
          title: body.title,
          body: body.body || '',
          tags: body.tags || [],
          notebookId: body.notebookId || 'inbox'
        });
        try {
          const attachments = materializeMcpAttachments(body.attachments, {
            workspaceId: workspace.workspace_id,
            noteId: note.id,
            attachmentRoot,
            idGenerator,
            clock
          });
          if (attachments.length) {
            note = await service.updateNote(note.id, { attachments });
            recordMcpAttachmentAssets(attachments, {
              workspaceId: workspace.workspace_id,
              noteId: note.id,
              attachmentStore
            });
          }
        } catch (error) {
          await service.deleteNote(note.id).catch(() => {});
          throw error;
        }
        sendJson(response, 201, { note: noteSummary(note) });
      });
    }

    if (noteMatch && request.method === 'PATCH') {
      return withWorkspace(request, response, pluginService, db, async (service, workspace) => {
        const noteId = decodeURIComponent(noteMatch[1]);
        const patch = await readJson(request);
        let newAttachments = [];
        if (Object.prototype.hasOwnProperty.call(patch, 'attachments')) {
          const existing = await service.getNote(noteId);
          const attachments = materializeMcpAttachments(patch.attachments, {
            workspaceId: workspace.workspace_id,
            noteId,
            attachmentRoot,
            idGenerator,
            clock
          });
          patch.attachments = [...(existing.attachments || []), ...attachments];
          newAttachments = attachments;
        }
        const note = await service.updateNote(noteId, patch);
        if (newAttachments.length) {
          recordMcpAttachmentAssets(newAttachments, {
            workspaceId: workspace.workspace_id,
            noteId,
            attachmentStore
          });
        }
        sendJson(response, 200, { note: noteSummary(note) });
      });
    }

    if (noteMatch && request.method === 'DELETE') {
      return withWorkspace(request, response, pluginService, db, async (service) => {
        sendJson(response, 200, await service.deleteNote(decodeURIComponent(noteMatch[1])));
      });
    }

    return false;
  };

  function makeNoteService(workspaceId) {
    return createNoteService({
      store: createSqliteNoteStore({ db, workspaceId }),
      idGenerator,
      clock
    });
  }

  async function withWorkspace(request, response, service, database, handler) {
    try {
      const workspaceId = String(request.headers['x-note-workspace-id'] || '');
      const workspace = await service.verifyWorkspaceKey({
        workspaceId,
        authorization: request.headers.authorization
      });
      await handler(makeNoteService(workspace.workspace_id), workspace);
      return true;
    } catch (error) {
      return sendError(response, error);
    }
  }

  async function withAppWorkspace(request, response, context, handler) {
    try {
      const appContext = await resolveAppWorkspaceContext(request, context.url);
      return await handler(appContext);
    } catch (error) {
      return sendError(response, error);
    }
  }

  async function resolveAppWorkspaceContext(request, url) {
    const launchToken = appLaunchToken(request, url);
    if (launchToken) {
      const launch = await pluginService.verifyLaunchToken(launchToken);
      return {
        workspaceId: launch.workspace_id,
        launchToken
      };
    }
    if (requireAppLaunchToken) {
      throw routeError('permission_denied', 'Launch token is required for app workspace access', 403);
    }
    return {
      workspaceId: appWorkspaceId || 'note:yinxiang_import',
      launchToken: ''
    };
  }
}

function appLaunchToken(request, url) {
  const headerToken = String(request.headers['x-note-launch-token'] || '').trim();
  if (headerToken) {
    return headerToken;
  }
  return String(url.searchParams.get('launch') || '').trim();
}

function getAppWorkspaceSnapshot(db, workspaceId, options = {}) {
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
  `).all(workspaceId);
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
    notebooks,
    notes,
    counts: {
      notes: notes.length,
      attachments: notes.reduce((total, note) => total + note.attachmentCount, 0)
    }
  };
}

function getAppNote(db, workspaceId, noteId, options = {}) {
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

function deleteAppNote(db, workspaceId, noteId) {
  const now = new Date().toISOString();
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

function normalizeImportedBody(body, attachments = []) {
  const inlineBody = renderInlineMedia(body, attachments);
  if (containsEncryptedPayload(body)) {
    const imageGallery = renderImageGallery(attachments);
    const placeholder = '<p class="import-placeholder">这条 .notes 笔记的正文是印象笔记专有的 base64:aes 加密块，当前只能显示标题和附件；正文需要从已登录客户端的解密缓存或其他开放格式重新导入。</p>';
    if (imageGallery) {
      return `${placeholder}${imageGallery}`;
    }
    return placeholder;
  }
  const cleaned = inlineBody
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<en-crypt\b[^>]*>[\s\S]*?<\/en-crypt>/gi, '<div class="import-placeholder">印象笔记加密内容</div>')
    .replace(/<\/?en-note\b[^>]*>/gi, '')
    .replace(base64BlockPattern(), '')
    .trim();
  if (readableText(cleaned).length > 0 && !isBase64OnlyText(readableText(cleaned))) {
    return cleaned;
  }
  if (attachments.length > 0) {
    const imageGallery = renderImageGallery(attachments);
    if (imageGallery) {
      return imageGallery;
    }
    return '<p class="import-placeholder">这条导入笔记主要由附件组成，内容已保留在附件区。</p>';
  }
  return '<p class="import-placeholder">这条导入笔记包含印象笔记的加密或二进制内容，当前无法直接显示正文。</p>';
}

function readableText(body, attachments = []) {
  if (containsEncryptedPayload(body)) {
    if (attachments.length > 0) {
      return `附件笔记 · ${attachments.length} 个附件`;
    }
    return '加密内容';
  }
  const text = normalizeImportedBodyForText(body)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text && !isBase64OnlyText(text)) {
    return text;
  }
  if (attachments.length > 0) {
    return `附件笔记 · ${attachments.length} 个附件`;
  }
  return '导入笔记';
}

function normalizeImportedBodyForText(body) {
  return String(body || '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<en-media\b[^>]*>/gi, ' 附件 ')
    .replace(/<en-crypt\b[^>]*>[\s\S]*?<\/en-crypt>/gi, ' 加密内容 ')
    .replace(/<\/?en-note\b[^>]*>/gi, '')
    .replace(base64BlockPattern(), ' ')
    .trim();
}

function renderInlineMedia(body, attachments) {
  const byHash = new Map();
  for (const attachment of attachments || []) {
    if (attachment.resourceHash) {
      byHash.set(String(attachment.resourceHash).toLowerCase(), attachment);
    }
  }
  return String(body || '').replace(/<en-media\b([^>]*)>/gi, (match, attrs) => {
    const hash = extractAttribute(attrs, 'hash').toLowerCase();
    const attachment = hash ? byHash.get(hash) : null;
    if (attachment && attachment.kind === 'image' && attachment.url) {
      return inlineImageMarkup(attachment);
    }
    if (attachment) {
      return `<div class="import-placeholder">附件：${escapeHtml(attachment.name)}</div>`;
    }
    return '<div class="import-placeholder">附件已保留在附件区</div>';
  });
}

function renderImageGallery(attachments) {
  const images = (attachments || []).filter((attachment) => attachment.kind === 'image' && attachment.url);
  if (!images.length) {
    return '';
  }
  return `<div class="inline-image-grid">${images.map(inlineImageMarkup).join('')}</div>`;
}

function inlineImageMarkup(attachment) {
  const previewUrl = attachment.thumbnailUrl || attachment.url;
  return `
    <button type="button" class="inline-image-thumb" data-image-url="${escapeHtml(attachment.url)}" data-image-name="${escapeHtml(attachment.name)}">
      <img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(attachment.name)}">
    </button>
  `;
}

function extractAttribute(attrs, name) {
  const pattern = new RegExp(`${name}=["']([^"']+)["']`, 'i');
  const match = pattern.exec(String(attrs || ''));
  return match ? match[1] : '';
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function base64BlockPattern() {
  return /(?:[A-Za-z0-9+/=]{40,}\s*){2,}|RU5D[A-Za-z0-9+/=\s]{40,}/g;
}

function containsEncryptedPayload(value) {
  return /RU5D|(?:[A-Za-z0-9+/=]{40,}\s*){2,}/.test(String(value || ''));
}

function isBase64OnlyText(value) {
  const text = String(value || '').replace(/\s+/g, '');
  if (text.length >= 12 && /^[A-Za-z0-9+/=]+$/.test(text) && /[+/=]/.test(text)) {
    return true;
  }
  return text.length >= 24
    && /^[A-Za-z0-9]+$/.test(text)
    && /[a-z]/.test(text)
    && /[A-Z]/.test(text)
    && /\d/.test(text);
}

function sendAppAttachment(response, db, workspaceId, attachmentId, options = {}) {
  const resolved = resolveAppAttachment(db, workspaceId, attachmentId, options);
  if (!resolved.row) {
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false, error: 'ATTACHMENT_NOT_FOUND' }));
    return true;
  }
  if (!resolved.ok) {
    response.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false, error: 'ATTACHMENT_FORBIDDEN' }));
    return true;
  }
  const fs = require('node:fs');
  fs.readFile(resolved.filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: false, error: 'ATTACHMENT_FILE_NOT_FOUND' }));
      return;
    }
    response.writeHead(200, {
      'Content-Type': options.thumbnail ? (resolved.metadata.thumbnailMime || 'image/jpeg') : (resolved.metadata.mime || 'application/octet-stream'),
      'Cache-Control': options.thumbnail ? 'private, max-age=86400' : 'private, max-age=300'
    });
    response.end(content);
  });
  return true;
}

function sendAppAttachmentPreview(response, db, workspaceId, attachmentId) {
  const resolved = resolveAppAttachment(db, workspaceId, attachmentId);
  if (!resolved.row) {
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false, error: 'ATTACHMENT_NOT_FOUND' }));
    return true;
  }
  if (!resolved.ok) {
    response.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false, error: 'ATTACHMENT_FORBIDDEN' }));
    return true;
  }
  if (!/\.docx$/i.test(resolved.filePath)) {
    response.writeHead(415, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false, error: 'ATTACHMENT_PREVIEW_UNSUPPORTED' }));
    return true;
  }
  const html = renderDocxPreview(resolved.filePath);
  if (!html) {
    response.writeHead(422, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false, error: 'ATTACHMENT_PREVIEW_FAILED' }));
    return true;
  }
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'private, max-age=300',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(html);
  return true;
}

function renderDocxPreview(filePath) {
  const { spawnSync } = require('node:child_process');
  const path = require('node:path');
  const pythonScript = path.join(process.cwd(), 'scripts', 'render-docx-preview.py');
  const powershellScript = path.join(process.cwd(), 'scripts', 'render-docx-preview.ps1');
  const candidates = [
    { command: 'python3', args: [pythonScript, filePath] },
    { command: 'python', args: [pythonScript, filePath] },
    { command: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', powershellScript, '-InputPath', filePath] }
  ];
  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, candidate.args, {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024
    });
    if (result.status === 0 && result.stdout) {
      return result.stdout;
    }
  }
  return '';
}

function resolveAppAttachment(db, workspaceId, attachmentId, options = {}) {
  const row = db.prepare(`
    select metadata_json
    from attachments
    where workspace_id = ? and id = ?
  `).get(workspaceId, attachmentId);
  if (!row) {
    return { row: null, ok: false };
  }
  const metadata = safeJson(row.metadata_json, {});
  const storageKey = options.thumbnail ? String(metadata.thumbnailStorageKey || '') : String(metadata.storageKey || '');
  const rootName = options.thumbnail ? 'thumbnails' : 'attachments';
  const path = require('node:path');
  const root = path.resolve(process.cwd(), 'data', rootName);
  const filePath = path.resolve(root, ...storageKey.split('/'));
  return {
    row,
    metadata,
    storageKey,
    root,
    filePath,
    ok: Boolean(storageKey && filePath.startsWith(root))
  };
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function handleJson(response, action) {
  try {
    return sendJson(response, 200, await action());
  } catch (error) {
    return sendError(response, error);
  }
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    const error = new Error('Invalid JSON body');
    error.code = 'invalid_json';
    error.status = 400;
    throw error;
  }
}

function noteSummary(note) {
  const snippet = String(note.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  return {
    id: note.id,
    title: note.title,
    snippet,
    tags: note.tags || [],
    updatedAt: note.updatedAt,
    createdAt: note.createdAt,
    attachmentCount: (note.attachments || []).length
  };
}

function noteDetail(note) {
  return {
    ...noteSummary(note),
    body: note.body || '',
    notebookId: note.notebookId || 'inbox',
    attachments: (note.attachments || []).map(mcpAttachmentSummary)
  };
}

function mcpAttachmentSummary(attachment) {
  const metadata = attachment.metadata || {};
  return {
    id: attachment.id,
    name: attachment.name,
    kind: attachment.kind || 'file',
    size: Number(attachment.size || metadata.size || 0),
    mime: metadata.mime || '',
    createdAt: attachment.createdAt || null,
    available: Boolean(metadata.storageKey && !metadata.missingFile)
  };
}

function boundedLimit(value) {
  const parsed = Number(value || 20);
  if (!Number.isFinite(parsed)) {
    return 20;
  }
  return Math.max(1, Math.min(50, Math.floor(parsed)));
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
  return true;
}

function sendError(response, error) {
  const code = error.code || 'workspace_registration_failed';
  const status = error.status || 500;
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ ok: false, error: code }));
  return true;
}

function routeError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

module.exports = {
  createHermesPluginRoutes,
  noteSummary,
  readJson
};
