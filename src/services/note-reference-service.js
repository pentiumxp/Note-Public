'use strict';

const { ALLOWED_RELATIONS, graphError } = require('./reference-graph-service');

function createNoteReferenceService({ noteStore, graphService }) {
  if (!noteStore) {
    throw new Error('noteStore is required');
  }
  if (!graphService) {
    throw new Error('graphService is required');
  }

  async function linkCreate(input) {
    const note = await requireNote(input.note_id || input.noteId);
    const sourceRef = graphService.objectRefUpsert(noteObjectRef(note));
    const targetRefInput = targetObjectRef(input);
    const targetRef = shouldPreserveExistingTargetSnapshot(input, targetRefInput)
      ? graphService.objectRefGet(targetRefInput) || graphService.objectRefUpsert(targetRefInput)
      : graphService.objectRefUpsert(targetRefInput);
    const edge = graphService.edgeCreate({
      source: { kind: 'object_ref', id: sourceRef.ref_id },
      target: { kind: 'object_ref', id: targetRef.ref_id },
      relation: input.relation || input.relation_type,
      event_key: input.event_key || input.eventKey || '',
      confidence: input.confidence,
      created_by: input.created_by || input.createdBy || 'hermes',
      idempotency_key: input.idempotency_key || input.idempotencyKey || '',
      metadata: {
        label: boundedText(input.label || '', 160)
      }
    });
    return { link: linkDto(edge, sourceRef, targetRef, note) };
  }

  async function linksList(noteId, options = {}) {
    const note = await requireNote(noteId);
    const noteRef = graphService.objectRefGet({ plugin_id: 'note', object_type: 'note', object_id: note.id });
    if (!noteRef) {
      return { links: [] };
    }
    const edges = graphService.edgesList({
      source: { kind: 'object_ref', id: noteRef.ref_id },
      relation: options.relation,
      limit: options.limit
    });
    const targetPluginId = String(options.target_plugin_id || options.targetPluginId || '').trim();
    const links = [];
    for (const edge of edges) {
      const target = graphService.objectRefGetById(edge.target.id);
      if (!target) {
        continue;
      }
      if (targetPluginId && target.plugin_id !== targetPluginId) {
        continue;
      }
      links.push(linkDto(edge, noteRef, target, note));
    }
    return { links };
  }

  async function backlinksList(input) {
    const target = graphService.objectRefGet({
      plugin_id: input.plugin_id || input.pluginId,
      object_type: input.object_type || input.objectType,
      object_id: input.object_id || input.objectId
    });
    if (!target) {
      return { links: [], notes: [] };
    }
    const edges = graphService.backlinksList({
      plugin_id: target.plugin_id,
      object_type: target.object_type,
      object_id: target.object_id,
      relation: input.relation,
      limit: input.limit
    });
    const links = [];
    const notes = [];
    const seen = new Set();
    for (const edge of edges) {
      const source = graphService.objectRefGetById(edge.source.id);
      if (!source || source.plugin_id !== 'note' || source.object_type !== 'note') {
        continue;
      }
      const note = await noteStore.get(source.object_id);
      if (!note) {
        continue;
      }
      links.push(linkDto(edge, source, target, note));
      if (!seen.has(note.id)) {
        notes.push(noteReferenceProjection(note));
        seen.add(note.id);
      }
    }
    return { links, notes };
  }

  function linkDelete(linkId) {
    return graphService.edgeDelete(linkId);
  }

  function referenceObjectTypes() {
    return {
      object_types: [{
        plugin_id: 'note',
        object_type: 'note',
        id_field: 'note_id',
        relations: [...ALLOWED_RELATIONS],
        summary: 'Free-form Note memory entry with bounded metadata and attachments summary.'
      }]
    };
  }

  async function referenceGet(objectType, objectId) {
    if (String(objectType || '') !== 'note') {
      throw graphError('REFERENCE_OBJECT_TYPE_UNSUPPORTED', 'Unsupported Note reference object type', 400);
    }
    const note = await requireNote(objectId);
    return {
      object: noteReferenceProjection(note)
    };
  }

  async function referenceSummarize(objectType, objectId, purpose = '') {
    const result = await referenceGet(objectType, objectId);
    return {
      summary: {
        ...result.object,
        purpose: boundedText(purpose, 120)
      }
    };
  }

  async function requireNote(noteId) {
    const id = requiredText(noteId, 'note_id');
    const note = await noteStore.get(id);
    if (!note) {
      throw graphError('NOTE_NOT_FOUND', 'Note not found', 404);
    }
    return note;
  }

  return {
    backlinksList,
    linkCreate,
    linkDelete,
    linksList,
    referenceGet,
    referenceObjectTypes,
    referenceSummarize
  };
}

