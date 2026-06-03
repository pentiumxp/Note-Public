# Project Context

## Stable Facts

- Project name: Note
- Workspace path: `C:\Users\xuxin\Documents\Note`
- Runtime target: local Windows workspace, PowerShell shell, Node.js built-in test runner for the initial harness.
- Current repository state: initialized as a local project scaffold; commit, push, and deployment require explicit user instruction.

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
- File-system import/export or external adapters belong in `src/providers/*`.
- Tests start at the service boundary and expand into route/UI/workflow harnesses only when those surfaces exist.

## Verification Gates

- Focused checks: `npm test`, `npm run check`, `npm run privacy`.
- Diff hygiene: `git diff --check` when the workspace is inside a Git repository.

## Secret Handling

Secrets must be stored outside the repo or in local ignored `.env` files. Documentation may reference variable names and secret locations only, never secret values.
