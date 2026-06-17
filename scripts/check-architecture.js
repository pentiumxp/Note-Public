'use strict';

const fs = require('node:fs');
const path = require('node:path');

const requiredFiles = [
  'src/services/hermes-plugin-service.js',
  'src/services/app-workspace-service.js',
  'src/services/imported-note-render-service.js',
  'src/services/reference-graph-service.js',
  'src/services/note-reference-service.js',
  'src/stores/sqlite-note-store.js',
  'src/stores/sqlite-attachment-store.js',
  'src/stores/sqlite-reference-graph-schema.js',
  'src/stores/sqlite-reference-graph-store.js',
  'src/server-routes/http-utils.js',
  'src/server-routes/app-workspace-routes.js',
  'src/server-routes/note-api-routes.js',
  'src/server-routes/reference-api-routes.js',
  'src/server-routes/hermes-plugin-routes.js',
  'scripts/note-server.js',
  'scripts/note_mcp_stdio.py',
  'docs/HERMES_PLUGIN_MANIFEST.md',
  'docs/HERMES_PLUGIN_PROVISIONING.md',
  'docs/HERMES_PLUGIN_LAUNCH.md',
  'docs/HERMES_PLUGIN_MCP.md',
  'docs/HERMES_PLUGIN_HARNESS.md'
];

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(process.cwd(), file))) {
    failures.push(`missing required file: ${file}`);
  }
}

if (fs.existsSync(path.join(process.cwd(), 'scripts', 'note_mcp_stdio.py'))) {
  const wrapper = fs.readFileSync(path.join(process.cwd(), 'scripts', 'note_mcp_stdio.py'), 'utf8');
  if (/\"name\":\s*\"mcp_note_/i.test(wrapper)) {
    failures.push('MCP wrapper must expose local tool names, not mcp_note_* prefixed names');
  }
  if (!/note_mcp_workspace_override_forbidden/.test(wrapper)) {
    failures.push('MCP wrapper must reject workspace override arguments');
  }
  for (const toolName of [
    'notes_link_create',
    'notes_links_list',
    'notes_backlinks_list',
    'notes_link_delete',
    'reference_object_types',
    'reference_get',
    'reference_summarize'
  ]) {
    if (!wrapper.includes(`"name": "${toolName}"`)) {
      failures.push(`MCP wrapper missing reference tool: ${toolName}`);
    }
  }
}

if (fs.existsSync(path.join(process.cwd(), 'src', 'server-routes', 'hermes-plugin-routes.js'))) {
  const routes = fs.readFileSync(path.join(process.cwd(), 'src', 'server-routes', 'hermes-plugin-routes.js'), 'utf8');
  if (/DatabaseSync|createHash|timingSafeEqual/.test(routes)) {
    failures.push('Route layer should not own SQLite setup or auth hashing logic');
  }
  if (/materializeMcpAttachments|recordMcpAttachmentAssets/.test(routes)) {
    failures.push('Hermes plugin route compositor should delegate note/app business logic to route groups and services');
  }
}

const architectureFiles = {
  hermesRoutes: readOptional('src/server-routes/hermes-plugin-routes.js'),
  appRoutes: readOptional('src/server-routes/app-workspace-routes.js'),
  noteRoutes: readOptional('src/server-routes/note-api-routes.js'),
  referenceRoutes: readOptional('src/server-routes/reference-api-routes.js'),
  graphService: readOptional('src/services/reference-graph-service.js'),
  noteReferenceService: readOptional('src/services/note-reference-service.js'),
  graphStore: readOptional('src/stores/sqlite-reference-graph-store.js')
};

