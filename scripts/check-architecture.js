'use strict';

const fs = require('node:fs');
const path = require('node:path');

const requiredFiles = [
  'src/services/hermes-plugin-service.js',
  'src/stores/sqlite-note-store.js',
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
}

if (fs.existsSync(path.join(process.cwd(), 'src', 'server-routes', 'hermes-plugin-routes.js'))) {
  const routes = fs.readFileSync(path.join(process.cwd(), 'src', 'server-routes', 'hermes-plugin-routes.js'), 'utf8');
  if (/DatabaseSync|createHash|timingSafeEqual/.test(routes)) {
    failures.push('Route layer should not own SQLite setup or auth hashing logic');
  }
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

if (failures.length) {
  console.error('Architecture check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Architecture check passed.');
