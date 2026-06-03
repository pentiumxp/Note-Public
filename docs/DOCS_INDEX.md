# Docs Index

Read order for Note work:

1. `.agent-context/PROJECT_CONTEXT.md`
2. `.agent-context/HANDOFF.md`
3. `docs/ARCHITECTURE.md`
4. `docs/NOTE_AS_AI_MEMORY_REQUIREMENTS.md`
5. `docs/CROSS_PLUGIN_REFERENCES_DESIGN.md`
6. `docs/HERMES_PLUGIN_MANIFEST.md`
7. `docs/HERMES_PLUGIN_PROVISIONING.md`
8. `docs/HERMES_PLUGIN_LAUNCH.md`
9. `docs/HERMES_PLUGIN_MCP.md`
10. `docs/HERMES_PLUGIN_HARNESS.md`
11. `docs/TEST_MATRIX.md`

Note is an independent plugin application. Hermes Mobile discovers, provisions, launches, embeds, and orchestrates it through MCP. Note owns its UI, API, SQLite data, workspace isolation, MCP wrapper, plugin harnesses, and cross-plugin reference index.
