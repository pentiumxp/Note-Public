'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MAX_MCP_ATTACHMENTS = 8;
const MAX_MCP_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_KINDS = new Set(['image', 'document', 'audio', 'file']);
const FORBIDDEN_ATTACHMENT_FIELDS = new Set([
  'path',
  'file',
  'filePath',
  'file_path',
  'localPath',
  'local_path',
  'url',
  'workspace',
  'workspace_id',
  'access_key',
  'key',
  'token',
  'launch',
  'storageKey',
  'storage_key'
]);

function materializeMcpAttachments(input, options = {}) {
  if (input == null) {
    return [];
  }
  if (!Array.isArray(input)) {
    throw attachmentError('NOTE_ATTACHMENT_INVALID', 'Attachments must be an array', 400);
  }
  if (input.length > MAX_MCP_ATTACHMENTS) {
    throw attachmentError('NOTE_ATTACHMENT_TOO_MANY', 'Too many attachments', 400);
  }
  const workspaceId = requireWorkspaceId(options.workspaceId);
  const noteId = requireId(options.noteId, 'noteId');
  const root = path.resolve(options.attachmentRoot || path.join(process.cwd(), 'data', 'attachments'));
  const now = options.clock || (() => new Date().toISOString());
  const nextId = options.idGenerator || (() => crypto.randomUUID());
  const prepared = input.map((rawAttachment, index) => prepareAttachment(rawAttachment, { index, now, nextId }));
  const attachments = prepared.map((attachment) => writePreparedAttachment(attachment, {
    root,
    workspaceId
  }));

  if (options.attachmentStore) {
    for (const attachment of attachments) {
      recordAttachmentAsset(options.attachmentStore, attachment, { workspaceId, noteId });
    }
  }
  return attachments;
}

function prepareAttachment(rawAttachment, options) {
  const source = normalizeAttachmentInput(rawAttachment);
  const createdAt = options.now();
  const id = makeAttachmentId(options.nextId, options.index);
  const payload = readPayload(source);
  const mime = normalizeMime(source.mime || payload.mime || '', source.name);
  const kind = normalizeKind(source.kind, mime, source.name);
  const metadata = {
    mime,
    originalName: source.name,
    source: 'mcp'
  };
  let bytes = null;
  let size = Number(source.size || 0);

  if (payload.base64) {
    bytes = decodeBase64Payload(payload.base64);
    if (bytes.length === 0) {
      throw attachmentError('NOTE_ATTACHMENT_EMPTY', 'Attachment payload is empty', 400);
    }
    if (bytes.length > MAX_MCP_ATTACHMENT_BYTES) {
      throw attachmentError('NOTE_ATTACHMENT_TOO_LARGE', 'Attachment payload is too large', 413);
    }
    size = bytes.length;
  } else {
    metadata.missingFile = true;
  }
  return {
    id,
    name: source.name,
    kind,
    size,
    metadata,
    createdAt,
    bytes
  };
}

function writePreparedAttachment(prepared, options) {
  const attachment = {
    id: prepared.id,
    name: prepared.name,
    kind: prepared.kind,
    size: prepared.size,
    metadata: { ...prepared.metadata },
    createdAt: prepared.createdAt
  };
  if (!prepared.bytes) {
    return attachment;
  }
  const sha256 = crypto.createHash('sha256').update(prepared.bytes).digest('hex');
  const storageKey = [
    safePathSegment(options.workspaceId),
    sha256.slice(0, 2),
    `${sha256}${extensionForMime(attachment.metadata.mime, prepared.name)}`
  ].join('/');
  writeContentAddressedFile(options.root, storageKey, prepared.bytes);
  attachment.metadata.storageKey = storageKey;
  attachment.metadata.sha256 = sha256;
  attachment.metadata.size = prepared.bytes.length;
  return attachment;
}

function recordAttachmentAsset(attachmentStore, attachment, options) {
  const metadata = attachment.metadata || {};
  const status = metadata.storageKey ? 'active' : 'missing';
  attachmentStore.saveAsset({
    workspaceId: options.workspaceId,
    noteId: options.noteId,
    attachmentId: attachment.id,
    name: attachment.name,
    kind: attachment.kind,
    size: Number(metadata.size || attachment.size || 0),
    mime: metadata.mime || 'application/octet-stream',
    storageKey: metadata.storageKey || '',
    sha256: metadata.sha256 || '',
    sourceHash: metadata.sha256 || '',
    status,
    createdAt: attachment.createdAt,
    updatedAt: attachment.createdAt
  });
}

function recordMcpAttachmentAssets(attachments, options = {}) {
  if (!options.attachmentStore || !Array.isArray(attachments) || attachments.length === 0) {
    return;
  }
  const workspaceId = requireWorkspaceId(options.workspaceId);
  const noteId = requireId(options.noteId, 'noteId');
  for (const attachment of attachments) {
    recordAttachmentAsset(options.attachmentStore, attachment, { workspaceId, noteId });
  }
}

function normalizeAttachmentInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw attachmentError('NOTE_ATTACHMENT_INVALID', 'Attachment must be an object', 400);
  }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_ATTACHMENT_FIELDS.has(key)) {
      throw attachmentError('NOTE_ATTACHMENT_FIELD_FORBIDDEN', 'Attachment field is forbidden', 400);
    }
  }
  const name = String(value.name || '').trim().slice(0, 240);
  if (!name) {
    throw attachmentError('NOTE_ATTACHMENT_NAME_REQUIRED', 'Attachment name is required', 400);
  }
  return {
    name,
    kind: value.kind,
    mime: value.mime || value.type || '',
    size: Number(value.size || 0),
    data_base64: value.data_base64,
    content_base64: value.content_base64,
    base64: value.base64
  };
}

function readPayload(source) {
  const raw = source.data_base64 || source.content_base64 || source.base64;
  if (raw == null || raw === '') {
    return { base64: '', mime: '' };
  }
  const text = String(raw).trim();
  const dataUrl = /^data:([^;,]+);base64,(.*)$/is.exec(text);
  if (dataUrl) {
    return { mime: dataUrl[1], base64: dataUrl[2] };
  }
  return { base64: text, mime: '' };
}

function decodeBase64Payload(value) {
  const compact = String(value || '').replace(/\s+/g, '');
  const maxBase64Chars = Math.ceil(MAX_MCP_ATTACHMENT_BYTES / 3) * 4 + 16;
  if (compact.length > maxBase64Chars) {
    throw attachmentError('NOTE_ATTACHMENT_TOO_LARGE', 'Attachment payload is too large', 413);
  }
  if (!compact || compact.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
    throw attachmentError('NOTE_ATTACHMENT_BASE64_INVALID', 'Attachment payload must be base64', 400);
  }
  return Buffer.from(compact, 'base64');
}

function writeContentAddressedFile(root, storageKey, bytes) {
  const outputPath = path.resolve(root, ...storageKey.split('/'));
  if (!isInside(root, outputPath)) {
    throw attachmentError('NOTE_ATTACHMENT_PATH_INVALID', 'Attachment path is invalid', 400);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (fs.existsSync(outputPath)) {
    return outputPath;
  }
  const tempPath = `${outputPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, bytes);
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(tempPath);
  } else {
    fs.renameSync(tempPath, outputPath);
  }
  return outputPath;
}

function normalizeMime(value, name) {
  const mime = String(value || '').split(';')[0].trim().toLowerCase();
  if (/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/.test(mime)) {
    return mime;
  }
  return mimeFromName(name) || 'application/octet-stream';
}

function normalizeKind(value, mime, name) {
  const explicit = String(value || '').trim().toLowerCase();
  if (ALLOWED_KINDS.has(explicit)) {
    return explicit;
  }
  return inferKind(mime, name);
}

function inferKind(mime, name) {
  const normalizedMime = String(mime || '').toLowerCase();
  const normalizedName = String(name || '').toLowerCase();
  if (normalizedMime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)$/.test(normalizedName)) {
    return 'image';
  }
  if (normalizedMime.startsWith('audio/') || /\.(mp3|m4a|wav|aac|ogg)$/.test(normalizedName)) {
    return 'audio';
  }
  if (/pdf|document|word|excel|spreadsheet|powerpoint|presentation|text/.test(normalizedMime)
    || /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md|rtf)$/.test(normalizedName)) {
    return 'document';
  }
  return 'file';
}

function extensionForMime(mime, name) {
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
  const ext = path.extname(String(name || '')).toLowerCase();
  return /^[.][a-z0-9]{1,8}$/.test(ext) ? ext : '.bin';
}

function mimeFromName(name) {
  const ext = path.extname(String(name || '')).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === '.xls') return 'application/vnd.ms-excel';
  if (ext === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (ext === '.ppt') return 'application/vnd.ms-powerpoint';
  if (ext === '.pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (ext === '.txt' || ext === '.md') return 'text/plain';
  return '';
}

function makeAttachmentId(nextId, index) {
  return `att_${safePathSegment(nextId() || `mcp_${index + 1}`).slice(0, 80)}`;
}

function safePathSegment(value) {
  return String(value || 'item').replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 96) || 'item';
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function requireWorkspaceId(value) {
  const workspaceId = String(value || '');
  if (!workspaceId.startsWith('note:')) {
    throw attachmentError('NOTE_WORKSPACE_INVALID', 'Workspace id is invalid', 400);
  }
  return workspaceId;
}

function requireId(value, name) {
  const id = String(value || '');
  if (!id) {
    throw attachmentError('NOTE_ATTACHMENT_INVALID', `${name} is required`, 400);
  }
  return id;
}

function attachmentError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

module.exports = {
  MAX_MCP_ATTACHMENTS,
  MAX_MCP_ATTACHMENT_BYTES,
  materializeMcpAttachments,
  recordMcpAttachmentAssets
};
