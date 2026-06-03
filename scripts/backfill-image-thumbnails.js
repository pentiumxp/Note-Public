'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { openNoteDatabase } = require('../src/stores/sqlite-note-store');

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const noteDbPath = path.resolve(options.db || path.join(process.cwd(), 'data', 'note.sqlite3'));
  const attachmentRoot = path.resolve(options.attachmentRoot || path.join(process.cwd(), 'data', 'attachments'));
  const thumbnailRoot = path.resolve(options.thumbnailRoot || path.join(process.cwd(), 'data', 'thumbnails'));
  const workspaceId = options.workspaceId || 'note:yinxiang_import';
  const force = Boolean(options.force);
  const dryRun = Boolean(options.dryRun);

  const db = openNoteDatabase(noteDbPath);
  const rows = db.prepare(`
    select id, workspace_id, metadata_json
    from attachments
    where workspace_id = ? and kind = 'image'
  `).all(workspaceId);

  const manifest = [];
  const byId = new Map();
  for (const row of rows) {
    const metadata = safeJson(row.metadata_json, {});
    if (!force && metadata.thumbnailStorageKey) continue;
    const sourceKey = String(metadata.storageKey || '');
    const sha = String(metadata.sha256 || metadata.resourceHash || row.id);
    if (!sourceKey) continue;
    const source = path.resolve(attachmentRoot, ...sourceKey.split('/'));
    if (!source.startsWith(attachmentRoot) || !fs.existsSync(source)) continue;
    const storageKey = [
      safePathSegment(row.workspace_id),
      sha.slice(0, 2),
      `${sha}_160.jpg`
    ].join('/');
    const target = path.resolve(thumbnailRoot, ...storageKey.split('/'));
    manifest.push({ id: row.id, source, target });
    byId.set(row.id, { row, metadata, storageKey });
  }

  if (!manifest.length) {
    db.close?.();
    return { ok: true, workspaceId, scanned: rows.length, generated: 0, dryRun };
  }

  if (dryRun) {
    db.close?.();
    return { ok: true, workspaceId, scanned: rows.length, candidates: manifest.length, generated: 0, dryRun };
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'note-thumbs-'));
  const manifestPath = path.join(tmp, 'manifest.json');
  const resultPath = path.join(tmp, 'results.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest), 'utf8');
  const powershell = spawnSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    path.join(process.cwd(), 'scripts', 'generate-image-thumbnails.ps1'),
    '-ManifestPath',
    manifestPath,
    '-ResultPath',
    resultPath
  ], { encoding: 'utf8' });
  if (powershell.status !== 0) {
    throw new Error(powershell.stderr || powershell.stdout || 'thumbnail generation failed');
  }

  const results = safeJson(fs.readFileSync(resultPath, 'utf8'), []);
  let generated = 0;
  db.exec('begin immediate');
  try {
    for (const result of results) {
      if (!result.ok) continue;
      const item = byId.get(result.id);
      if (!item) continue;
      item.metadata.thumbnailStorageKey = item.storageKey;
      item.metadata.thumbnailMime = 'image/jpeg';
      item.metadata.thumbnailWidth = Number(result.width || 0);
      item.metadata.thumbnailHeight = Number(result.height || 0);
      item.metadata.thumbnailSize = Number(result.size || 0);
      db.prepare(`
        update attachments
        set metadata_json = ?
        where workspace_id = ? and id = ?
      `).run(JSON.stringify(item.metadata), item.row.workspace_id, item.row.id);
      generated += 1;
    }
    db.exec('commit');
  } catch (error) {
    db.exec('rollback');
    throw error;
  } finally {
    db.close?.();
  }

  return { ok: true, workspaceId, scanned: rows.length, candidates: manifest.length, generated, dryRun };
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--db') parsed.db = args[++index];
    else if (arg === '--attachment-root') parsed.attachmentRoot = args[++index];
    else if (arg === '--thumbnail-root') parsed.thumbnailRoot = args[++index];
    else if (arg === '--workspace-id') parsed.workspaceId = args[++index];
    else if (arg === '--force') parsed.force = true;
    else if (arg === '--dry-run') parsed.dryRun = true;
  }
  return parsed;
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function safePathSegment(value) {
  return String(value || 'item').replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 96) || 'item';
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(main(), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  main
};
