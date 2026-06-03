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
        "description": "Create a note in the bound Note workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "body": {"type": "string"},
                "tags": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["title", "body"],
        },
    },
    {
        "name": "notes_update",
        "description": "Update title, body, or tags for one note in the bound Note workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "note_id": {"type": "string"},
                "title": {"type": "string"},
                "body": {"type": "string"},
                "tags": {"type": "array", "items": {"type": "string"}},
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
]

FORBIDDEN_ARGUMENTS = {"workspace", "workspace_id", "access_key", "key", "token", "launch"}


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
            response = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32000, "message": bounded_error(exc)},
            }
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


def handle_rpc(request: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    method = request.get("method")
    request_id = request.get("id")
    if method == "initialize":
        return {"jsonrpc": "2.0", "id": request_id, "result": {"protocolVersion": "2024-11-05", "capabilities": {"tools": {}}}}
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
        return request_json(context, "POST", "/api/v1/notes", body={"title": arguments.get("title"), "body": arguments.get("body"), "tags": arguments.get("tags") or []})
    if name == "notes_update":
        patch = {key: arguments[key] for key in ("title", "body", "tags") if key in arguments}
        return request_json(context, "PATCH", "/api/v1/notes/" + quote_required(arguments, "note_id"), body=patch)
    if name == "notes_delete":
        return request_json(context, "DELETE", "/api/v1/notes/" + quote_required(arguments, "note_id"))
    if name == "notes_tags_list":
        return request_json(context, "GET", "/api/v1/notes/tags")
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
    value = str(arguments.get(key) or "")
    if not value:
        raise ConfigError("note_mcp_required_argument_missing")
    return urllib.parse.quote(value, safe="")


def bounded_limit(value: Any) -> int:
    try:
        parsed = int(value or 20)
    except (TypeError, ValueError):
        parsed = 20
    return max(1, min(50, parsed))


def bounded_error(exc: Exception) -> str:
    return str(exc)[:160]


if __name__ == "__main__":
    raise SystemExit(main())
