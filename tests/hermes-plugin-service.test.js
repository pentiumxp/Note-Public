'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createHermesPluginService,
  createMemoryLaunchTokenStore,
  hashRawKey
} = require('../src/services/hermes-plugin-service');

function createWorkspaceStore() {
  const records = new Map();
  return {
    records,
    async getWorkspace(id) {
      const record = records.get(id);
      return record ? { ...record, scopes: [...record.scopes] } : null;
    },
    async saveWorkspace(record) {
      records.set(record.workspace_id, { ...record, scopes: [...record.scopes] });
    }
  };
}

function createSubject() {
  const workspaceStore = createWorkspaceStore();
  const service = createHermesPluginService({
    workspaceStore,
    tokenStore: createMemoryLaunchTokenStore(),
    registrationKey: 'registration-secret',
    tokenGenerator: () => 'launch-token',
    clock: () => new Date('2026-06-03T00:00:00.000Z')
  });
  return { service, workspaceStore };
}

const provisioningBody = {
  owner: 'hermes',
  workspace_id: 'note:weixin_test_1',
  hermes_workspace_id: 'weixin_test_1',
  target_workspace_id: 'weixin_test_1',
  display_name: '测试账号',
  access_key_hash: hashRawKey('workspace-raw-key'),
  scopes: ['notes:read', 'notes:write', 'notes:search']
};

test('manifest is readable before workspace provisioning and is bounded', async () => {
  const { service } = createSubject();

  const manifest = await service.getManifest();

  assert.equal(manifest.id, 'note');
  assert.equal(manifest.entry.url, '/note.html?embed=hermes');
  assert.equal(manifest.workspace.idFormat, 'note:<hermes_workspace_id>');
  const text = JSON.stringify(manifest);
  assert.doesNotMatch(text, /secret|access[_-]?key|sqlite|ProgramData|volume1/i);
});

test('registration requires the configured registration key', async () => {
  const { service } = createSubject();

  await assert.rejects(
    () => service.provisionWorkspace({ authorization: '', body: provisioningBody }),
    { code: 'registration_key_required' }
  );
  await assert.rejects(
    () => service.provisionWorkspace({ authorization: 'Bearer wrong', body: provisioningBody }),
    { code: 'registration_key_invalid' }
  );
});

test('registration creates then idempotently updates a workspace hash and scopes', async () => {
  const { service, workspaceStore } = createSubject();

  const created = await service.provisionWorkspace({
    authorization: 'Bearer registration-secret',
    body: provisioningBody
  });
  const updated = await service.provisionWorkspace({
    authorization: 'Bearer registration-secret',
    body: { ...provisioningBody, display_name: '更新名称', scopes: ['notes:read'] }
  });
  const stored = await workspaceStore.getWorkspace('note:weixin_test_1');

  assert.equal(created.provisioning_result, 'created');
  assert.equal(updated.provisioning_result, 'updated');
  assert.equal(stored.display_name, '更新名称');
  assert.equal(stored.access_key_hash, hashRawKey('workspace-raw-key'));
  assert.notEqual(stored.access_key_hash, 'workspace-raw-key');
  assert.deepEqual(stored.scopes, ['notes:read']);
});

test('registration rejects workspace id conflicts', async () => {
  const { service } = createSubject();

  await assert.rejects(
    () => service.provisionWorkspace({
      authorization: 'Bearer registration-secret',
      body: { ...provisioningBody, target_workspace_id: 'owner' }
    }),
    { code: 'invalid_workspace' }
  );
});

test('launch requires registered workspace and matching raw key', async () => {
  const { service } = createSubject();

  await assert.rejects(
    () => service.launchWorkspace({
      authorization: 'Bearer workspace-raw-key',
      body: { workspace_id: 'note:weixin_test_1', target_workspace_id: 'weixin_test_1' }
    }),
    { code: 'workspace_not_registered' }
  );

  await service.provisionWorkspace({ authorization: 'Bearer registration-secret', body: provisioningBody });

  await assert.rejects(
    () => service.launchWorkspace({
      authorization: 'Bearer wrong-key',
      body: { workspace_id: 'note:weixin_test_1', target_workspace_id: 'weixin_test_1' }
    }),
    { code: 'permission_denied' }
  );
});

test('launch returns a short-lived entry without workspace id or raw key', async () => {
  const { service } = createSubject();
  await service.provisionWorkspace({ authorization: 'Bearer registration-secret', body: provisioningBody });

  const launch = await service.launchWorkspace({
    authorization: 'Bearer workspace-raw-key',
    body: { workspace_id: 'note:weixin_test_1', target_workspace_id: 'weixin_test_1' }
  });

  assert.equal(launch.expires_in_seconds, 300);
  assert.equal(launch.entry_path, '/note.html?embed=hermes&launch=launch-token');
  assert.doesNotMatch(launch.entry_path, /workspace|workspace-raw-key|sqlite|ProgramData|volume1/i);
});
