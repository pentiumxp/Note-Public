'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('note UI consumes host plugin action routes', () => {
  const js = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(js, /get\('pluginRoute'\)/);
  assert.match(js, /get\('pluginActionId'\)/);
  assert.match(js, /function applyInitialPluginRoute\(\)/);
  assert.match(js, /route === 'new_note'/);
  assert.match(js, /route === 'capture'/);
  assert.match(js, /openCreateSheet\(\)/);
  assert.match(js, /route === 'search'/);
  assert.match(js, /route === 'recent'/);
  assert.match(js, /route === 'notebooks'/);
  assert.match(js, /route === 'receipt_notes'/);
});
