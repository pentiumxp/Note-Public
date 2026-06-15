'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('home toolbar removes large quick-create entries', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'public', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(process.cwd(), 'public', 'app.js'), 'utf8');
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
  assert.match(css, /\.note-row-title\s*\{[\s\S]*?-webkit-line-clamp:\s*3;/);
  assert.match(css, /\.note-row-title\s*\{[\s\S]*?white-space:\s*normal;/);
  assert.match(css, /body\s*\{[\s\S]*?font-size:\s*calc\(16px \* var\(--note-font-scale\)\);/);
  assert.match(css, /body\s*\{[\s\S]*?font-family:\s*inherit;/);
  assert.match(appJs, /pluginFontSize/);
  assert.match(appJs, /fontFamily = theme\.fontFamily/);
  assert.match(html, /id="refresh-button"[\s\S]*aria-label="刷新"/);
  assert.match(appJs, /refreshButton:\s*document\.querySelector\('#refresh-button'\)/);
  assert.match(appJs, /triggerWorkspaceRefresh/);
  assert.match(css, /\.mobile-title\s*\{[\s\S]*?white-space:\s*nowrap;/);
  assert.match(css, /\.mobile-title\s*\{[\s\S]*?writing-mode:\s*horizontal-tb;/);
  assert.match(css, /@media \(max-width: 420px\)[\s\S]*?\.home-topline\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;/);
  assert.doesNotMatch(html, />许</);
  assert.doesNotMatch(appJs, /note-row-snippet/);
});
