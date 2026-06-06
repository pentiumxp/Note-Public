'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('embedded app supports bounded Hermes postMessage contract', () => {
  const app = fs.readFileSync(path.join(process.cwd(), 'public', 'app.js'), 'utf8');

  for (const eventName of ['hermes:theme', 'hermes:workspace', 'hermes:refresh', 'hermes:visibility', 'hermes.plugin.back']) {
    assert.match(app, new RegExp(eventName));
  }
  for (const eventName of ['plugin:ready', 'plugin:refreshRequested', 'plugin:navigationChanged', 'note.plugin.navigation', 'note.plugin.back_result']) {
    assert.match(app, new RegExp(eventName));
  }
  assert.match(app, /function handlePluginBack\(\)/);
  assert.match(app, /function emitNavigationState\(\)/);
  assert.match(app, /const previewFullscreen = route\.surface === 'image_preview' \|\| route\.surface === 'file_preview'/);
  assert.match(app, /const previewKind = route\.surface === 'file_preview' \? 'file' : 'image'/);
  assert.match(app, /previewFullscreen,\s+fullscreenPreview: previewFullscreen/);
  assert.match(app, /preview: previewFullscreen \? \{ kind: previewKind, fullscreen: true \} : \{ fullscreen: false \}/);
  assert.match(app, /document\.addEventListener\('error', handlePreviewImageFallback, true\)/);
  assert.match(app, /function previewImageMarkup\(src, fallbackSrc = '', alt = '', options = \{\}\)/);
  assert.match(app, /data-fallback-src="\$\{escapeHtml\(fallbackSrc\)\}"/);
  assert.doesNotMatch(app, /postMessage\([^)]*body/i);
  assert.doesNotMatch(app, /postMessage\([^)]*access/i);
  assert.doesNotMatch(app, /postMessage\([^)]*token/i);
});