function shouldPreserveExistingTargetSnapshot(input, targetRefInput) {
  const hasDisplay = Boolean(input.display_snapshot || input.displaySnapshot || input.label);
  return !hasDisplay && targetRefInput.display.title === targetRefInput.object_id;
}

function noteObjectRef(note) {
  return {
    plugin_id: 'note',
    object_type: 'note',
    object_id: note.id,
    display: noteDisplay(note),
    permission_scope: { owner: 'workspace' }
  };
}

function targetObjectRef(input) {
  const display = input.display_snapshot || input.displaySnapshot || {};
  const label = boundedText(input.label || '', 160);
  return {
    plugin_id: requiredText(input.target_plugin_id || input.targetPluginId || input.plugin_id || input.pluginId, 'target_plugin_id'),
    object_type: requiredText(input.target_object_type || input.targetObjectType || input.object_type || input.objectType, 'target_object_type'),
    object_id: requiredText(input.target_object_id || input.targetObjectId || input.object_id || input.objectId, 'target_object_id'),
    display: {
      title: boundedText(display.title || label || input.target_object_id || input.targetObjectId, 160),
      subtitle: boundedText(display.subtitle || '', 240),
      time: boundedText(display.time || '', 80),
      thumbnail_hint: boundedText(display.thumbnail_hint || display.thumbnailHint || '', 80)
    },
    permission_scope: { owner: 'target_plugin' }
  };
}

function noteDisplay(note) {
  return {
    title: boundedText(note.title || 'Untitled note', 160),
    subtitle: noteSummaryText(note, 180),
    time: note.updatedAt || note.createdAt || '',
    thumbnail_hint: (note.attachments || []).some((attachment) => attachment.kind === 'image') ? 'image' : ''
  };
}

function linkDto(edge, sourceRef, targetRef, note) {
  return {
    link_id: edge.edge_id,
    workspace_id: edge.workspace_id,
    note_id: note?.id || (sourceRef.plugin_id === 'note' ? sourceRef.object_id : ''),
    relation: edge.relation_type,
    event_key: edge.event_key || '',
    confidence: edge.confidence,
    created_by: edge.created_by,
    created_at: edge.created_at,
    source: refDto(sourceRef),
    target: refDto(targetRef),
    note: note ? noteReferenceProjection(note) : undefined
  };
}

function refDto(ref) {
  return {
    plugin_id: ref.plugin_id,
    object_type: ref.object_type,
    object_id: ref.object_id,
    display: ref.display,
    snapshot_time: ref.snapshot_time
  };
}

function noteReferenceProjection(note) {
  return {
    workspace_id: note.workspaceId || '',
    plugin_id: 'note',
    object_type: 'note',
    object_id: note.id,
    note_id: note.id,
    title: boundedText(note.title || '', 160),
    summary: noteSummaryText(note, 500),
    tags: (note.tags || []).slice(0, 20).map((tag) => boundedText(tag, 60)),
    notebook_id: note.notebookId || 'inbox',
    updated_at: note.updatedAt || '',
    created_at: note.createdAt || '',
    attachment_count: (note.attachments || []).length
  };
}

function noteSummaryText(note, max) {
  return boundedText(String(note.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), max);
}

function requiredText(value, field) {
  const text = String(value || '').trim();
  if (!text) {
    throw graphError('REFERENCE_FIELD_REQUIRED', `${field} is required`, 400);
  }
  return text;
}

function boundedText(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

module.exports = {
  createNoteReferenceService
};
