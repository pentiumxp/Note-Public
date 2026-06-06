'use strict';

const { createNoteReferenceService } = require('../services/note-reference-service');
const { createReferenceGraphService } = require('../services/reference-graph-service');
const { createSqliteNoteStore } = require('../stores/sqlite-note-store');
const { createSqliteReferenceGraphStore } = require('../stores/sqlite-reference-graph-store');
const { boundedLimit, readJson, sendJson } = require('./http-utils');

function createReferenceApiRoutes({ withWorkspace, db, idGenerator, clock }) {
  if (!withWorkspace) {
    throw new Error('withWorkspace is required');
  }
  if (!db) {
    throw new Error('db is required');
  }

  return async function routeReferenceApi(request, response, context) {
    if (context.pathname === '/api/v1/notes/links' && request.method === 'POST') {
      return withWorkspace(request, response, async (noteService, workspace) => {
        const body = await readJson(request);
        const service = makeReferenceService(workspace.workspace_id);
        sendJson(response, 201, await service.linkCreate(body));
      });
    }

    const noteLinksMatch = /^\/api\/v1\/notes\/([^/]+)\/links$/.exec(context.pathname);
    if (noteLinksMatch && request.method === 'GET') {
      return withWorkspace(request, response, async (noteService, workspace) => {
        const service = makeReferenceService(workspace.workspace_id);
        sendJson(response, 200, await service.linksList(decodeURIComponent(noteLinksMatch[1]), {
          relation: context.url.searchParams.get('relation') || '',
          target_plugin_id: context.url.searchParams.get('target_plugin_id') || '',
          limit: boundedLimit(context.url.searchParams.get('limit'))
        }));
      });
    }

    if (context.pathname === '/api/v1/notes/backlinks' && request.method === 'GET') {
      return withWorkspace(request, response, async (noteService, workspace) => {
        const service = makeReferenceService(workspace.workspace_id);
        sendJson(response, 200, await service.backlinksList({
          plugin_id: context.url.searchParams.get('plugin_id') || '',
          object_type: context.url.searchParams.get('object_type') || '',
          object_id: context.url.searchParams.get('object_id') || '',
          relation: context.url.searchParams.get('relation') || '',
          limit: boundedLimit(context.url.searchParams.get('limit'))
        }));
      });
    }

    const linkDeleteMatch = /^\/api\/v1\/notes\/links\/([^/]+)$/.exec(context.pathname);
    if (linkDeleteMatch && request.method === 'DELETE') {
      return withWorkspace(request, response, async (noteService, workspace) => {
        const service = makeReferenceService(workspace.workspace_id);
        sendJson(response, 200, service.linkDelete(decodeURIComponent(linkDeleteMatch[1])));
      });
    }

    if (context.pathname === '/api/v1/reference/object-types' && request.method === 'GET') {
      return withWorkspace(request, response, async (noteService, workspace) => {
        const service = makeReferenceService(workspace.workspace_id);
        sendJson(response, 200, service.referenceObjectTypes());
      });
    }

    if (context.pathname === '/api/v1/reference/get' && request.method === 'GET') {
      return withWorkspace(request, response, async (noteService, workspace) => {
        const service = makeReferenceService(workspace.workspace_id);
        sendJson(response, 200, await service.referenceGet(
          context.url.searchParams.get('object_type') || '',
          context.url.searchParams.get('object_id') || ''
        ));
      });
    }

    if (context.pathname === '/api/v1/reference/summarize' && request.method === 'GET') {
      return withWorkspace(request, response, async (noteService, workspace) => {
        const service = makeReferenceService(workspace.workspace_id);
        sendJson(response, 200, await service.referenceSummarize(
          context.url.searchParams.get('object_type') || '',
          context.url.searchParams.get('object_id') || '',
          context.url.searchParams.get('purpose') || ''
        ));
      });
    }

    return false;
  };

  function makeReferenceService(workspaceId) {
    const noteStore = createSqliteNoteStore({ db, workspaceId });
    const graphStore = createSqliteReferenceGraphStore({ db, workspaceId });
    const graphService = createReferenceGraphService({
      store: graphStore,
      idGenerator,
      clock
    });
    return createNoteReferenceService({
      noteStore,
      graphService
    });
  }
}

module.exports = {
  createReferenceApiRoutes
};
