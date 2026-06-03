# Requirements

## Background

This workspace is now targeting a functional recreation of the China edition of Yinxiang Biji-style note-taking workflows, but the product goal has expanded for Hermes Mobile. Note is a Hermes Mobile plugin for non-structured family memory and cross-plugin references. It should reproduce useful note-taking behavior and information architecture, not proprietary branding, exact visuals, copyrighted assets, or service internals.

Hermes Mobile remains the AI center and orchestration layer. Note provides MCP tools for notes and references. It must not become a replacement Hermes Mobile workspace or take over other plugins' structured business data.

Observed reference on Android:

- Official package: `com.yinxiang`
- Installed version: `10.8.38`
- Launch screen has privacy agreement, notification permission, login/register with phone/email/username, and WeChat login.
- Logged-in home uses bottom tabs: 首页, 搜索, central create action, 模板, 我的.
- Home has a header area with account/avatar, member/recognition-style action icons, horizontal quick creation cards, an `全部笔记` toolbar, and a note list.
- Search row includes 搜索笔记 plus shortcut, tag, and reminder entrances.
- Create menu is a bottom sheet/grid with entries including 文字笔记, 超级笔记, 拍照, 录音, 附件; other menu entries are still being classified.
- Public Android download source observed from `https://www.yinxiang.com/download/get.php?file=AndroidYinxiangCom`.

## Users

- Owner: defines scope, storage location, privacy policy, and release timing.
- Local user: captures, organizes, searches, edits, exports, and reviews notes/tasks.
- Future automation: may index, OCR, clip, summarize, or sync note metadata after explicit requirements are added.

## Core Scenarios

| Scenario | Result | Harness |
| --- | --- | --- |
| Scenario | Result | Harness |
| --- | --- | --- |
| Create text note | A note is created with title, body, timestamps, notebook, tags, and stable id. | H2 service contract |
| Organize note | User can assign notebook, tags, shortcut state, reminder, and archive/trash state. | H2 service contract |
| Edit note | Allowed fields change while id and created timestamp remain stable. | H2 service contract |
| Search and filter | Matching notes are returned by query, notebook, tag, shortcut, task, or status filters. | H2 projection contract |
| Task capture | User can add checklist items linked to a note and view open/completed tasks. | H2 service contract; H1 if reminders sync externally |
| Import/export notes | Notes move through a provider boundary with idempotency and privacy checks. | H1 workflow harness when implemented |
| Attachment metadata | User can attach file/image/audio metadata without leaking local file contents into logs. | H2 provider contract; H1 for OCR/cloud upload |
| Account/sync placeholder | UI shows offline/sync state without real account secrets. | H2 projection; H1 before real sync |
| Mobile navigation parity | Prototype should map home/search/create/templates/me areas even if desktop layout uses wider panes. | H2 DOM/projection |
| Cross-plugin reference | A note can link to a billing, wardrobe, people, calendar, or other plugin object by bounded reference metadata. | H2 service/MCP contract |
| Backlink lookup | Other plugins can ask Note for notes related to one plugin object. | H2 service/MCP contract |

## Non-Goals

- Exact Yinxiang/Evernote trademark, logo, copy, images, or proprietary UI assets.
- Real Yinxiang server compatibility.
- Multi-user collaboration.
- Cloud sync.
- Public sharing.
- OCR, voice transcription, web clipper, calendar integration, or AI summarization in the first local prototype.
- Exact server-side membership upsell, proprietary template library, or official app marketplace behavior.
- Production deployment.
- Replacing Hermes Mobile as the AI center or plugin orchestration layer.
- Owning billing, wardrobe, people, calendar, or other plugins' structured data.

## Data Scope

- Owned data: note id, title, body, notebook id, tags, tasks, reminder metadata, attachment metadata, timestamps, status, shortcut flag, and non-sensitive sync metadata.
- Read-only data: source files selected by the user during import.
- Metadata-only references: source path, import count, validation status, and short error codes.
- Cross-plugin references: plugin id, object type, object id, relation, label, bounded display snapshot, created metadata.

## Permission Boundary

- Initial scaffold assumes a single local owner.
- Any future multi-user or sync feature must define read/write/admin roles before implementation.
- UI or route layers must not make final permission decisions; permission checks belong in services/providers.

## Privacy Boundary

Repository files, docs, tests, logs, snapshots, screenshots, and handoffs must not include raw secrets, raw model responses, long logs, complete private note bodies, cookies, tokens, passwords, or production connection strings.

## Acceptance Criteria

- Project can be rehydrated from `.agent-context` and `docs/`.
- Service boundary exists before route/UI implementation.
- Local web prototype opens with the notes workspace as the first screen.
- User can create, edit, search, filter, tag, notebook, shortcut, and task notes locally.
- User or Hermes Mobile can create and query note-to-plugin-object references without crossing workspace boundaries.
- First service/projection tests run through `npm test`.
- Privacy scan has a runnable command.
- Required initialization documents exist.

## Risks and Constraints

- Full reference-app behavior still requires logged-in exploration.
- File formats and storage engine are undecided.
- Import/export can become H1 if it writes back to external systems or processes private content at scale.
