'use strict';

const { materializeMcpAttachments, recordMcpAttachmentAssets } = require('../services/mcp-attachment-service');
const { ensureNotebookRecord } = require('../services/app-workspace-service');
const { boundedLimit, readJson, sendJson } = require('./http-utils');

function createNoteApiRoutes({ withWorkspace, db, attachmentRoot, attachmentStore = null, idGenerator, clock }) {
  if (!withWorkspace) {
    throw new Error('withWorkspace is required');
  }
  if (!db) {
    throw new Error('db is required');
  }

  return async function routeNoteApi(request, response, context) {
    if (context.pathname === '/api/v1/notes/search' && request.method === 'GET') {
      return withWorkspace(request, response, async (service) => {
        const limit = boundedLimit(context.url.searchParams.get('limit'));
        const query = context.url.searchParams.get('query') || '';
        const notes = await service.searchNotes(query);
        sendJson(response, 200, { notes: notes.slice(0, limit).map(noteSummary) });
      });
    }

    if (context.pathname === '/api/v1/notes/recent' && request.method === 'GET') {
      return withWorkspace(request, response, async (service) => {
        const limit = boundedLimit(context.url.searchParams.get('limit'));
        const notes = await service.listNotes();
        sendJson(response, 200, { notes: notes.slice(0, limit).map(noteSummary) });
      });
    }

    if (context.pathname === '/api/v1/notes/tags' && request.method === 'GET') {
      return withWorkspace(request, response, async (service) => {
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
      return withWorkspace(request, response, async (service) => {
        sendJson(response, 200, { note: noteDetail(await service.getNote(decodeURIComponent(noteMatch[1]))) });
      });
    }

    if (context.pathname === '/api/v1/notes' && request.method === 'POST') {
      return withWorkspace(request, response, async (service, workspace) => {
        const body = await readJson(request);
        ensureNotebookRecord(db, workspace.workspace_id, body.notebookId || 'inbox', body.notebookName);
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
      return withWorkspace(request, response, async (service, workspace) => {
        const noteId = decodeURIComponent(noteMatch[1]);
        const patch = await readJson(request);
        let newAttachments = [];
        if (Object.prototype.hasOwnProperty.call(patch, 'notebookId')) {
          ensureNotebookRecord(db, workspace.workspace_id, patch.notebookId || 'inbox', patch.notebookName);
        }
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
      return withWorkspace(request, response, async (service) => {
        sendJson(response, 200, await service.deleteNote(decodeURIComponent(noteMatch[1])));
      });
    }

    return false;
  };
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

module.exports = {
  createNoteApiRoutes,
  noteDetail,
  noteSummary
};
