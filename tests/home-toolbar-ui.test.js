'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('home toolbar removes large quick-create entries', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'public', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(process.cwd(), 'public', 'styles.css'), 'utf8');
  const listToolbar = html.match(/<div class="list-toolbar">[\s\S]*?<\/div>/)?.[0] || '';
  const sheetPanel = html.match(/<section class="sheet-panel"[\s\S]*?<\/section>/)?.[0] || '';

  assert.doesNotMatch(html, /class="quick-create-strip"/);
  assert.match(sheetPanel, /data-create-kind="super"/);
  assert.match(sheetPanel, /data-create-kind="photo"/);
  assert.match(sheetPanel, /data-create-kind="scan"/);
  assert.match(sheetPanel, /data-create-kind="attachment"/);
  assert.doesNotMatch(listToolbar, /id="list-title"|id="list-subtitle"|<h1|eyebrow/);
  assert.match(listToolbar, /<select id="sort-select"/);
  assert.match(css, /\.list-toolbar\s*\{[\s\S]*?display:\s*none;/);
  assert.match(css, /\.note-row-title\s*\{[\s\S]*?-webkit-line-clamp:\s*2;/);
  assert.match(css, /\.note-row-title\s*\{[\s\S]*?white-space:\s*normal;/);
});
