'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const ignoredDirs = new Set(['.git', 'node_modules', 'coverage', 'dist', 'build', 'data', 'runtime', 'logs', 'tmp', 'imports']);
const prohibited = [
  /access[_-]?key\s*[:=]\s*['"][^'"]+/i,
  /api[_-]?token\s*[:=]\s*['"][^'"]+/i,
  /oauth[_-]?(access|refresh)?[_-]?token\s*[:=]\s*['"][^'"]+/i,
  /cookie\s*[:=]\s*['"][^'"]+/i,
  /session[_-]?id\s*[:=]\s*['"][^'"]+/i,
  /private[_-]?key\s*[:=]\s*['"][^'"]+/i,
  /password\s*[:=]\s*['"][^'"]+/i
];

const findings = [];

for (const file of walk(root)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of prohibited) {
    if (pattern.test(text)) {
      findings.push(path.relative(root, file));
      break;
    }
  }
}

if (findings.length > 0) {
  console.error('Potential prohibited secret-like content found:');
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log('Privacy scan passed.');

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (/\.(md|js|json|example|txt)$/i.test(entry.name)) {
      yield fullPath;
    }
  }
}
