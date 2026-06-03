'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function openAttachmentDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  ensureAttachmentSchema(db);
  return db;
}

function ensureAttachmentSchema(db) {
  db.exec(`
    create table if not exists attachment_blobs (
      sha256 text primary key,
      size integer not null,
      mime text not null,
      storage_key text not null,
      status text not null,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists attachment_objects (
      id text primary key,
      workspace_id text not null,
      note_id text not null,
      attachment_id text not null,
      name text not null,
      kind text not null,
      blob_sha256 text,
      source_hash text,
      status text not null,
      created_at text not null,
      updated_at text not null,
      foreign key (blob_sha256) references attachment_blobs(sha256),
      unique(workspace_id, attachment_id)
    );

    create table if not exists attachment_integrity_checks (
      id text primary key,
      workspace_id text not null,
      blob_sha256 text not null,
      storage_key text not null,
      result text not null,
      checked_at text not null,
      details_json text not null
    );

    create index if not exists idx_attachment_objects_workspace_note
      on attachment_objects(workspace_id, note_id);
    create index if not exists idx_attachment_objects_workspace_status
      on attachment_objects(workspace_id, status);
    create index if not exists idx_attachment_blobs_status
      on attachment_blobs(status);
  `);
}

function createSqliteAttachmentStore({ db, idGenerator = defaultId }) {
  return {
    saveAsset(asset) {
      requireWorkspaceId(asset.workspaceId);
      const now = asset.updatedAt || new Date().toISOString();
      db.exec('begin immediate');
      try {
        if (asset.sha256 && asset.storageKey) {
          db.prepare(`
            insert into attachment_blobs (sha256, size, mime, storage_key, status, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?)
            on conflict(sha256) do update set
              size = excluded.size,
              mime = excluded.mime,
              storage_key = excluded.storage_key,
              status = excluded.status,
              updated_at = excluded.updated_at
          `).run(
            asset.sha256,
            Number(asset.size || 0),
            asset.mime || 'application/octet-stream',
            asset.storageKey,
            asset.status || 'active',
            asset.createdAt || now,
            now
          );
        }

        db.prepare(`
          insert into attachment_objects (
            id,
            workspace_id,
            note_id,
            attachment_id,
            name,
            kind,
            blob_sha256,
            source_hash,
            status,
            created_at,
            updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(workspace_id, attachment_id) do update set
            note_id = excluded.note_id,
            name = excluded.name,
            kind = excluded.kind,
            blob_sha256 = excluded.blob_sha256,
            source_hash = excluded.source_hash,
            status = excluded.status,
            updated_at = excluded.updated_at
        `).run(
          asset.objectId || idGenerator(),
          asset.workspaceId,
          asset.noteId,
          asset.attachmentId,
          asset.name || asset.attachmentId,
          asset.kind || 'file',
          asset.sha256 || null,
          asset.sourceHash || null,
          asset.status || (asset.sha256 ? 'active' : 'missing'),
          asset.createdAt || now,
          now
        );
        db.exec('commit');
      } catch (error) {
        db.exec('rollback');
        throw error;
      }
    },

    getObject(workspaceId, attachmentId) {
      requireWorkspaceId(workspaceId);
      const row = db.prepare(`
        select
          o.id,
          o.workspace_id,
          o.note_id,
          o.attachment_id,
          o.name,
          o.kind,
          o.blob_sha256,
          o.source_hash,
          o.status,
          o.created_at,
          o.updated_at,
          b.size,
          b.mime,
          b.storage_key
        from attachment_objects o
        left join attachment_blobs b on b.sha256 = o.blob_sha256
        where o.workspace_id = ? and o.attachment_id = ?
      `).get(workspaceId, attachmentId);
      return row ? objectFromRow(row) : null;
    },

    listObjects(workspaceId) {
      requireWorkspaceId(workspaceId);
      return db.prepare(`
        select
          o.id,
          o.workspace_id,
          o.note_id,
          o.attachment_id,
          o.name,
          o.kind,
          o.blob_sha256,
          o.source_hash,
          o.status,
          o.created_at,
          o.updated_at,
          b.size,
          b.mime,
          b.storage_key
        from attachment_objects o
        left join attachment_blobs b on b.sha256 = o.blob_sha256
        where o.workspace_id = ?
        order by o.created_at asc
      `).all(workspaceId).map(objectFromRow);
    },

    clearWorkspace(workspaceId) {
      requireWorkspaceId(workspaceId);
      db.prepare('delete from attachment_objects where workspace_id = ?').run(workspaceId);
    },

    recordIntegrityCheck(record) {
      requireWorkspaceId(record.workspaceId);
      db.prepare(`
        insert into attachment_integrity_checks (
          id,
          workspace_id,
          blob_sha256,
          storage_key,
          result,
          checked_at,
          details_json
        ) values (?, ?, ?, ?, ?, ?, ?)
      `).run(
        record.id || idGenerator(),
        record.workspaceId,
        record.sha256,
        record.storageKey,
        record.result,
        record.checkedAt || new Date().toISOString(),
        JSON.stringify(record.details || {})
      );
    }
  };
}

function objectFromRow(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    noteId: row.note_id,
    attachmentId: row.attachment_id,
    name: row.name,
    kind: row.kind,
    sha256: row.blob_sha256 || '',
    sourceHash: row.source_hash || '',
    status: row.status,
    size: Number(row.size || 0),
    mime: row.mime || '',
    storageKey: row.storage_key || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function requireWorkspaceId(workspaceId) {
  if (!workspaceId || typeof workspaceId !== 'string' || !workspaceId.startsWith('note:')) {
    throw new Error('workspaceId must use note:<hermes_workspace_id>');
  }
}

function defaultId() {
  return `asset_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

module.exports = {
  createSqliteAttachmentStore,
  ensureAttachmentSchema,
  openAttachmentDatabase
};
