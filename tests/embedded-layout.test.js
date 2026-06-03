"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("embed=hermes marks the document before CSS loads", () => {
  const html = read("public/index.html");
  assert.match(html, /document\.documentElement\.dataset\.embed\s*=\s*['"]hermes['"]/);
  assert.match(html, /<div id="app" class="app-shell">/);
  assert.ok(html.indexOf("dataset.embed") < html.indexOf("styles.css"), "embed marker should run before stylesheet load");
});

test("embedded layout uses iframe-relative root height", () => {
  const css = read("public/styles.css");
  assert.match(css, /html\[data-embed="hermes"\],\s*html\[data-embed="hermes"\] body,\s*html\[data-embed="hermes"\] #app\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;/s);
  assert.match(css, /html\[data-embed="hermes"\] body\s*\{[^}]*overflow:\s*hidden;/s);
});

test("embedded mobile shell owns only the Note footer row", () => {
  const css = read("public/styles.css");
  assert.match(css, /html\[data-embed="hermes"\] \.app-shell\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\) auto;[^}]*padding-bottom:\s*0;/s);
  assert.match(css, /html\[data-embed="hermes"\] \.workspace\s*\{[^}]*min-height:\s*0;[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/s);
  assert.match(css, /html\[data-embed="hermes"\] \.home-surface\s*\{[^}]*overflow:\s*auto;/s);
  assert.match(css, /html\[data-embed="hermes"\] \.note-list\s*\{[^}]*overflow:\s*visible;/s);
  assert.match(css, /html\[data-embed="hermes"\] \.mobile-tabs\s*\{[^}]*position:\s*relative;[^}]*min-height:\s*66px;[^}]*padding-bottom:\s*0;/s);
  assert.match(css, /html\[data-embed="hermes"\] \.editor-scroll\s*\{[^}]*padding-bottom:\s*88px;/s);
});
