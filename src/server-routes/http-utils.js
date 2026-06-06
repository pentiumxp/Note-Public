'use strict';

async function handleJson(response, action) {
  try {
    return sendJson(response, 200, await action());
  } catch (error) {
    return sendError(response, error);
  }
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    throw routeError('invalid_json', 'Invalid JSON body', 400);
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
  return true;
}

function sendError(response, error) {
  const code = error.code || 'workspace_registration_failed';
  const status = error.status || 500;
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ ok: false, error: code }));
  return true;
}

function routeError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function boundedLimit(value, fallback = 20, max = 50) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

module.exports = {
  boundedLimit,
  handleJson,
  readJson,
  routeError,
  safeJson,
  sendError,
  sendJson
};
