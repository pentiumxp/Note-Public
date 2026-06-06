'use strict';

const ALLOWED_RELATIONS = new Set([
  'mentions',
  'same_event',
  'evidence_for',
  'created_from',
  'context_for',
  'followup_to'
]);

function createReferenceGraphService({ store, idGenerator, clock }) {
  if (!store) {
    throw new Error('store is required');
  }
  const nextId = idGenerator || (() => `ref_${Date.now()}`);
  const now = clock || (() => new Date().toISOString());

  function objectRefUpsert(input) {
    const ref = normalizeObjectRef(input, nextId, now);
    return store.upsertObjectRef(ref);
  }

  function objectRefGet(input) {
    return store.getObjectRefByIdentity(
      requiredText(input.plugin_id || input.pluginId, 'plugin_id'),
      requiredText(input.object_type || input.objectType, 'object_type'),
      requiredText(input.object_id || input.objectId, 'object_id')
    );
  }

  function objectRefGetById(refId) {
    return store.getObjectRefById(requiredText(refId, 'ref_id'));
  }

  function edgeCreate(input) {
    const edge = normalizeEdge(input, nextId, now);
    if (edge.idempotency_key && typeof store.getEdgeByIdempotency === 'function') {
      const existing = store.getEdgeByIdempotency(edge.idempotency_key);
      if (existing) {
        if (!sameEdgeIdentity(existing, edge)) {
          throw graphError('REFERENCE_IDEMPOTENCY_CONFLICT', 'Idempotency key was already used for a different reference edge', 409);
        }
        return existing;
      }
    }
    return store.saveEdge(edge);
  }

  function edgesList(filter = {}) {
    return store.listEdges(normalizeEdgeFilter(filter));
  }

  function backlinksList(input) {
    const pluginId = requiredText(input.plugin_id || input.pluginId, 'plugin_id');
    const objectType = requiredText(input.object_type || input.objectType, 'object_type');
    const objectId = requiredText(input.object_id || input.objectId, 'object_id');
    const target = store.getObjectRefByIdentity(pluginId, objectType, objectId);
    if (!target) {
      return [];
    }
    return store.listEdges({
      target: { kind: 'object_ref', id: target.ref_id },
      relation_type: optionalRelation(input.relation || input.relation_type),
      limit: input.limit
    });
  }

  function edgeDelete(edgeId) {
    const id = requiredText(edgeId, 'edge_id');
    const deleted = store.deleteEdge(id, now());
    if (!deleted) {
      throw graphError('REFERENCE_EDGE_NOT_FOUND', 'Reference edge not found', 404);
    }
    return { edge_id: id, deleted: true };
  }

  function eventUpsert(input) {
    const timestamp = now();
    return store.upsertEvent({
      event_id: input.event_id || input.eventId || nextId('event'),
      event_key: requiredText(input.event_key || input.eventKey, 'event_key'),
      title: boundedText(input.title || '', 160),
      time_start: input.time_start || input.timeStart || '',
      time_end: input.time_end || input.timeEnd || '',
      place_hint: boundedText(input.place_hint || input.placeHint || '', 120),
      summary: boundedText(input.summary || '', 500),
      metadata: boundedObject(input.metadata),
      created_at: input.created_at || timestamp,
      updated_at: timestamp
    });
  }

  function eventObjectsList(input) {
    const eventKey = requiredText(input.event_key || input.eventKey, 'event_key');
    return store.listEdges({ event_key: eventKey, limit: input.limit });
  }

  return {
    objectRefUpsert,
    objectRefGet,
    objectRefGetById,
    edgeCreate,
    edgesList,
    backlinksList,
    edgeDelete,
    eventUpsert,
    eventObjectsList
  };
}

