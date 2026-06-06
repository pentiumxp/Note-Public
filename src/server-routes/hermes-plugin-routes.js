'use strict';

const { createAppWorkspaceService, normalizeImportedBody, notebookDisplayName } = require('../services/app-workspace-service');
const { createDocumentPreviewService } = require('../services/document-preview-service');
const { createNoteService } = require('../services/note-service');
const { createSqliteNoteStore } = require('../stores/sqlite-note-store');
const { createAppWorkspaceRoutes } = require('./app-workspace-routes');
const { createNoteApiRoutes, noteSummary } = require('./note-api-routes');
const { createReferenceApiRoutes } = require('./reference-api-routes');
const { handleJson, readJson, routeError, sendError, sendJson } = require('./http-utils');

function createHermesPluginRoutes({
  pluginService,
  db,
  idGenerator,
  clock,
  appWorkspaceId,
  requireAppLaunchToken = false,
  attachmentRoot,
  attachmentStore = null
}) {
  const documentPreviewService = createDocumentPreviewService();
  const appWorkspaceService = createAppWorkspaceService({
    db,
    attachmentRoot,
    documentPreviewService
  });

  function makeNoteService(workspaceId) {
    return createNoteService({
      store: createSqliteNoteStore({ db, workspaceId }),
      idGenerator,
      clock
    });
  }

  async function withWorkspace(request, response, handler) {
    try {
      const workspaceId = String(request.headers['x-note-workspace-id'] || '');
      const workspace = await pluginService.verifyWorkspaceKey({
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

  const appRoutes = createAppWorkspaceRoutes({
    appWorkspaceService,
    withAppWorkspace,
    clock
  });
  const referenceRoutes = createReferenceApiRoutes({
    withWorkspace,
    db,
    idGenerator,
    clock
  });
  const noteRoutes = createNoteApiRoutes({
    withWorkspace,
    db,
    attachmentRoot,
    attachmentStore,
    idGenerator,
    clock
  });

  return async function route(request, response, context) {
    if (await appRoutes(request, response, context)) {
      return true;
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

    if (await referenceRoutes(request, response, context)) {
      return true;
    }

    if (await noteRoutes(request, response, context)) {
      return true;
    }

    return false;
  };
}

function appLaunchToken(request, url) {
  const headerToken = String(request.headers['x-note-launch-token'] || '').trim();
  if (headerToken) {
    return headerToken;
  }
  return String(url.searchParams.get('launch') || '').trim();
}

module.exports = {
  createHermesPluginRoutes,
  noteSummary,
  readJson,
  normalizeImportedBody,
  notebookDisplayName
};
