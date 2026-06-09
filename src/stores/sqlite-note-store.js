'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { ensureReferenceGraphSchema } = require('./sqlite-reference-graph-store');

function openNoteDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  ensureSchema(db);
  return db;
}

function ensureSchema(db) {
  db.exec(`
    create table if not exists plugin_workspaces (
      workspace_id text primary key,
      hermes_workspace_id text not null,
      display_name text not null,
      access_key_hash text not null,
      scopes_json text not null,
      status text not null,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists launch_tokens (
      token text primary key,
      workspace_id text not null,
      expires_at text not null,
      created_at text not null default (datetime('now')),
      foreign key (workspace_id) references plugin_workspaces(workspace_id)
    );

    create table if not exists notes (
      id text primary key,
      workspace_id text not null,
      title text not null,
      body text not null,
      notebook_id text not null,
      tags_json text not null,
      tasks_json text not null,
      shortcut integer not null default 0,
      reminder_at text,
      status text not null,
      created_at text not null,
      updated_at text not null,
      deleted_at text
    );

    create table if not exists notebooks (
      id text not null,
      workspace_id text not null,
      name text not null,
      source text,
      created_at text not null,
      updated_at text not null,
      primary key (workspace_id, id),
      unique(workspace_id, name)
    );

    create table if not exists attachments (
      id text primary key,
      workspace_id text not null,
      note_id text not null,
      name text not null,
      kind text not null,
      size integer not null default 0,
      metadata_json text not null,
      created_at text not null,
      foreign key (note_id) references notes(id)
    );

  `);
  ensureNotebookWorkspacePrimaryKey(db);
  db.exec(`
    create index if not exists idx_notes_workspace_updated on notes(workspace_id, updated_at desc);
    create index if not exists idx_notes_workspace_deleted on notes(workspace_id, deleted_at);
    create index if not exists idx_attachments_workspace_note on attachments(workspace_id, note_id);
    create index if not exists idx_notebooks_workspace_name on notebooks(workspace_id, name);
  `);
  ensureReferenceGraphSchema(db);
}

function ensureNotebookWorkspacePrimaryKey(db) {
  const columns = db.prepare('pragma table_info(notebooks)').all();
  const workspacePk = columns.find((column) => column.name === 'workspace_id')?.pk || 0;
  const idPk = columns.find((column) => column.name === 'id')?.pk || 0;
  if (workspacePk > 0 && idPk > 0) {
    return;
  }

  db.exec('begin immediate');
  try {
    db.exec(`
      create table notebooks_workspace_scoped (
        id text not null,
        workspace_id text not null,
        name text not null,
        source text,
        created_at text not null,
        updated_at text not null,
        primary key (workspace_id, id),
        unique(workspace_id, name)
      );

      insert into notebooks_workspace_scoped (id, workspace_id, name, source, created_at, updated_at)
      select id, workspace_id, name, source, created_at, updated_at
      from notebooks;

      drop table notebooks;
      alter table notebooks_workspace_scoped rename to notebooks;
    `);
    db.exec('commit');
  } catch (error) {
    db.exec('rollback');
    throw error;
  }
}

function upsertNotebook(db, notebook) {
  db.prepare(`
    insert into notebooks (id, workspace_id, name, source, created_at, updated_at)
    values (?, ?, ?, ?, ?, ?)
    on conflict(workspace_id, name) do update set
      source = excluded.source,
      updated_at = excluded.updated_at
  `).run(
    notebook.id,
    notebook.workspace_id,
    notebook.name,
    notebook.source || null,
    notebook.created_at,
    notebook.updated_at
  );
  const row = db.prepare(`
    select id, workspace_id, name, source, created_at, updated_at
    from notebooks
    where workspace_id = ? and name = ?
  `).get(notebook.workspace_id, notebook.name);
  return { ...row };
}

