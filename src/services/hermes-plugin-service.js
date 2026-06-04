'use strict';

const crypto = require('node:crypto');

const DEFAULT_SCOPES = Object.freeze(['notes:read', 'notes:write', 'notes:search']);
const TOKEN_TTL_SECONDS = 300;
const APPEARANCE_THEMES = Object.freeze(['dark', 'light']);
const DEFAULT_APPEARANCE = Object.freeze({ theme: 'light' });

const PLUGIN_MANIFEST = Object.freeze({
  id: 'note',
  title: '笔记',
  kind: 'embedded_app',
  entry: {
    url: '/note.html?embed=hermes',
    mode: 'iframe'
  },
  launch: {
    endpoint: '/api/v1/hermes/plugin/launch',
    method: 'POST',
    token_ttl_seconds: TOKEN_TTL_SECONDS
  },
  provisioning: {
    endpoint: '/api/v1/hermes/plugin/workspaces',
    method: 'POST',
    mode: 'workspace_binding'
  },
  mcp: {
    server: 'note',
    toolset: 'note',
    requiredTools: ['mcp_note_notes_search', 'mcp_note_notes_create']
  },
  toolsets: ['note'],
  workspace: {
    required: true,
    idFormat: 'note:<hermes_workspace_id>'
  },
  embedding: {
    sameOriginProxy: true,
    postMessage: true,
    themeInheritance: true
  },
  appearance_sync: {
    theme: APPEARANCE_THEMES,
    launch_field: 'appearance',
    entry_query: {
      theme: 'pluginTheme'
    }
  }
});

function createHermesPluginService(options) {
  const workspaceStore = required(options?.workspaceStore, 'workspaceStore');
  const registrationKey = options.registrationKey || process.env.NOTE_REGISTRATION_KEY || '';
  const now = options.clock || (() => new Date());
  const tokenGenerator = options.tokenGenerator || (() => crypto.randomBytes(24).toString('base64url'));
  const tokenStore = options.tokenStore || createMemoryLaunchTokenStore();

  async function getManifest() {
    return clone(PLUGIN_MANIFEST);
  }

  async function provisionWorkspace({ authorization, body }) {
    assertRegistrationKey(authorization, registrationKey);
    const normalized = normalizeProvisioningBody(body);
    const timestamp = now().toISOString();
    const existing = await workspaceStore.getWorkspace(normalized.workspace_id);
    const record = {
      workspace_id: normalized.workspace_id,
      hermes_workspace_id: normalized.hermes_workspace_id,
      display_name: normalized.display_name,
      access_key_hash: normalized.access_key_hash,
      scopes: normalized.scopes,
      status: 'active',
      created_at: existing?.created_at || timestamp,
      updated_at: timestamp
    };
    await workspaceStore.saveWorkspace(record);
    return {
      ok: true,
      workspace_id: record.workspace_id,
      hermes_workspace_id: record.hermes_workspace_id,
      status: 'active',
      provisioning_result: existing ? 'updated' : 'created',
      scopes: record.scopes
    };
  }

  async function launchWorkspace({ authorization, body }) {
    const rawKey = bearerValue(authorization);
    if (!rawKey) {
      throw pluginError('permission_denied', 'Workspace key is required', 403);
    }
    const normalized = normalizeLaunchBody(body);
    const appearance = normalizeAppearance(body.appearance);
    const workspace = await workspaceStore.getWorkspace(normalized.workspace_id);
    if (!workspace) {
      throw pluginError('workspace_not_registered', 'Workspace is not registered', 404);
    }
    if (!hashMatches(rawKey, workspace.access_key_hash)) {
      throw pluginError('permission_denied', 'Workspace key is invalid', 403);
    }
    const token = tokenGenerator();
    const expiresAt = new Date(now().getTime() + TOKEN_TTL_SECONDS * 1000).toISOString();
    await tokenStore.saveLaunchToken({
      token,
      workspace_id: workspace.workspace_id,
      expires_at: expiresAt,
      appearance
    });
    return {
      entry_path: `/note.html?embed=hermes&launch=${encodeURIComponent(token)}&pluginTheme=${encodeURIComponent(appearance.theme)}`,
      appearance,
      expires_in: TOKEN_TTL_SECONDS,
      expires_in_seconds: TOKEN_TTL_SECONDS
    };
  }

  async function verifyWorkspaceKey({ workspaceId, authorization }) {
    const rawKey = bearerValue(authorization);
    if (!rawKey) {
      throw pluginError('permission_denied', 'Workspace key is required', 403);
    }
    const workspace = await workspaceStore.getWorkspace(workspaceId);
    if (!workspace) {
      throw pluginError('workspace_not_registered', 'Workspace is not registered', 404);
    }
    if (!hashMatches(rawKey, workspace.access_key_hash)) {
      throw pluginError('permission_denied', 'Workspace key is invalid', 403);
    }
    return workspace;
  }

  async function verifyLaunchToken(token) {
    const record = await tokenStore.getLaunchToken(token);
    if (!record) {
      throw pluginError('permission_denied', 'Launch token is invalid', 403);
    }
    if (new Date(record.expires_at).getTime() <= now().getTime()) {
      throw pluginError('permission_denied', 'Launch token is expired', 403);
    }
    return record;
  }

  return {
    getManifest,
    provisionWorkspace,
    launchWorkspace,
    verifyWorkspaceKey,
    verifyLaunchToken
  };
}

