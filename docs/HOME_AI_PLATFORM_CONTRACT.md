# Home AI Platform Contract Pointer

Last updated: 2026-06-06.
Home AI platform contract version: `20260606-v1`.

## Scope

Note is a standard inserted Home AI plugin and the planned first local home for
non-structured memory plus cross-plugin reference links. This file records only
Note-local facts and points back to the canonical Home AI platform contract.

## Canonical Home AI Docs

Read these Home AI docs before changing deployment, MCP tools, mobile visual
behavior, or cross-plugin reference behavior:

- `C:\Users\xuxin\Documents\Agent\docs\PLATFORM_CONTRACTS\plugin-workspace-platform-contract.md`
- `C:\Users\xuxin\Documents\Agent\docs\PLATFORM_CONTRACTS\plugin-mobile-ui-visual-contract.md`
- `C:\Users\xuxin\Documents\Agent\docs\RUNBOOKS\macos-production-access.md`
- `C:\Users\xuxin\Documents\Agent\docs\RUNBOOKS\mcp-tool-upgrade-closure.md`
- `C:\Users\xuxin\Documents\Agent\docs\RUNBOOKS\macos-ios-simulator-appium.md`
- `C:\Users\xuxin\Documents\Agent\docs\IMPLEMENTATION_NOTES\reference-memory-graph-v1.md`
- `C:\Users\xuxin\Documents\Agent\docs\IMPLEMENTATION_NOTES\reference-memory-graph-harness-plan.md`

## Plugin-Local Facts

| Field | Value |
| --- | --- |
| `plugin_id` | `note` |
| `workspace_path_windows` | `C:\Users\xuxin\Documents\Note` |
| `current_branch_snapshot` | `main` at `fb92356` when this pointer was added |
| `production_source_path_macos` | `/Users/hermes-host/HermesMobile/plugins/note` |
| `production_data_root_macos` | `/Users/hermes-host/HermesMobile/plugins/note/data` plus workspace-local `.hermes-note` bindings |
| `windows_dev_base_url` | `http://127.0.0.1:4181` |
| `macos_production_base_url` | `http://127.0.0.1:4181` |
| `launchd_label` | `system/com.hermesmobile.plugin.note` |
| `manifest_url` | `http://127.0.0.1:4181/api/v1/hermes/plugin/manifest` |
| `mcp_command` | `python scripts/note_mcp_stdio.py` or the configured Gateway wrapper; verify before production changes |
| `mcp_schema_endpoint` | MCP `tools/list` through the stdio wrapper and plugin manifest through HTTP |
| `deploy_command` | Use the Home AI Mac access runbook; verify the current Note deploy script/path before production sync. |
| `credential_locations` | Workspace-local ignored `.hermes-note` config/key files only by reference. Do not record raw keys or launch tokens here. |
| `reference_contract_status` | Note-local V1 slice implemented: SQLite object refs/edges/events/provenance, Note link wrappers, and Note `reference_*` contract. Cross-plugin orchestration remains owned by Hermes Mobile. |
| `mobile_visual_harness_status` | Multiple local Playwright visual harnesses exist; Home AI Appium/iOS Simulator evidence is required for embedded shell, gesture, preview, safe-area, or PWA differences. |

## Required Local Validation

Run the smallest focused set for the changed surface:

```powershell
npm test
npm run check
npm run check:architecture
npm run privacy
```

For embedded UI changes, add the relevant visual harness:

```powershell
npm run visual:embedded-back
npm run visual:no-horizontal-drag
npm run visual:attachment-preview
npm run visual:theme-sync
```

From the Home AI main workspace, run the cross-workspace platform contract
checker after changing this pointer or any Note deployment/MCP/mobile contract:

```powershell
node scripts\plugin-workspace-platform-contract-check.js --plugin note --json
```

## Required Production Validation

Use the Home AI Mac access runbook. Do not print passwords, keys, cookies,
workspace tokens, full note bodies, attachment bytes, launch tokens, or long
logs.

Minimum closure for Note production changes:

1. verify Mac launchd `system/com.hermesmobile.plugin.note` is running;
2. verify Mac loopback plugin manifest and launch flow;
3. verify direct MCP `tools/list` includes expected Note tools;
4. when MCP tools changed, run the Home AI MCP tool upgrade closure harness so
   the selected Gateway profile and selected worker expose the callable
   `mcp_note_*` tool names;
5. for preview or attachment changes, perform bounded readback and visual proof
   without dumping private note content.

## Open Gaps

- Wire Hermes Mobile selected Gateway/profile closure for the new Note reference tools after deployment.
- Add Note-specific Appium/iOS Simulator coverage for embedded preview,
  gesture, and installed-PWA shell behavior.
- Keep the exact Mac production source and data roots current after the next
  Note production deployment.