assertContains(architectureFiles.hermesRoutes, 'function createHermesPluginRoutes', 'Hermes route compositor must expose createHermesPluginRoutes');
assertContains(architectureFiles.appRoutes, 'function createAppWorkspaceRoutes', 'App workspace routes must expose createAppWorkspaceRoutes');
assertContains(architectureFiles.noteRoutes, 'function createNoteApiRoutes', 'Note API routes must expose createNoteApiRoutes');
assertContains(architectureFiles.referenceRoutes, 'function createReferenceApiRoutes', 'Reference API routes must expose createReferenceApiRoutes');
assertContains(architectureFiles.graphService, 'function createReferenceGraphService', 'Reference graph behavior must stay in createReferenceGraphService');
assertContains(architectureFiles.noteReferenceService, 'function createNoteReferenceService', 'Note reference behavior must stay in createNoteReferenceService');
assertContains(architectureFiles.graphStore, 'function createSqliteReferenceGraphStore', 'Reference graph persistence must stay in createSqliteReferenceGraphStore');

for (const [name, source] of Object.entries({
  'app workspace routes': architectureFiles.appRoutes,
  'note API routes': architectureFiles.noteRoutes,
  'reference API routes': architectureFiles.referenceRoutes
})) {
  if (/DatabaseSync|createHash|timingSafeEqual/.test(source)) {
    failures.push(`${name} must not own SQLite setup or auth hashing logic`);
  }
}

if (/reference_edges|reference_object_refs/.test(architectureFiles.referenceRoutes)) {
  failures.push('Reference API routes must delegate reference graph persistence to stores/services');
}

if (/req\.on\(['"]data['"]/.test(architectureFiles.graphService) || /sendJson|writeHead/.test(architectureFiles.graphService)) {
  failures.push('Reference graph service must not own HTTP request or response handling');
}

if (fs.existsSync(path.join(process.cwd(), 'src', 'stores', 'sqlite-note-store.js'))) {
  const store = fs.readFileSync(path.join(process.cwd(), 'src', 'stores', 'sqlite-note-store.js'), 'utf8');
  for (const snippet of [
    'where workspace_id = ? and id = ?',
    'where workspace_id = ?',
    'idx_notes_workspace_updated',
    'idx_notes_workspace_deleted'
  ]) {
    if (!store.includes(snippet)) {
      failures.push(`SQLite store missing workspace isolation snippet: ${snippet}`);
    }
  }
}

if (fs.existsSync(path.join(process.cwd(), 'src', 'stores', 'sqlite-attachment-store.js'))) {
  const store = fs.readFileSync(path.join(process.cwd(), 'src', 'stores', 'sqlite-attachment-store.js'), 'utf8');
  for (const snippet of [
    'attachment_blobs',
    'attachment_objects',
    'attachment_integrity_checks',
    'where o.workspace_id = ?',
    'blob_sha256'
  ]) {
    if (!store.includes(snippet)) {
      failures.push(`Attachment store missing asset ledger snippet: ${snippet}`);
    }
  }
}

if (fs.existsSync(path.join(process.cwd(), 'src', 'stores', 'sqlite-reference-graph-schema.js'))) {
  const schema = fs.readFileSync(path.join(process.cwd(), 'src', 'stores', 'sqlite-reference-graph-schema.js'), 'utf8');
  for (const snippet of [
    'reference_object_refs',
    'reference_edges',
    'reference_events',
    'reference_provenance',
    'idx_reference_edges_idempotency'
  ]) {
    if (!schema.includes(snippet)) {
      failures.push(`Reference graph schema missing snippet: ${snippet}`);
    }
  }
}

if (fs.existsSync(path.join(process.cwd(), 'src', 'services', 'reference-graph-service.js'))) {
  const service = fs.readFileSync(path.join(process.cwd(), 'src', 'services', 'reference-graph-service.js'), 'utf8');
  for (const relation of ['mentions', 'same_event', 'evidence_for', 'created_from', 'context_for', 'followup_to']) {
    if (!service.includes(`'${relation}'`)) {
      failures.push(`Reference graph service missing allowed relation: ${relation}`);
    }
  }
}

if (failures.length) {
  console.error('Architecture check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Architecture check passed.');

function readOptional(file) {
  const fullPath = path.join(process.cwd(), file);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
}

function assertContains(source, snippet, message) {
  if (!source.includes(snippet)) {
    failures.push(message);
  }
}
