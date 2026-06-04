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

test('MCP tools list exposes attachment schemas for create and update', () => {
  const workspace = createWorkspaceFixture();
  const request = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
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
  const tools = new Map(response.result.tools.map((tool) => [tool.name, tool]));
  const createAttachments = tools.get('notes_create').inputSchema.properties.attachments;
  const updateAttachments = tools.get('notes_update').inputSchema.properties.attachments;

  assert.equal(createAttachments.maxItems, 8);
  assert.equal(createAttachments.items.required.includes('name'), true);
  assert.equal(createAttachments.items.properties.data_base64.type, 'string');
  assert.equal(updateAttachments.items.additionalProperties, false);
});

test('MCP initialize includes serverInfo for Hermes Agent SDK validation', () => {
  const workspace = createWorkspaceFixture();
  const request = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1' }
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
  assert.equal(response.result.protocolVersion, '2024-11-05');
  assert.deepEqual(response.result.capabilities, { tools: {} });
  assert.deepEqual(response.result.serverInfo, { name: 'note', version: '1.0.0' });
});

test('MCP notifications without id do not emit invalid id-null responses', () => {
  const workspace = createWorkspaceFixture();
  const request = JSON.stringify({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {}
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
  assert.equal(result.stdout.trim(), '');
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

test('MCP wrapper rejects model-provided attachment paths before API calls', () => {
  const workspace = createWorkspaceFixture();
  const request = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'notes_create',
      arguments: {
        title: 'Attachment fixture',
        body: 'Synthetic body',
        attachments: [{ name: 'secret.txt', path: 'C:/secret.txt' }]
      }
    }
  }) + '\n';
  const result = runPython([
    wrapper,
    '--workspace',
    workspace,
    '--no-workspace-override',
    '--api-base-url',
    'http://127.0.0.1:9'
  ], request);

  assert.equal(result.status, 0);
  const response = JSON.parse(result.stdout.trim());
  assert.match(JSON.stringify(response), /note_mcp_attachment_field_forbidden/);
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
