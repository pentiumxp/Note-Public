'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { openNoteDatabase } = require('../src/stores/sqlite-note-store');
const {
  createSqliteAttachmentStore,
  openAttachmentDatabase
} = require('../src/stores/sqlite-attachment-store');

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const noteDbPath = path.resolve(options.db || path.join(process.cwd(), 'data', 'note.sqlite3'));
  const attachmentDbPath = path.resolve(options.attachmentDb || path.join(process.cwd(), 'data', 'attachment.sqlite3'));
  const attachmentRoot = path.resolve(options.attachmentRoot || path.join(process.cwd(), 'data', 'attachments'));
  const workspaceId = options.workspaceId || 'note:yinxiang_import';
  const dryRun = Boolean(options.dryRun);

  const noteDb = openNoteDatabase(noteDbPath);
  const attachmentDb = dryRun ? null : openAttachmentDatabase(attachmentDbPath);
  const attachmentStore = attachmentDb ? createSqliteAttachmentStore({ db: attachmentDb }) : null;
  const rows = noteDb.prepare(`
    select id, workspace_id, note_id, name, kind, size, metadata_json, created_at
    from attachments
    where workspace_id = ?
    order by created_at asc
  `).all(workspaceId);

  const stats = {
    scanned: 0,
    active: 0,
    missing: 0,
    updatedMetadata: 0,
    dryRun
  };

  noteDb.exec('begin immediate');
  try {
    for (const row of rows) {
      stats.scanned += 1;
      const metadata = safeJson(row.metadata_json, {});
      const sourceKey = String(metadata.storageKey || '');
      const sourcePath = sourceKey ? path.resolve(attachmentRoot, ...sourceKey.split('/')) : '';
      const now = new Date().toISOString();
      let status = 'missing';
      let sha256 = String(metadata.sha256 || '');
      let storageKey = sourceKey;
      let size = Number(row.size || metadata.size || 0);

      if (sourcePath && sourcePath.startsWith(attachmentRoot) && fs.existsSync(sourcePath)) {
        const bytes = fs.readFileSync(sourcePath);
        sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
        size = bytes.length;
        storageKey = [
          safePathSegment(row.workspace_id),
          sha256.slice(0, 2),
          `${sha256}${extensionForMime(metadata.mime || '')}`
        ].join('/');
        const targetPath = path.resolve(attachmentRoot, ...storageKey.split('/'));
        if (!dryRun) {
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          if (!fs.existsSync(targetPath)) {
            fs.copyFileSync(sourcePath, targetPath);
          }
        }
        status = 'active';
        stats.active += 1;
      } else {
        metadata.missingFile = true;
        stats.missing += 1;
      }

      metadata.storageKey = storageKey || metadata.storageKey || '';
      metadata.sha256 = sha256 || metadata.sha256 || '';
      metadata.size = size || metadata.size || 0;

      if (!dryRun) {
        noteDb.prepare(`
          update attachments
          set size = ?, metadata_json = ?
          where workspace_id = ? and id = ?
        `).run(size, JSON.stringify(metadata), row.workspace_id, row.id);
        attachmentStore.saveAsset({
          workspaceId: row.workspace_id,
          noteId: row.note_id,
          attachmentId: row.id,
          name: row.name,
          kind: row.kind,
          size,
          mime: metadata.mime || 'application/octet-stream',
          storageKey: status === 'active' ? storageKey : '',
          sha256: status === 'active' ? sha256 : '',
          sourceHash: metadata.resourceHash || '',
          status,
          createdAt: row.created_at || now,
          updatedAt: now
        });
        stats.updatedMetadata += 1;
      }
    }
    noteDb.exec('commit');
  } catch (error) {
    noteDb.exec('rollback');
    throw error;
  } finally {
    noteDb.close?.();
    attachmentDb?.close?.();
  }

  return {
    ok: true,
    workspaceId,
    noteDbPath,
    attachmentDbPath,
    attachmentRoot,
    ...stats
  };
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--db') parsed.db = args[++index];
    else if (arg === '--attachment-db') parsed.attachmentDb = args[++index];
    else if (arg === '--attachment-root') parsed.attachmentRoot = args[++index];
    else if (arg === '--workspace-id') parsed.workspaceId = args[++index];
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

function extensionForMime(mime) {
  const value = String(mime || '').toLowerCase();
  if (value === 'image/jpeg') return '.jpg';
  if (value === 'image/png') return '.png';
  if (value === 'image/gif') return '.gif';
  if (value === 'image/webp') return '.webp';
  if (value === 'application/pdf') return '.pdf';
  if (value.includes('word')) return '.docx';
  if (value.includes('excel') || value.includes('spreadsheet')) return '.xlsx';
  if (value.includes('powerpoint') || value.includes('presentation')) return '.pptx';
  if (value === 'text/plain') return '.txt';
  return '.bin';
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
