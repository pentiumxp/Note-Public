#!/usr/bin/env python3
"""Workspace-bound MCP stdio wrapper for the Note plugin."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


MAX_ATTACHMENTS = 8
MAX_ATTACHMENT_BASE64_CHARS = 12 * 1024 * 1024
ATTACHMENT_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string", "description": "Attachment display name, including extension when available."},
        "kind": {"type": "string", "enum": ["image", "document", "audio", "file"]},
        "mime": {"type": "string"},
        "size": {"type": "integer", "minimum": 0},
        "data_base64": {"type": "string", "description": "Bounded base64 file payload. Local paths and URLs are not accepted."},
        "content_base64": {"type": "string", "description": "Alias for data_base64."},
        "base64": {"type": "string", "description": "Alias for data_base64."},
    },
    "required": ["name"],
    "additionalProperties": False,
}
DISPLAY_SNAPSHOT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "subtitle": {"type": "string"},
        "time": {"type": "string"},
        "thumbnail_hint": {"type": "string"},
    },
    "additionalProperties": False,
}

TOOLS = [
    {
        "name": "notes_search",
        "description": "Search notes in the bound Note workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 50},
                "updated_after": {"type": "string"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "notes_recent",
        "description": "List recently updated notes in the bound Note workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "minimum": 1, "maximum": 50}},
        },
    },
    {
        "name": "notes_get",
        "description": "Read one note by id from the bound Note workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {"note_id": {"type": "string"}},
            "required": ["note_id"],
        },
    },
    {
        "name": "notes_create",
        "description": "Create a note in the bound Note workspace. Optional attachments are saved from bounded base64 payloads.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "body": {"type": "string"},
                "tags": {"type": "array", "items": {"type": "string"}},
                "attachments": {"type": "array", "maxItems": MAX_ATTACHMENTS, "items": ATTACHMENT_SCHEMA},
            },
            "required": ["title", "body"],
        },
    },
    {
        "name": "notes_update",
        "description": "Update title, body, or tags for one note in the bound Note workspace. Optional attachments are appended, not used to replace existing attachments.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "note_id": {"type": "string"},
                "title": {"type": "string"},
                "body": {"type": "string"},
                "tags": {"type": "array", "items": {"type": "string"}},
                "attachments": {"type": "array", "maxItems": MAX_ATTACHMENTS, "items": ATTACHMENT_SCHEMA},
            },
            "required": ["note_id"],
        },
    },
    {
        "name": "notes_delete",
        "description": "Delete one note in the bound Note workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {"note_id": {"type": "string"}},
            "required": ["note_id"],
        },
    },
    {
        "name": "notes_tags_list",
        "description": "List tags in the bound Note workspace.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "notes_link_create",
        "description": "Create a bounded link from one Note note to another plugin object in the bound workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "note_id": {"type": "string"},
                "target_plugin_id": {"type": "string"},
                "target_object_type": {"type": "string"},
                "target_object_id": {"type": "string"},
                "relation": {"type": "string", "enum": ["mentions", "same_event", "evidence_for", "created_from", "context_for", "followup_to"]},
                "label": {"type": "string"},
                "display_snapshot": DISPLAY_SNAPSHOT_SCHEMA,
                "event_key": {"type": "string"},
                "idempotency_key": {"type": "string"},
            },
            "required": ["note_id", "target_plugin_id", "target_object_type", "target_object_id", "relation"],
            "additionalProperties": False,
        },
    },
    {
        "name": "notes_links_list",
        "description": "List bounded links for one Note note in the bound workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "note_id": {"type": "string"},
                "relation": {"type": "string"},
                "target_plugin_id": {"type": "string"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 50},
            },
            "required": ["note_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "notes_backlinks_list",
        "description": "List Note notes linked to a target plugin object in the bound workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "plugin_id": {"type": "string"},
                "object_type": {"type": "string"},
                "object_id": {"type": "string"},
                "relation": {"type": "string"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 50},
            },
            "required": ["plugin_id", "object_type", "object_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "notes_link_delete",
        "description": "Delete one Note reference link in the bound workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {"link_id": {"type": "string"}},
            "required": ["link_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "reference_object_types",
        "description": "Return Note object types supported by the Home AI Reference contract.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "reference_get",
        "description": "Return a bounded Note reference object by type and id.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_type": {"type": "string"},
                "object_id": {"type": "string"},
            },
            "required": ["object_type", "object_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "reference_summarize",
        "description": "Return a bounded Note reference summary by type and id.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_type": {"type": "string"},
                "object_id": {"type": "string"},
                "purpose": {"type": "string"},
            },
            "required": ["object_type", "object_id"],
            "additionalProperties": False,
        },
    },
]

FORBIDDEN_ARGUMENTS = {"workspace", "workspace_id", "access_key", "key", "token", "launch"}
ALLOWED_ATTACHMENT_FIELDS = {"name", "kind", "mime", "size", "data_base64", "content_base64", "base64"}
FORBIDDEN_ATTACHMENT_FIELDS = {
    "path",
    "file",
    "filePath",
    "file_path",
    "localPath",
    "local_path",
    "url",
    "workspace",
    "workspace_id",
    "access_key",
    "key",
    "token",
    "launch",
    "storageKey",
    "storage_key",
}


class ConfigError(Exception):
    pass


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--api-base-url", required=True)
    parser.add_argument("--no-workspace-override", action="store_true", required=True)
    parser.add_argument("--self-test-tools-list", action="store_true")
    args = parser.parse_args()

    try:
      context = load_context(Path(args.workspace), args.api_base_url)
    except ConfigError as exc:
      print(str(exc), file=sys.stderr)
      return 2

    if args.self_test_tools_list:
        print(json.dumps({"tools": [tool["name"] for tool in TOOLS]}, ensure_ascii=False))
        return 0

    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            request = json.loads(line)
            response = handle_rpc(request, context)
        except Exception as exc:  # MCP wrappers fail closed and bounded.
            request_id = request.get("id") if isinstance(locals().get("request"), dict) else None
            if request_id is None:
                continue
            response = {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {"code": -32000, "message": bounded_error(exc)},
            }
        if response is None:
            continue
        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    return 0


def load_context(workspace: Path, api_base_url: str) -> dict[str, Any]:
    config_dir = workspace / ".hermes-note"
    config_path = config_dir / "config.json"
    if not config_path.exists():
        raise ConfigError("note_mcp_config_missing")
    config = json.loads(config_path.read_text(encoding="utf-8"))
    key_file = str(config.get("access_key_file") or "access-key.txt")
    if Path(key_file).name != key_file:
        raise ConfigError("note_mcp_key_file_invalid")
    key_path = config_dir / key_file
    if not key_path.exists():
        raise ConfigError("note_mcp_key_missing")
    workspace_id = str(config.get("workspace_id") or "")
    if not workspace_id.startswith("note:"):
        raise ConfigError("note_mcp_workspace_invalid")
    return {
        "workspace_id": workspace_id,
        "api_base_url": api_base_url.rstrip("/") or str(config.get("api_base_url", "")).rstrip("/"),
        "raw_key": key_path.read_text(encoding="utf-8").strip(),
    }


def handle_rpc(request: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
    method = request.get("method")
    request_id = request.get("id")
    if request_id is None:
        return None
    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "note", "version": "1.0.0"},
            },
        }
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": request_id, "result": {"tools": TOOLS}}
    if method == "tools/call":
        params = request.get("params") or {}
        name = params.get("name")
        arguments = params.get("arguments") or {}
        result = call_tool(str(name), arguments, context)
        return {"jsonrpc": "2.0", "id": request_id, "result": {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False)}]}}
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32601, "message": "method_not_found"}}


def call_tool(name: str, arguments: dict[str, Any], context: dict[str, Any]) -> Any:
    reject_forbidden_arguments(arguments)
    if name == "notes_search":
        params = {"query": str(arguments.get("query") or ""), "limit": bounded_limit(arguments.get("limit"))}
        if arguments.get("updated_after"):
            params["updated_after"] = str(arguments["updated_after"])
        return request_json(context, "GET", "/api/v1/notes/search", params=params)
    if name == "notes_recent":
        return request_json(context, "GET", "/api/v1/notes/recent", params={"limit": bounded_limit(arguments.get("limit"))})
    if name == "notes_get":
        return request_json(context, "GET", "/api/v1/notes/" + quote_required(arguments, "note_id"))
    if name == "notes_create":
        body = {"title": arguments.get("title"), "body": arguments.get("body"), "tags": arguments.get("tags") or []}
        attachments = bounded_attachments(arguments.get("attachments"))
        if attachments:
            body["attachments"] = attachments
        return request_json(context, "POST", "/api/v1/notes", body=body)
    if name == "notes_update":
        patch = {key: arguments[key] for key in ("title", "body", "tags") if key in arguments}
        if "attachments" in arguments:
            attachments = bounded_attachments(arguments.get("attachments"))
            if attachments:
                patch["attachments"] = attachments
        return request_json(context, "PATCH", "/api/v1/notes/" + quote_required(arguments, "note_id"), body=patch)
    if name == "notes_delete":
        return request_json(context, "DELETE", "/api/v1/notes/" + quote_required(arguments, "note_id"))
    if name == "notes_tags_list":
        return request_json(context, "GET", "/api/v1/notes/tags")
    if name == "notes_link_create":
        body = {
            "note_id": arguments.get("note_id"),
            "target_plugin_id": arguments.get("target_plugin_id"),
            "target_object_type": arguments.get("target_object_type"),
            "target_object_id": arguments.get("target_object_id"),
            "relation": arguments.get("relation"),
            "label": arguments.get("label") or "",
            "display_snapshot": bounded_display_snapshot(arguments.get("display_snapshot")),
            "event_key": arguments.get("event_key") or "",
            "idempotency_key": arguments.get("idempotency_key") or "",
        }
        return request_json(context, "POST", "/api/v1/notes/links", body=body)
    if name == "notes_links_list":
        params = {"limit": bounded_limit(arguments.get("limit"))}
        add_optional_param(params, "relation", arguments.get("relation"))
        add_optional_param(params, "target_plugin_id", arguments.get("target_plugin_id"))
        return request_json(context, "GET", f"/api/v1/notes/{quote_required(arguments, 'note_id')}/links", params=params)
    if name == "notes_backlinks_list":
        params = {
            "plugin_id": required_arg(arguments, "plugin_id"),
            "object_type": required_arg(arguments, "object_type"),
            "object_id": required_arg(arguments, "object_id"),
            "limit": bounded_limit(arguments.get("limit")),
        }
        add_optional_param(params, "relation", arguments.get("relation"))
        return request_json(context, "GET", "/api/v1/notes/backlinks", params=params)
    if name == "notes_link_delete":
        return request_json(context, "DELETE", "/api/v1/notes/links/" + quote_required(arguments, "link_id"))
    if name == "reference_object_types":
        return request_json(context, "GET", "/api/v1/reference/object-types")
    if name == "reference_get":
        return request_json(context, "GET", "/api/v1/reference/get", params={
            "object_type": required_arg(arguments, "object_type"),
            "object_id": required_arg(arguments, "object_id"),
        })
    if name == "reference_summarize":
        params = {
            "object_type": required_arg(arguments, "object_type"),
            "object_id": required_arg(arguments, "object_id"),
        }
        add_optional_param(params, "purpose", arguments.get("purpose"))
        return request_json(context, "GET", "/api/v1/reference/summarize", params=params)
    raise ConfigError("note_mcp_tool_unknown")


def request_json(context: dict[str, Any], method: str, path: str, params: dict[str, Any] | None = None, body: dict[str, Any] | None = None) -> Any:
    url = context["api_base_url"] + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": "Bearer " + context["raw_key"],
            "X-Note-Workspace-Id": context["workspace_id"],
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode("utf-8")
        raise ConfigError("note_mcp_api_error:" + payload[:120])


def reject_forbidden_arguments(arguments: dict[str, Any]) -> None:
    if FORBIDDEN_ARGUMENTS.intersection(arguments.keys()):
        raise ConfigError("note_mcp_workspace_override_forbidden")


def quote_required(arguments: dict[str, Any], key: str) -> str:
    return urllib.parse.quote(required_arg(arguments, key), safe="")


def required_arg(arguments: dict[str, Any], key: str) -> str:
    value = str(arguments.get(key) or "").strip()
    if not value:
        raise ConfigError("note_mcp_required_argument_missing")
    return value


def add_optional_param(params: dict[str, Any], key: str, value: Any) -> None:
    text = str(value or "").strip()
    if text:
        params[key] = text


def bounded_display_snapshot(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise ConfigError("note_mcp_display_snapshot_invalid")
    allowed = {"title", "subtitle", "time", "thumbnail_hint"}
    if set(value.keys()) - allowed:
        raise ConfigError("note_mcp_display_snapshot_invalid")
    return {key: str(raw)[:240] for key, raw in value.items() if raw is not None}


def bounded_limit(value: Any) -> int:
    try:
        parsed = int(value or 20)
    except (TypeError, ValueError):
        parsed = 20
    return max(1, min(50, parsed))


def bounded_attachments(value: Any) -> list[dict[str, Any]]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ConfigError("note_mcp_attachments_invalid")
    if len(value) > MAX_ATTACHMENTS:
        raise ConfigError("note_mcp_attachments_too_many")
    cleaned: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            raise ConfigError("note_mcp_attachments_invalid")
        if FORBIDDEN_ATTACHMENT_FIELDS.intersection(item.keys()):
            raise ConfigError("note_mcp_attachment_field_forbidden")
        attachment: dict[str, Any] = {}
        for key in ALLOWED_ATTACHMENT_FIELDS:
            if key not in item:
                continue
            raw = item[key]
            if key in {"data_base64", "content_base64", "base64"}:
                text = str(raw or "").strip()
                if len(text) > MAX_ATTACHMENT_BASE64_CHARS:
                    raise ConfigError("note_mcp_attachment_too_large")
                attachment[key] = text
            elif key == "size":
                try:
                    attachment[key] = max(0, int(raw or 0))
                except (TypeError, ValueError):
                    attachment[key] = 0
            else:
                attachment[key] = str(raw or "").strip()
        cleaned.append(attachment)
    return cleaned


def bounded_error(exc: Exception) -> str:
    return str(exc)[:160]


if __name__ == "__main__":
    raise SystemExit(main())
