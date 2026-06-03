'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  createSqliteNoteStore,
  openNoteDatabase,
  upsertNotebook
} = require('../src/stores/sqlite-note-store');
const { hashRawKey } = require('../src/services/hermes-plugin-service');

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const source = path.resolve(options.source || path.join(process.cwd(), 'imports', 'yinxiang'));
  const workspaceId = options.workspaceId || 'note:yinxiang_import';
  const dbPath = path.resolve(options.db || path.join(process.cwd(), 'data', 'note.sqlite3'));
  const attachmentRoot = path.resolve(options.attachmentRoot || path.join(process.cwd(), 'data', 'attachments'));
  const dryRun = Boolean(options.dryRun);

  if (!workspaceId.startsWith('note:')) {
    throw new Error('--workspace-id must use note:<id>');
  }

  const files = listNotesFiles(source);
  if (!files.length) {
    return {
      ok: true,
      dryRun,
      workspaceId,
      imported: 0,
      files: [],
      message: 'no .notes files found'
    };
  }

  const db = dryRun ? null : openNoteDatabase(dbPath);
  if (db) {
    ensureImportWorkspace(db, workspaceId);
  }

  const summary = [];
  for (const file of files) {
    const notebookName = path.basename(file, path.extname(file));
    const notebookId = `notebook_${shortHash(`${workspaceId}:${notebookName}`)}`;
    if (db) {
      upsertNotebook(db, {
        id: notebookId,
        workspace_id: workspaceId,
        name: notebookName,
        source: 'yinxiang.notes',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    const store = dryRun ? null : createSqliteNoteStore({ db, workspaceId });
    const fileSummary = await processNotesExportFile({
      file,
      notebookId,
      dryRun,
      store,
      attachmentRoot,
      workspaceId
    });

    summary.push({
      file: path.relative(process.cwd(), file),
      notebook: notebookName,
      notebookId,
      noteCount: fileSummary.noteCount,
      attachmentCount: fileSummary.attachmentCount
    });
  }

  return {
    ok: true,
    dryRun,
    workspaceId,
    dbPath: dryRun ? null : dbPath,
    attachmentRoot: dryRun ? null : attachmentRoot,
    importedFiles: summary.length,
    importedNotes: summary.reduce((count, item) => count + item.noteCount, 0),
    importedAttachments: summary.reduce((count, item) => count + item.attachmentCount, 0),
    files: summary
  };
}

function parseNotesExport(xml, context) {
  const notes = [];
  const notePattern = /<note\b[^>]*>([\s\S]*?)<\/note>/g;
  let match;
  let index = 0;
  while ((match = notePattern.exec(xml)) !== null) {
    index += 1;
    notes.push(parseNoteBlock(match[1], { ...context, index }));
  }
  return notes;
}

async function processNotesExportFile(options) {
  let carry = '';
  let noteCount = 0;
  let attachmentCount = 0;
  for await (const chunk of fs.createReadStream(options.file, { encoding: 'utf8', highWaterMark: 1024 * 1024 })) {
    carry += chunk;
    let progress = true;
    while (progress) {
      progress = false;
      const start = carry.search(/<note\b/i);
      if (start > 0) {
        carry = carry.slice(start);
      }
      if (start >= 0) {
        const end = carry.search(/<\/note>/i);
        if (end >= 0) {
          const openEnd = carry.indexOf('>');
          const block = carry.slice(openEnd + 1, end);
          noteCount += 1;
          const note = parseNoteBlock(block, {
            file: options.file,
            notebookId: options.notebookId,
            index: noteCount
          });
          attachmentCount += (note.attachments || []).length;
          if (!options.dryRun) {
            await options.store.save(materializeNoteAttachments(note, {
              attachmentRoot: options.attachmentRoot,
              workspaceId: options.workspaceId
            }));
          }
          carry = carry.slice(end + '</note>'.length);
          progress = true;
        }
      } else if (carry.length > 1024 * 1024) {
        carry = carry.slice(-1024);
      }
    }
  }
  return { noteCount, attachmentCount };
}

function parseNoteBlock(block, context) {
  const title = decodeXml(firstTag(block, 'title') || '无标题笔记').trim() || '无标题笔记';
  const content = extractContent(block);
  const createdAt = normalizeYinxiangDate(firstTag(block, 'created')) || new Date().toISOString();
  const updatedAt = normalizeYinxiangDate(firstTag(block, 'updated')) || createdAt;
  const sourceKey = `${path.basename(context.file)}:${context.index}:${title}:${createdAt}:${updatedAt}`;
  const tags = allTags(block, 'tag').map((tag) => decodeXml(tag).trim()).filter(Boolean);
  const attachments = parseResources(block, updatedAt, sourceKey);
  return {
    id: `yinxiang_${shortHash(sourceKey, 24)}`,
    title,
    body: content,
    notebookId: context.notebookId,
    tags: [...new Set(tags)],
    tasks: [],
    attachments,
    shortcut: false,
    reminderAt: null,
    status: 'active',
    createdAt,
    updatedAt
  };
}

function extractContent(block) {
  const contentBlock = firstTag(block, 'content') || '';
  const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(contentBlock.trim());
  return cdata ? cdata[1] : decodeXml(contentBlock);
}

function parseResources(block, timestamp, sourceKey) {
  const resources = [];
  const resourcePattern = /<resource\b[^>]*>([\s\S]*?)<\/resource>/g;
  let match;
  let index = 0;
  while ((match = resourcePattern.exec(block)) !== null) {
    index += 1;
    const resource = match[1];
    const mime = decodeXml(firstTag(resource, 'mime') || 'application/octet-stream');
    const dataBlock = firstTag(resource, 'data') || '';
    const fileName = decodeXml(firstTag(resource, 'file-name') || firstTag(resource, 'source-url') || `resource-${index}`);
    const cleanedData = dataBlock.replace(/\s+/g, '');
    const size = cleanedData.length;
    const resourceHash = cleanedData ? crypto.createHash('md5').update(Buffer.from(cleanedData, 'base64')).digest('hex') : '';
    resources.push({
      id: `att_${shortHash(`${sourceKey}:${fileName}:${mime}:${index}`, 18)}`,
      name: fileName,
      kind: attachmentKind(mime),
      size: Math.floor(size * 0.75),
      metadata: { mime, resourceHash },
      importDataBase64: dataBlock,
      createdAt: timestamp
    });
  }
  return resources;
}

function materializeNoteAttachments(note, options) {
  return {
    ...note,
    attachments: (note.attachments || []).map((attachment) => materializeAttachment(attachment, note, options))
  };
}

function materializeAttachment(attachment, note, options) {
  const cleanedBase64 = String(attachment.importDataBase64 || '').replace(/\s+/g, '');
  const storageKey = [
    safePathSegment(options.workspaceId),
    safePathSegment(note.id),
    `${safePathSegment(attachment.id)}${extensionForMime(attachment.metadata && attachment.metadata.mime)}`
  ].join('/');

  if (cleanedBase64) {
    const outputPath = path.join(options.attachmentRoot, ...storageKey.split('/'));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, Buffer.from(cleanedBase64, 'base64'));
  }

  const { importDataBase64, ...publicAttachment } = attachment;
  return {
    ...publicAttachment,
    metadata: {
      ...(publicAttachment.metadata || {}),
      originalName: publicAttachment.name,
      storageKey
    }
  };
}

function firstTag(block, tagName) {
  const pattern = new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`, 'i');
  const match = pattern.exec(block);
  return match ? match[1] : '';
}

function allTags(block, tagName) {
  const pattern = new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`, 'gi');
  const values = [];
  let match;
  while ((match = pattern.exec(block)) !== null) {
    values.push(match[1]);
  }
  return values;
}

function normalizeYinxiangDate(value) {
  const text = String(value || '').trim();
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(text);
  if (!match) {
    return '';
  }
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.000Z`;
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

function decodeXml(value) {
  return String(value || '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
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
    '印象笔记导入',
    hashRawKey(`unbound-import-workspace:${id}`),
    JSON.stringify(['notes:read', 'notes:write', 'notes:search']),
    'imported_unbound',
    now,
    now
  );
}

function listNotesFiles(input) {
  const stat = fs.statSync(input);
  if (stat.isFile()) {
    return [input];
  }
  return fs.readdirSync(input)
    .filter((name) => /\.notes$/i.test(name))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map((name) => path.join(input, name));
}

function shortHash(value, length = 16) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex').slice(0, length);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--source') parsed.source = args[++index];
    else if (arg === '--workspace-id') parsed.workspaceId = args[++index];
    else if (arg === '--db') parsed.db = args[++index];
    else if (arg === '--attachment-root') parsed.attachmentRoot = args[++index];
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
  attachmentKind,
  decodeXml,
  main,
  materializeNoteAttachments,
  normalizeYinxiangDate,
  processNotesExportFile,
  parseNotesExport
};