function createSqliteHermesWorkspaceStore(db) {
  return {
    async saveWorkspace(workspace) {
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
          hermes_workspace_id = excluded.hermes_workspace_id,
          display_name = excluded.display_name,
          access_key_hash = excluded.access_key_hash,
          scopes_json = excluded.scopes_json,
          status = excluded.status,
          updated_at = excluded.updated_at
      `).run(
        workspace.workspace_id,
        workspace.hermes_workspace_id,
        workspace.display_name,
        workspace.access_key_hash,
        JSON.stringify(workspace.scopes || []),
        workspace.status,
        workspace.created_at,
        workspace.updated_at
      );
      return { ...workspace };
    },

    async getWorkspace(workspaceId) {
      const row = db.prepare(`
        select workspace_id, hermes_workspace_id, display_name, access_key_hash, scopes_json, status, created_at, updated_at
        from plugin_workspaces
        where workspace_id = ?
      `).get(workspaceId);
      return row ? workspaceFromRow(row) : null;
    }
  };
}

function createSqliteLaunchTokenStore(db) {
  return {
    async saveLaunchToken(record) {
      db.prepare(`
        insert into launch_tokens (token, workspace_id, expires_at)
        values (?, ?, ?)
      `).run(record.token, record.workspace_id, record.expires_at);
      return { ...record };
    },

    async getLaunchToken(token) {
      const row = db.prepare(`
        select token, workspace_id, expires_at
        from launch_tokens
        where token = ?
      `).get(token);
      return row ? { ...row } : null;
    }
  };
}

function createSqliteNoteStore({ db, workspaceId }) {
  requireWorkspaceId(workspaceId);

  return {
    async save(note) {
      const timestamp = note.updatedAt || new Date().toISOString();
      db.exec('begin immediate');
      try {
        db.prepare(`
          insert into notes (
            id,
            workspace_id,
            title,
            body,
            notebook_id,
            tags_json,
            tasks_json,
            shortcut,
            reminder_at,
            status,
            created_at,
            updated_at,
            deleted_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(id) do update set
            title = excluded.title,
            body = excluded.body,
            notebook_id = excluded.notebook_id,
            tags_json = excluded.tags_json,
            tasks_json = excluded.tasks_json,
            shortcut = excluded.shortcut,
            reminder_at = excluded.reminder_at,
            status = excluded.status,
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at
          where notes.workspace_id = excluded.workspace_id
        `).run(
          note.id,
          workspaceId,
          note.title,
          note.body,
          note.notebookId || 'inbox',
          JSON.stringify(note.tags || []),
          JSON.stringify(note.tasks || []),
          note.shortcut ? 1 : 0,
          note.reminderAt || null,
          note.status || 'active',
          note.createdAt || timestamp,
          timestamp,
          note.status === 'trash' ? timestamp : null
        );
        db.prepare('delete from attachments where workspace_id = ? and note_id = ?').run(workspaceId, note.id);
        for (const attachment of note.attachments || []) {
          db.prepare(`
            insert into attachments (id, workspace_id, note_id, name, kind, size, metadata_json, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            attachment.id,
            workspaceId,
            note.id,
            attachment.name,
            attachment.kind || 'file',
            Number(attachment.size || 0),
            JSON.stringify(attachment.metadata || {}),
            attachment.createdAt || timestamp
          );
        }
        db.exec('commit');
      } catch (error) {
        db.exec('rollback');
        throw error;
      }
      return { ...note };
    },

    async get(id) {
      const row = db.prepare(`
        select id, workspace_id, title, body, notebook_id, tags_json, tasks_json, shortcut, reminder_at, status, created_at, updated_at
        from notes
        where workspace_id = ? and id = ?
      `).get(workspaceId, id);
      return row ? noteFromRow(db, workspaceId, row) : null;
    },

    async list() {
      const rows = db.prepare(`
        select id, workspace_id, title, body, notebook_id, tags_json, tasks_json, shortcut, reminder_at, status, created_at, updated_at
        from notes
        where workspace_id = ?
        order by updated_at desc
      `).all(workspaceId);
      return rows.map((row) => noteFromRow(db, workspaceId, row));
    },

    async remove(id) {
      const result = db.prepare('delete from notes where workspace_id = ? and id = ?').run(workspaceId, id);
      db.prepare('delete from attachments where workspace_id = ? and note_id = ?').run(workspaceId, id);
      return result.changes > 0;
    }
  };
}

function noteFromRow(db, workspaceId, row) {
  const attachments = db.prepare(`
    select id, name, kind, size, metadata_json, created_at
    from attachments
    where workspace_id = ? and note_id = ?
    order by created_at asc
  `).all(workspaceId, row.id).map((attachment) => ({
    id: attachment.id,
    name: attachment.name,
    kind: attachment.kind,
    size: attachment.size,
    metadata: safeJson(attachment.metadata_json, {}),
    createdAt: attachment.created_at
  }));

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    body: row.body,
    notebookId: row.notebook_id,
    tags: safeJson(row.tags_json, []),
    tasks: safeJson(row.tasks_json, []),
    attachments,
    shortcut: Boolean(row.shortcut),
    reminderAt: row.reminder_at || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function workspaceFromRow(row) {
  return {
    workspace_id: row.workspace_id,
    hermes_workspace_id: row.hermes_workspace_id,
    display_name: row.display_name,
    access_key_hash: row.access_key_hash,
    scopes: safeJson(row.scopes_json, []),
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function requireWorkspaceId(workspaceId) {
  if (!workspaceId || typeof workspaceId !== 'string' || !workspaceId.startsWith('note:')) {
    throw new Error('workspaceId must use note:<hermes_workspace_id>');
  }
}

module.exports = {
  createSqliteHermesWorkspaceStore,
  createSqliteLaunchTokenStore,
  createSqliteNoteStore,
  ensureSchema,
  openNoteDatabase,
  upsertNotebook
};
