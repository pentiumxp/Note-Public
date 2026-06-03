'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const {
  createSqliteNoteStore,
  openNoteDatabase,
  upsertNotebook
} = require('../src/stores/sqlite-note-store');
const { hashRawKey } = require('../src/services/hermes-plugin-service');

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const source = path.resolve(options.source || 'C:/Users/xuxin/Yinxiang Biji/Databases/xuxinxp#app.yinxiang.com.exb');
  const workspaceId = options.workspaceId || 'note:yinxiang_import';
  const dbPath = path.resolve(options.db || path.join(process.cwd(), 'data', 'note.sqlite3'));
  const attachmentRoot = path.resolve(options.attachmentRoot || path.join(process.cwd(), 'data', 'attachments'));
  const externalAttachmentRoot = path.resolve(options.externalAttachmentRoot || `${source}.attachments`);
  const dryRun = Boolean(options.dryRun);
  const replaceWorkspace = Boolean(options.replaceWorkspace);

  if (!workspaceId.startsWith('note:')) {
    throw new Error('--workspace-id must use note:<id>');
  }
  if (!fs.existsSync(source)) {
    throw new Error(`EXB source not found: ${source}`);
  }

  const exb = new DatabaseSync(source);
  const rows = exb.prepare(`
    select
      n.uid,
      n.title,
      n.notebook,
      n.notebook_uid,
      n.tags,
      n.date_created,
      n.date_updated,
      n.has_encryption,
      n.has_todo,
      a.data as content_data
    from note_attr n
    join attrs a on a.uid = n.uid and a.aid = 40
    where ifnull(n.is_deleted, 0) = 0
    order by n.date_updated desc
  `).all();

  const notebookRows = exb.prepare(`
    select uid, name, date_created, date_updated
    from notebook_attr
    where ifnull(is_accessible, 1) != 0
  `).all();
  const notebookByUid = new Map(notebookRows.map((row) => [Number(row.uid), row]));

  const db = dryRun ? null : openNoteDatabase(dbPath);
  if (db) {
    ensureImportWorkspace(db, workspaceId);
    if (replaceWorkspace) {
      clearWorkspace(db, workspaceId);
    }
  }
  const store = db ? createSqliteNoteStore({ db, workspaceId }) : null;

  const stats = {
    imported: 0,
    bodyReadable: 0,
    bodyMissing: 0,
    attachments: 0,
    attachmentFilesFound: 0,
    attachmentFilesMissing: 0,
    notebooks: new Map()
  };

  for (const row of rows) {
    const notebookName = String(row.notebook || notebookByUid.get(Number(row.notebook_uid))?.name || 'Imported').trim() || 'Imported';
    const notebookId = `notebook_${shortHash(`${workspaceId}:exb:${row.notebook_uid || notebookName}`)}`;
    stats.notebooks.set(notebookId, notebookName);
    const body = extractEnml(row.content_data);
    if (readableBody(body)) stats.bodyReadable += 1;
    else stats.bodyMissing += 1;

    if (db) {
      upsertNotebook(db, {
        id: notebookId,
        workspace_id: workspaceId,
        name: notebookName,
        source: 'yinxiang.exb',
        created_at: isoFromYinxiangDay(notebookByUid.get(Number(row.notebook_uid))?.date_created) || new Date().toISOString(),
        updated_at: isoFromYinxiangDay(notebookByUid.get(Number(row.notebook_uid))?.date_updated) || new Date().toISOString()
      });
    }

    const noteId = `yinxiang_exb_${row.uid}`;
    const attachments = readAttachments(exb, row.uid, {
      workspaceId,
      noteId,
      attachmentRoot,
      externalAttachmentRoot,
      dryRun
    });
    stats.attachments += attachments.length;
    stats.attachmentFilesFound += attachments.filter((item) => item.metadata && item.metadata.storageKey).length;
    stats.attachmentFilesMissing += attachments.filter((item) => item.metadata && item.metadata.missingFile).length;

    if (store) {
      await store.save({
        id: noteId,
        title: String(row.title || '').trim() || '无标题笔记',
        body,
        notebookId,
        tags: parseTags(row.tags),
        tasks: [],
        attachments,
        shortcut: false,
        reminderAt: null,
        status: 'active',
        createdAt: isoFromYinxiangDay(row.date_created) || new Date().toISOString(),
        updatedAt: isoFromYinxiangDay(row.date_updated) || isoFromYinxiangDay(row.date_created) || new Date().toISOString()
      });
    }
    stats.imported += 1;
  }

  exb.close();
  if (db) db.close?.();

  return {
    ok: true,
    dryRun,
    source,
    workspaceId,
    replaceWorkspace,
    importedNotes: stats.imported,
    bodyReadable: stats.bodyReadable,
    bodyMissing: stats.bodyMissing,
    importedNotebooks: stats.notebooks.size,
    importedAttachments: stats.attachments,
    attachmentFilesFound: stats.attachmentFilesFound,
    attachmentFilesMissing: stats.attachmentFilesMissing
  };
}