function normalizeObjectRef(input, nextId, now) {
  const timestamp = now();
  const display = input.display || input.display_snapshot || input.displaySnapshot || {};
  return {
    ref_id: input.ref_id || input.refId || nextId('ref'),
    plugin_id: requiredText(input.plugin_id || input.pluginId, 'plugin_id'),
    object_type: requiredText(input.object_type || input.objectType, 'object_type'),
    object_id: requiredText(input.object_id || input.objectId, 'object_id'),
    display_title: boundedText(display.title || input.display_title || input.label || input.object_id || input.objectId, 160),
    display_subtitle: boundedText(display.subtitle || input.display_subtitle || '', 240),
    display_time: boundedText(display.time || input.display_time || '', 80),
    thumbnail_hint: boundedText(display.thumbnail_hint || display.thumbnailHint || input.thumbnail_hint || '', 80),
    snapshot_time: input.snapshot_time || timestamp,
    permission_scope: boundedObject(input.permission_scope || input.permissionScope),
    created_at: input.created_at || timestamp,
    updated_at: timestamp
  };
}

function normalizeEdge(input, nextId, now) {
  const timestamp = now();
  const source = normalizeEndpoint(input.source, 'source');
  const target = normalizeEndpoint(input.target, 'target');
  const relation = requiredRelation(input.relation_type || input.relation || input.relationType);
  return {
    edge_id: input.edge_id || input.edgeId || nextId('edge'),
    source_kind: source.kind,
    source_id: source.id,
    target_kind: target.kind,
    target_id: target.id,
    relation_type: relation,
    event_key: boundedText(input.event_key || input.eventKey || '', 180),
    confidence: boundedConfidence(input.confidence),
    created_by: boundedText(input.created_by || input.createdBy || 'hermes', 40),
    created_at: input.created_at || timestamp,
    metadata: boundedObject(input.metadata),
    provenance_id: boundedText(input.provenance_id || input.provenanceId || '', 160),
    idempotency_key: boundedText(input.idempotency_key || input.idempotencyKey || '', 240)
  };
}

function normalizeEdgeFilter(filter) {
  return {
    source: filter.source ? normalizeEndpoint(filter.source, 'source') : null,
    target: filter.target ? normalizeEndpoint(filter.target, 'target') : null,
    event_key: boundedText(filter.event_key || filter.eventKey || '', 180),
    relation_type: optionalRelation(filter.relation_type || filter.relation || filter.relationType),
    limit: filter.limit
  };
}

function normalizeEndpoint(endpoint, label) {
  if (!endpoint || typeof endpoint !== 'object') {
    throw graphError('REFERENCE_ENDPOINT_INVALID', `${label} endpoint is required`, 400);
  }
  const kind = requiredText(endpoint.kind, `${label}.kind`);
  if (!['object_ref', 'node'].includes(kind)) {
    throw graphError('REFERENCE_ENDPOINT_INVALID', `${label}.kind is invalid`, 400);
  }
  return {
    kind,
    id: requiredText(endpoint.id, `${label}.id`)
  };
}

function sameEdgeIdentity(existing, next) {
  return existing.source.kind === next.source_kind
    && existing.source.id === next.source_id
    && existing.target.kind === next.target_kind
    && existing.target.id === next.target_id
    && existing.relation_type === next.relation_type
    && String(existing.event_key || '') === String(next.event_key || '');
}

function requiredRelation(value) {
  const relation = requiredText(value, 'relation');
  if (!ALLOWED_RELATIONS.has(relation)) {
    throw graphError('REFERENCE_RELATION_INVALID', 'Unsupported reference relation', 400);
  }
  return relation;
}

function optionalRelation(value) {
  const relation = String(value || '').trim();
  if (!relation) {
    return '';
  }
  return requiredRelation(relation);
}

function requiredText(value, field) {
  const text = String(value || '').trim();
  if (!text) {
    throw graphError('REFERENCE_FIELD_REQUIRED', `${field} is required`, 400);
  }
  if (/[<>\u0000-\u001f]/.test(text)) {
    throw graphError('REFERENCE_FIELD_INVALID', `${field} is invalid`, 400);
  }
  return text;
}

function boundedText(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function boundedObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const json = JSON.stringify(value);
  if (json.length > 4096) {
    throw graphError('REFERENCE_METADATA_TOO_LARGE', 'Reference metadata is too large', 400);
  }
  return value;
}

function boundedConfidence(value) {
  const parsed = Number(value ?? 1);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.max(0, Math.min(1, parsed));
}

function graphError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

module.exports = {
  ALLOWED_RELATIONS,
  createReferenceGraphService,
  graphError
};
