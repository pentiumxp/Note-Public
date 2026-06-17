# Project Context

## Stable Facts

- Project name: Note
- Workspace path: `C:\Users\xuxin\Documents\Note`
- Runtime targets: Mac development workspace under
  `/Users/hermes-dev/HermesMobileDev/plugins/note` plus legacy local Windows
  context. Use Node.js built-in test runner for the primary harness.
- Current repository state: Git remote `origin` exists. Latest Mac production
  schema fix is commit `259a9fe` on `origin/main`.
- Mac production deploys must use the Home AI central deploy script from
  `/Users/hermes-dev/HermesMobileDev/app`; normal plugin source deploys must
  preserve production `data/` and restore production ownership.
- Hermes Mobile local integration runs Note MCP from WSL Gateway workers. The
  Note plugin service should listen on `0.0.0.0:4181`; the MCP wrapper should
  use the Windows WSL host gateway address, not Windows-only loopback.

## Goal

Create a maintainable notes project that functionally recreates the core Yinxiang Biji/Evernote-style note workspace while avoiding proprietary branding/assets and keeping clear service boundaries, replaceable storage/providers, privacy-safe documentation, and runnable harnesses.

## Non-Goals

- No production sync, sharing, collaboration, or account system until H1 harnesses are defined.
- No use of Yinxiang/Evernote trademark assets, copyrighted art, or private user data as fixtures.
- No OCR, voice transcription, browser extension, or cloud deployment until requirements and harness coverage are updated.
- No storage of raw secrets, raw model responses, long logs, or complete private note bodies in repository files.

## Architecture Decisions

- Service First: note lifecycle and validation rules live in `src/services/note-service.js`.
- Persistence is behind `src/stores/*`.
- Notebook identity is workspace-local; SQLite `notebooks` must use
  `primary key (workspace_id, id)` so common ids such as `inbox` and `hermes`
  can exist independently in every Hermes workspace.
- File-system import/export or external adapters belong in `src/providers/*`.
- Tests start at the service boundary and expand into route/UI/workflow harnesses only when those surfaces exist.
- Home AI platform contract pointer is `docs/HOME_AI_PLATFORM_CONTRACT.md`; canonical shared contract version is `20260606-v1`.
- Platform-level deployment, MCP/schema closure, mobile visual evidence, and Reference / Memory Graph rules live in `C:\Users\xuxin\Documents\Agent\docs\...`; Note-local docs should record only Note-specific facts and must not redefine the central contract.
- Reference / Memory Graph integration is H1/P1 architecture work. Note cross-plugin links must conform to the central Reference / Memory Graph V1 contract instead of introducing ad-hoc reference formats.
- Note-local Reference Graph V1 slice uses `src/stores/sqlite-reference-graph-schema.js`, `src/stores/sqlite-reference-graph-store.js`, `src/services/reference-graph-service.js`, `src/services/note-reference-service.js`, and `src/server-routes/reference-api-routes.js`.
- `src/server-routes/hermes-plugin-routes.js` is a route compositor. App workspace, notes API, and reference API behavior must stay in route groups/services and remain covered by `scripts/check-architecture.js` structural ownership checks.

## Verification Gates

- Focused checks: `npm test`, `npm run check`, `npm run privacy`.
- Diff hygiene: `git diff --check` when the workspace is inside a Git repository.

## Secret Handling

Secrets must be stored outside the repo or in local ignored `.env` files. Documentation may reference variable names and secret locations only, never secret values.
## HANES Context Loading

- Use .agent-context/HANES_CONTEXT_LOADING.md for cross-workspace context loading discipline. Keep startup context short; load detailed skills, docs, handoffs, archives, and harness matrices only when the current task crosses that risk boundary.
## Workspace Bootstrap Read First

- Use .agent-context/WORKSPACE_BOOTSTRAP_READ_FIRST.md for cross-workspace startup discipline. Confirm the intended workspace, read bounded .agent-context/PROJECT_CONTEXT.md and .agent-context/HANDOFF.md before substantive work, honor continuation read-only mode, and combine this with .agent-context/HANES_CONTEXT_LOADING.md to avoid loading full historical context unless needed.