function createMemoryLaunchTokenStore() {
  const tokens = new Map();
  return {
    async saveLaunchToken(record) {
      tokens.set(record.token, { ...record });
    },
    async getLaunchToken(token) {
      const record = tokens.get(token);
      return record ? { ...record } : null;
    }
  };
}

function normalizeProvisioningBody(body) {
  if (!body || typeof body !== 'object') {
    throw pluginError('invalid_workspace', 'Provisioning body is required', 400);
  }
  const workspaceId = String(body.workspace_id || '');
  const hermesWorkspaceId = String(body.hermes_workspace_id || body.target_workspace_id || '');
  const targetWorkspaceId = String(body.target_workspace_id || hermesWorkspaceId);
  assertWorkspaceMapping(workspaceId, hermesWorkspaceId, targetWorkspaceId);
  const accessKeyHash = String(body.access_key_hash || '').trim();
  if (!/^[a-f0-9]{64}$/i.test(accessKeyHash)) {
    throw pluginError('invalid_workspace', 'access key hash is required', 400);
  }
  return {
    workspace_id: workspaceId,
    hermes_workspace_id: hermesWorkspaceId,
    display_name: String(body.display_name || hermesWorkspaceId),
    access_key_hash: accessKeyHash.toLowerCase(),
    scopes: normalizeScopes(body.scopes)
  };
}

function normalizeLaunchBody(body) {
  if (!body || typeof body !== 'object') {
    throw pluginError('invalid_workspace', 'Launch body is required', 400);
  }
  const workspaceId = String(body.workspace_id || '');
  const targetWorkspaceId = String(body.target_workspace_id || '');
  const hermesWorkspaceId = workspaceId.startsWith('note:') ? workspaceId.slice(5) : '';
  assertWorkspaceMapping(workspaceId, hermesWorkspaceId, targetWorkspaceId || hermesWorkspaceId);
  return {
    workspace_id: workspaceId,
    hermes_workspace_id: hermesWorkspaceId
  };
}

function normalizeAppearance(value) {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_APPEARANCE };
  }
  const theme = String(value.theme || value.appearance || value.mode || value.colorScheme || '').trim().toLowerCase();
  return {
    theme: APPEARANCE_THEMES.includes(theme) ? theme : DEFAULT_APPEARANCE.theme
  };
}

function assertWorkspaceMapping(workspaceId, hermesWorkspaceId, targetWorkspaceId) {
  if (!workspaceId.startsWith('note:') || workspaceId.length <= 5) {
    throw pluginError('invalid_workspace', 'workspace_id must use note:<hermes_workspace_id>', 400);
  }
  const derivedHermesId = workspaceId.slice(5);
  if (!hermesWorkspaceId || !targetWorkspaceId) {
    throw pluginError('invalid_workspace', 'Hermes workspace ids are required', 400);
  }
  if (derivedHermesId !== hermesWorkspaceId || derivedHermesId !== targetWorkspaceId) {
    throw pluginError('invalid_workspace', 'Workspace ids must point to the same Hermes workspace', 400);
  }
}

function assertRegistrationKey(authorization, configuredKey) {
  const incoming = bearerValue(authorization);
  if (!incoming) {
    throw pluginError('registration_key_required', 'Registration key is required', 401);
  }
  if (!configuredKey || !constantTimeEqual(incoming, configuredKey)) {
    throw pluginError('registration_key_invalid', 'Registration key is invalid', 403);
  }
}

function bearerValue(authorization) {
  const value = String(authorization || '').trim();
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match ? match[1] : '';
}

function normalizeScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return [...DEFAULT_SCOPES];
  }
  return [...new Set(scopes.map((scope) => String(scope).trim()).filter(Boolean))];
}

function hashRawKey(rawKey) {
  return crypto.createHash('sha256').update(String(rawKey), 'utf8').digest('hex');
}

function hashMatches(rawKey, expectedHash) {
  return constantTimeEqual(hashRawKey(rawKey), expectedHash);
}

function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function pluginError(code, message, status = 500) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function required(value, name) {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  DEFAULT_SCOPES,
  PLUGIN_MANIFEST,
  TOKEN_TTL_SECONDS,
  createHermesPluginService,
  createMemoryLaunchTokenStore,
  hashRawKey,
  normalizeAppearance,
  pluginError
};
