'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const { createHermesPluginService } = require('../src/services/hermes-plugin-service');
const { createHermesPluginRoutes } = require('../src/server-routes/hermes-plugin-routes');
const {
  createSqliteHermesWorkspaceStore,
  createSqliteLaunchTokenStore,
  openNoteDatabase
} = require('../src/stores/sqlite-note-store');
const {
  createSqliteAttachmentStore,
  openAttachmentDatabase
} = require('../src/stores/sqlite-attachment-store');

const root = path.join(process.cwd(), 'public');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';
const dbPath = process.env.NOTE_DB_PATH || path.join(process.cwd(), 'data', 'note.sqlite3');
const attachmentDbPath = process.env.NOTE_ATTACHMENT_DB_PATH || path.join(process.cwd(), 'data', 'attachment.sqlite3');
const attachmentRoot = process.env.NOTE_ATTACHMENT_ROOT || path.join(process.cwd(), 'data', 'attachments');
const registrationKey = process.env.NOTE_REGISTRATION_KEY || readRegistrationKeyFile();
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};

const db = openNoteDatabase(dbPath);
const attachmentDb = openAttachmentDatabase(attachmentDbPath);
const attachmentStore = createSqliteAttachmentStore({ db: attachmentDb, idGenerator: () => crypto.randomUUID() });
const pluginService = createHermesPluginService({
  workspaceStore: createSqliteHermesWorkspaceStore(db),
  tokenStore: createSqliteLaunchTokenStore(db),
  registrationKey,
  idGenerator: () => crypto.randomUUID()
});
const routePlugin = createHermesPluginRoutes({
  pluginService,
  db,
  appWorkspaceId: process.env.NOTE_APP_WORKSPACE_ID || 'note:yinxiang_import',
  requireAppLaunchToken: process.env.NOTE_REQUIRE_APP_LAUNCH_TOKEN === '1',
  idGenerator: () => crypto.randomUUID(),
  attachmentRoot,
  attachmentStore
});

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const routed = await routePlugin(request, response, { url, pathname: url.pathname });
  if (routed) {
    return;
  }
  serveStatic(url, response);
});

server.listen(port, host, () => {
  console.log(`Note plugin listening at http://${host}:${port}`);
});

function readRegistrationKeyFile() {
  const candidates = [
    process.env.NOTE_REGISTRATION_KEY_PATH,
    process.env.NOTE_REGISTRATION_KEY_FILE,
    process.env.HERMES_MOBILE_NOTE_PLUGIN_OWNER_KEY_PATH,
    process.env.HERMES_MOBILE_PLUGIN_NOTE_OWNER_KEY_PATH,
    process.env.NOTE_HERMES_OWNER_KEY_PATH,
    process.env.NOTE_HERMES_OWNER_KEY_FILE
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const value = fs.readFileSync(candidate, 'utf8').trim();
      if (value) return value;
    } catch {
      // Try the next configured path; provisioning will fail closed if none works.
    }
  }
  return '';
}

function serveStatic(url, response) {
  const cleanPath = url.pathname === '/' ? '/index.html' : url.pathname === '/note.html' ? '/index.html' : url.pathname;
  const filePath = path.resolve(root, `.${cleanPath}`);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': types[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    response.end(content);
  });
}
