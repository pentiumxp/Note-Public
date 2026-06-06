'use strict';

const { sendJson } = require('./http-utils');

function createAppWorkspaceRoutes({ appWorkspaceService, withAppWorkspace, clock }) {
  if (!appWorkspaceService) {
    throw new Error('appWorkspaceService is required');
  }
  if (!withAppWorkspace) {
    throw new Error('withAppWorkspace is required');
  }

  return async function routeAppWorkspace(request, response, context) {
    if (request.method === 'GET' && context.pathname === '/api/v1/app/workspace') {
      return withAppWorkspace(request, response, context, (appContext) => {
        return sendJson(response, 200, appWorkspaceService.getWorkspaceSnapshot(appContext.workspaceId, appContext));
      });
    }

    const appNoteMatch = /^\/api\/v1\/app\/notes\/([^/]+)$/.exec(context.pathname);
    if (appNoteMatch && request.method === 'GET') {
      return withAppWorkspace(request, response, context, (appContext) => {
        const note = appWorkspaceService.getNote(appContext.workspaceId, decodeURIComponent(appNoteMatch[1]), appContext);
        return note
          ? sendJson(response, 200, { note })
          : sendJson(response, 404, { ok: false, error: 'NOTE_NOT_FOUND' });
      });
    }

    if (appNoteMatch && request.method === 'DELETE') {
      return withAppWorkspace(request, response, context, (appContext) => {
        const deleted = appWorkspaceService.deleteNote(appContext.workspaceId, decodeURIComponent(appNoteMatch[1]), clock);
        return deleted
          ? sendJson(response, 200, { ok: true, id: deleted.id, deleted: true })
          : sendJson(response, 404, { ok: false, error: 'NOTE_NOT_FOUND' });
      });
    }

    const thumbnailMatch = /^\/api\/v1\/app\/attachments\/([^/]+)\/thumbnail$/.exec(context.pathname);
    if (thumbnailMatch && request.method === 'GET') {
      return withAppWorkspace(request, response, context, (appContext) => {
        return sendAttachmentResponse(response, appWorkspaceService.attachmentContent(
          appContext.workspaceId,
          decodeURIComponent(thumbnailMatch[1]),
          { thumbnail: true }
        ));
      });
    }

    const previewMatch = /^\/api\/v1\/app\/attachments\/([^/]+)\/preview$/.exec(context.pathname);
    if (previewMatch && request.method === 'GET') {
      return withAppWorkspace(request, response, context, (appContext) => {
        const preview = appWorkspaceService.attachmentPreview(appContext.workspaceId, decodeURIComponent(previewMatch[1]));
        if (preview.status === 200) {
          return sendJson(response, 200, preview.payload);
        }
        return sendJson(response, preview.status, { ok: false, error: preview.error });
      });
    }

    const attachmentMatch = /^\/api\/v1\/app\/attachments\/([^/]+)$/.exec(context.pathname);
    if (attachmentMatch && request.method === 'GET') {
      return withAppWorkspace(request, response, context, (appContext) => {
        return sendAttachmentResponse(response, appWorkspaceService.attachmentContent(
          appContext.workspaceId,
          decodeURIComponent(attachmentMatch[1])
        ));
      });
    }

    return false;
  };
}

function sendAttachmentResponse(response, result) {
  if (result.status !== 200) {
    return sendJson(response, result.status, { ok: false, error: result.error });
  }
  response.writeHead(200, {
    'Content-Type': result.mime,
    'Cache-Control': result.cacheControl
  });
  response.end(result.content);
  return true;
}

module.exports = {
  createAppWorkspaceRoutes
};
