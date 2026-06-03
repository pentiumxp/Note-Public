'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const wrapper = path.join(process.cwd(), 'scripts', 'note_mcp_stdio.py');

test('MCP wrapper fails closed when workspace config is missing', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'note-mcp-missing-'));
  const result = runPython([wrapper, '--workspace', workspace, '--no-workspace-override', '--api-base-url', 'http://127.0.0.1:4173']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /note_mcp_config_missing/);
});

test('MCP tools list uses local names without mcp_note prefix', () => {
  const workspace = createWorkspaceFixture();
  const result = runPython([
    wrapper,
    '--workspace',
    workspace,
    '--no-workspace-override',
    '--api-base-url',
    'http://127.0.0.1:4173',
    '--self-test-tools-list'
  ]);

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.tools, [
    'notes_search',
    'notes_recent',
    'notes_get',
    'notes_create',
    'notes_update',
    'notes_delete',
    'notes_tags_list'
  ]);
  assert.equal(payload.tools.some((name) => name.startsWith('mcp_note_')), false);
});

test('MCP wrapper rejects model-provided workspace override arguments', () => {
  const workspace = createWorkspaceFixture();
  const request = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'notes_recent',
      arguments: { workspace_id: 'note:owner' }
    }
  }) + '\n';
  const result = runPython([
    wrapper,
    '--workspace',
    workspace,
    '--no-workspace-override',
    '--api-base-url',
    'http://127.0.0.1:4173'
  ], request);

  assert.equal(result.status, 0);
  const response = JSON.parse(result.stdout.trim());
  assert.match(JSON.stringify(response), /note_mcp_workspace_override_forbidden/);
});

function createWorkspaceFixture() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'note-mcp-'));
  const configDir = path.join(workspace, '.hermes-note');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({
    schema_version: 1,
    api_base_url: 'http://127.0.0.1:4173',
    workspace_id: 'note:weixin_test_1',
    hermes_workspace_id: 'weixin_test_1',
    display_name: '测试账号',
    access_key_file: 'access-key.txt',
    scopes: ['notes:read', 'notes:write', 'notes:search']
  }), 'utf8');
  fs.writeFileSync(path.join(configDir, 'access-key.txt'), 'workspace-raw-key', 'utf8');
  return workspace;
}

function runPython(args, input = '') {
  return spawnSync('python', args, {
    input,
    encoding: 'utf8',
    windowsHide: true
  });
}
