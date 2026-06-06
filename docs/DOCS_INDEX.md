# Docs Index

Read order for Note work:

1. `.agent-context/PROJECT_CONTEXT.md`
2. `.agent-context/HANDOFF.md`
3. `docs/ARCHITECTURE.md`
4. `docs/NOTE_AS_AI_MEMORY_REQUIREMENTS.md`
5. `docs/HOME_AI_PLATFORM_CONTRACT.md`
6. `docs/REFERENCE_GRAPH_ALIGNMENT_PLAN.md`
7. `docs/CROSS_PLUGIN_REFERENCES_DESIGN.md`
8. `docs/ATTACHMENT_ASSET_STORE.md`
9. `docs/HERMES_PLUGIN_MANIFEST.md`
10. `docs/HERMES_PLUGIN_PROVISIONING.md`
11. `docs/HERMES_PLUGIN_LAUNCH.md`
12. `docs/HERMES_PLUGIN_MCP.md`
13. `docs/HERMES_PLUGIN_HARNESS.md`
14. `docs/TEST_MATRIX.md`

Note is an independent plugin application. Hermes Mobile discovers, provisions, launches, embeds, and orchestrates it through MCP. Note owns its UI, API, SQLite data, workspace isolation, MCP wrapper, plugin harnesses, and cross-plugin reference index.

Cross-plugin references are governed by the Home AI Reference / Memory Graph V1
contract. `docs/REFERENCE_GRAPH_ALIGNMENT_PLAN.md` is the Note-local alignment
document and takes precedence over older ad-hoc `note_links` planning language.