function readAttachments(exb, noteUid, options) {
  const rows = exb.prepare(`
    select
      r.uid,
      r.mime,
      r.file_name,
      r.size,
      r.hash,
      r.date_created,
      d.data as inline_data
    from resource_attr r
    left join resources d on d.uid = r.uid
    where r.note = ? and ifnull(r.is_deleted, 0) = 0
    order by r.uid
  `).all(noteUid);

  return rows.map((row) => {
    const id = `att_exb_${row.uid}`;
    const mime = String(row.mime || 'application/octet-stream');
    const hash = String(row.hash || '').toLowerCase();
    const storageKey = [
      safePathSegment(options.workspaceId),
      safePathSegment(options.noteId),
      `${safePathSegment(id)}${extensionForMime(mime)}`
    ].join('/');
    const metadata = {
      mime,
      resourceHash: hash,
      originalName: String(row.file_name || id),
      source: 'yinxiang.exb'
    };
    if (!options.dryRun) {
      const outputPath = path.join(options.attachmentRoot, ...storageKey.split('/'));
      const copied = writeAttachmentPayload(outputPath, row.inline_data, {
        externalAttachmentRoot: options.externalAttachmentRoot,
        noteUid,
        hash
      });
      if (copied) {
        metadata.storageKey = storageKey;
      } else {
        metadata.missingFile = true;
      }
    } else if (row.inline_data || findExternalAttachmentPath(options.externalAttachmentRoot, noteUid, hash)) {
      metadata.storageKey = storageKey;
    } else {
      metadata.missingFile = true;
    }
    return {
      id,
      name: String(row.file_name || id),
      kind: attachmentKind(mime),
      size: Number(row.size || byteLength(row.inline_data) || 0),
      metadata,
      createdAt: isoFromYinxiangDay(row.date_created) || new Date().toISOString()
    };
  });
}

function writeAttachmentPayload(outputPath, inlineData, options) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const inline = bufferFromSqlite(inlineData);
  if (inline && inline.length) {
    fs.writeFileSync(outputPath, inline);
    return true;
  }
  const external = findExternalAttachmentPath(options.externalAttachmentRoot, options.noteUid, options.hash);
  if (external) {
    fs.copyFileSync(external, outputPath);
    return true;
  }
  return false;
}

function findExternalAttachmentPath(root, noteUid, hash) {
  if (!root || !hash) return '';
  const direct = path.join(root, String(noteUid), hash);
  if (fs.existsSync(direct)) return direct;
  const folder = path.join(root, String(noteUid));
  if (!fs.existsSync(folder)) return '';
  const match = fs.readdirSync(folder).find((name) => name.toLowerCase().startsWith(hash));
  return match ? path.join(folder, match) : '';
}

function extractEnml(value) {
  const buffer = bufferFromSqlite(value);
  if (!buffer || !buffer.length) return '';
  const text = buffer.toString('utf8');
  const xmlStart = text.indexOf('<?xml');
  const noteStart = text.indexOf('<en-note');
  const start = xmlStart >= 0 ? xmlStart : noteStart;
  return start >= 0 ? text.slice(start).trim() : text.trim();
}

function readableBody(body) {
  return String(body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length > 0;
}

function bufferFromSqlite(value) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return Buffer.from(String(value), 'utf8');
}

function byteLength(value) {
  const buffer = bufferFromSqlite(value);
  return buffer ? buffer.length : 0;
}

function isoFromYinxiangDay(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '';
  const unixMs = (number - 719163) * 86400000;
  const date = new Date(unixMs);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function parseTags(value) {
  return String(value || '')
    .split(/[,;\n\r]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function ensureImportWorkspace(db, id) {
  const hermesId = id.startsWith('note:') ? id.slice(5) : id;
  const now = new Date().toISOString();
  db.prepare(`
    insert into plugin_workspaces (
      workspace_id,
      hermes_workspace_id,
      display_name,
      access_key_hash,
      scopes_json,
      status,
      created_at,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(workspace_id) do update set
      display_name = excluded.display_name,
      status = excluded.status,
      updated_at = excluded.updated_at
  `).run(
    id,
    hermesId,
    '印象笔记桌面库导入',
    hashRawKey(`unbound-import-workspace:${id}`),
    JSON.stringify(['notes:read', 'notes:write', 'notes:search']),
    'imported_unbound',
    now,
    now
  );
}

function clearWorkspace(db, workspaceId) {
  db.exec('begin immediate');
  try {
    db.prepare('delete from attachments where workspace_id = ?').run(workspaceId);
    db.prepare('delete from notes where workspace_id = ?').run(workspaceId);
    db.prepare('delete from notebooks where workspace_id = ?').run(workspaceId);
    db.exec('commit');
  } catch (error) {
    db.exec('rollback');
    throw error;
  }
}

function attachmentKind(mime) {
  if (/^image\//.test(mime)) return 'image';
  if (/^audio\//.test(mime)) return 'audio';
  if (/pdf|document|word|excel|powerpoint|text/.test(mime)) return 'document';
  return 'file';
}

function extensionForMime(mime) {
  const value = String(mime || '').toLowerCase();
  if (value === 'image/jpeg') return '.jpg';
  if (value === 'image/png') return '.png';
  if (value === 'image/gif') return '.gif';
  if (value === 'image/webp') return '.webp';
  if (value === 'application/pdf') return '.pdf';
  if (value === 'text/plain') return '.txt';
  return '.bin';
}

function safePathSegment(value) {
  return String(value || 'item').replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 96) || 'item';
}

function shortHash(value, length = 16) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex').slice(0, length);
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--source') parsed.source = args[++index];
    else if (arg === '--workspace-id') parsed.workspaceId = args[++index];
    else if (arg === '--db') parsed.db = args[++index];
    else if (arg === '--attachment-root') parsed.attachmentRoot = args[++index];
    else if (arg === '--external-attachment-root') parsed.externalAttachmentRoot = args[++index];
    else if (arg === '--replace-workspace') parsed.replaceWorkspace = true;
    else if (arg === '--dry-run') parsed.dryRun = true;
  }
  return parsed;
}

if (require.main === module) {
  main().then((result) => {
    console.log(JSON.stringify(result, null, 2));
  }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  extractEnml,
  isoFromYinxiangDay,
  main,
  parseTags
};
